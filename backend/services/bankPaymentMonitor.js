const mysql = require('../database/mysql');
const zibalService = require('./zibalService');
const { refreshUserCache } = require('../utils/userCache');
const telegramBot = require('./telegramBot');
const smsService = require('./smsService');
const notificationService = require('./notificationService');

let monitoringTimeout = null;

const ZIBAL_MERCHANT = process.env.ZIBAL_MERCHANT || 'zibal';

// Generate random interval between 10 to 59 seconds
const getRandomInterval = () => {
  return Math.floor(Math.random() * 50000) + 10000; // 10-59 seconds in milliseconds
};

const checkPendingBankPayments = async () => {
  try {
    // Get all pending bank payments (zibal) from transactions
    const query = `
      SELECT 
        t.id as transactionId,
        t.userId,
        t.trackId,
        t.orderId,
        t.amount,
        t.paymentType,
        t.status,
        t.description,
        t.createdAt,
        t.cardNumber,
        t.refNumber
      FROM transactions t
      WHERE t.paymentType = 'zibal'
      AND t.status = 'pending'
      AND t.createdAt > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `;

    const pendingPayments = await mysql.query(query);

    for (const payment of pendingPayments) {
      try {
        // Verify payment with Zibal
        const verifyResult = await zibalService.verifyPayment(payment.trackId, ZIBAL_MERCHANT);

        if (verifyResult.success) {
          // Payment completed
          if (payment.status === 'pending') {
            // Update transaction
            const updateTransactionQuery = `
              UPDATE transactions 
              SET status = 'completed', 
                  refNumber = ?, 
                  cardNumber = ?, 
                  paidAt = ?,
                  description = ?
              WHERE id = ?
            `;
            
            await mysql.query(updateTransactionQuery, [
              verifyResult.refNumber,
              verifyResult.cardNumber,
              verifyResult.paidAt ? new Date(verifyResult.paidAt) : new Date(),
              verifyResult.description || payment.description || 'Payment completed via Zibal',
              payment.transactionId
            ]);

            // Check if this transaction is for an order (orderNumber starts with "OS")
            if (payment.orderId && payment.orderId.startsWith('OS')) {
              // Update order status
              const updateOrderQuery = `
                UPDATE orders 
                SET status = 'completed', 
                    paidAmount = amount,
                    completedAt = NOW()
                WHERE orderNumber = ? AND status = 'pending'
              `;
              await mysql.query(updateOrderQuery, [payment.orderId]);
              console.log(`[Bank Payment Monitor] Order ${payment.orderId} completed via payment verification`);

              // ارسال نوتیفیکیشن‌ها و گزارش ادمین
              try {
                const telegramBot = require('./telegramBot');
                const notificationService = require('./notificationService');
                
                // دریافت اطلاعات سفارش و محصول
                const orderQuery = `
                  SELECT o.*, p.productName 
                  FROM orders o
                  LEFT JOIN products p ON o.productId = p.id
                  WHERE o.orderNumber = ?
                `;
                const orders = await mysql.query(orderQuery, [payment.orderId]);
                
                if (orders && orders.length > 0) {
                  const orderData = orders[0];
                  const productName = orderData.productName || 'نامشخص';
                  // استفاده از order.amount که به صورت صحیح ذخیره شده (تومان برای online و wallet)
                  let amountInToman;
                  if (orderData.paymentMethod === 'crypto') {
                    amountInToman = Math.floor(orderData.amount / 10); // تبدیل از ریال به تومان
                  } else {
                    amountInToman = orderData.amount; // به صورت تومان ذخیره شده
                  }

                  // دریافت اطلاعات کاربر
                  const userQuery = 'SELECT telegramID, phoneNumber FROM users WHERE id = ?';
                  const users = await mysql.query(userQuery, [payment.userId]);
                  
                  if (users && users.length > 0) {
                    const user = users[0];

                    // ارسال نوتیفیکیشن تلگرام
                    if (user.telegramID) {
                      await telegramBot.sendOrderCompletionNotification(
                        user.telegramID,
                        payment.orderId,
                        productName,
                        amountInToman
                      );
                    }

                    // ایجاد نوتیفیکیشن درون اپ
                    const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
                    await notificationService.createNotification(
                      payment.userId,
                      'order',
                      'خرید شما موفق بود',
                      `سفارش شما با شماره ${payment.orderId} با موفقیت ثبت و پرداخت شد.\n\n🛍️ محصول: ${productName}\n💵 مبلغ: ${amountInToman.toLocaleString('fa-IR')} تومان\n\n✅ پس از تایید توسط کارشناسان ما، وضعیت سفارش شما تغییر خواهد کرد و محصول به شما تحویل داده خواهد شد.`,
                      `${frontendUrl}/dashboard`
                    );

                    // ارسال گزارش ادمین
                    await telegramBot.sendAdminOrderReport(
                      payment.userId,
                      payment.orderId,
                      productName,
                      amountInToman,
                      'OnlineGateway',
                      null
                    );
                  }
                }
              } catch (error) {
                console.error(`[Bank Payment Monitor] Error sending order completion notifications:`, error);
              }
            } else if (!payment.orderId || !payment.orderId.startsWith('OS')) {
              // This is a wallet charge, update wallet balance
              const amountInRial = payment.amount; // Already in Rial
              const amountInToman = Math.floor(amountInRial / 10); // Convert to Toman for display
              
              const updateWalletQuery = `
                UPDATE users 
                SET walletBalance = walletBalance + ? 
                WHERE id = ?
              `;
              await mysql.query(updateWalletQuery, [amountInRial, payment.userId]);
              console.log(`[Bank Payment Monitor] Wallet charged for user ${payment.userId}`);

              // Get user data for notifications
              const userQuery = `SELECT telegramID, phoneNumber FROM users WHERE id = ?`;
              const users = await mysql.query(userQuery, [payment.userId]);
              
              // Get user's SHABA number from cards (first card with SHABA)
              let userShabaNumber = null;
              try {
                const shabaQuery = `SELECT shebaNumber FROM cards WHERE userId = ? AND shebaNumber IS NOT NULL AND shebaNumber != '' LIMIT 1`;
                const shabaResult = await mysql.query(shabaQuery, [payment.userId]);
                if (shabaResult && shabaResult.length > 0) {
                  userShabaNumber = shabaResult[0].shebaNumber;
                }
              } catch (error) {
                console.error(`[Bank Payment Monitor] Error fetching user SHABA:`, error);
              }
              
              if (users && users.length > 0) {
                const user = users[0];
                
                // Send Telegram notification if user has telegramID
                if (user.telegramID) {
                  try {
                    await telegramBot.sendWalletChargeNotification(user.telegramID, amountInToman, userShabaNumber);
                  } catch (error) {
                    console.error(`[Bank Payment Monitor] Error sending Telegram notification:`, error);
                  }
                }
                
                // Send SMS notification if user has phoneNumber
                if (user.phoneNumber) {
                  try {
                    await smsService.sendWalletChargeSMS(user.phoneNumber, amountInToman);
                  } catch (error) {
                    console.error(`[Bank Payment Monitor] Error sending SMS notification:`, error);
                  }
                }
                
                  // Create in-app notification
                  try {
                    const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
                    await notificationService.createNotification(
                      payment.userId,
                      'wallet_charge',
                      'شارژ موفق کیف پول',
                      `مبلغ ${amountInToman.toLocaleString('fa-IR')} تومان با موفقیت به کیف پول شما افزوده شد.`,
                      `${frontendUrl}/shop`
                    );
                  } catch (error) {
                    console.error(`[Bank Payment Monitor] Error creating in-app notification:`, error);
                  }

                  // Send admin channel report
                  try {
                    console.log(`[Bank Payment Monitor] Sending admin report for user ${payment.userId}, amount: ${amountInToman}`);
                    const adminReportResult = await telegramBot.sendAdminChargeReport(
                      payment.userId,
                      amountInToman,
                      'OnlineGateway',
                      userShabaNumber,
                      null
                    );
                    console.log(`[Bank Payment Monitor] Admin report result:`, adminReportResult);
                  } catch (error) {
                    console.error(`[Bank Payment Monitor] Error sending admin report:`, error);
                  }
              }
            }

            // Refresh user cache
            await refreshUserCache(payment.userId);
          }
        } else {
          // Check if payment was cancelled/failed
          // Use inquiry to check current status
          const inquiryResult = await zibalService.inquiryPayment(payment.trackId, ZIBAL_MERCHANT);
          
          if (inquiryResult.success && inquiryResult.status === -1) {
            // Payment cancelled
            if (payment.status === 'pending') {
              await mysql.query(`
                UPDATE transactions 
                SET status = 'cancelled',
                    description = ?
                WHERE id = ?
              `, [
                inquiryResult.message || 'Payment cancelled',
                payment.transactionId
              ]);

              // Update order if exists
              if (payment.orderId && payment.orderId.startsWith('OS')) {
                await mysql.query(`
                  UPDATE orders 
                  SET status = 'cancelled'
                  WHERE orderNumber = ? AND status = 'pending'
                `, [payment.orderId]);
              }

              console.log(`[Bank Payment Monitor] Payment cancelled for transaction ${payment.transactionId}`);
            }
          }
        }
      } catch (error) {
        console.error(`[Bank Payment Monitor] Error checking payment ${payment.transactionId}:`, error);
      }
    }
    
    const count = pendingPayments?.length || 0;
    if (count > 0) {
      console.log(`[Bank Payment Monitor] ✓ Checked ${count} pending payment(s)`);
    }
  } catch (error) {
    console.error('[Bank Payment Monitor] Error in checkPendingBankPayments:', error);
  }
};

const scheduleNextCheck = () => {
  if (monitoringTimeout) {
    clearTimeout(monitoringTimeout);
  }

  const interval = getRandomInterval();
  const intervalSeconds = Math.floor(interval / 1000);
  
  monitoringTimeout = setTimeout(() => {
    checkPendingBankPayments().then(() => {
      scheduleNextCheck(); // Schedule next check with new random interval
    }).catch((error) => {
      console.error('[Bank Payment Monitor] Error in scheduled check:', error);
      scheduleNextCheck(); // Continue monitoring even on error
    });
  }, interval);

  console.log(`[Bank Payment Monitor] Next check scheduled in ${intervalSeconds} seconds`);
};

const startMonitoring = () => {
  if (monitoringTimeout) {
    console.log('[Bank Payment Monitor] Monitoring already started');
    return;
  }

  // Check immediately on start
  checkPendingBankPayments().then(() => {
    scheduleNextCheck();
  }).catch((error) => {
    console.error('[Bank Payment Monitor] Error in initial check:', error);
    scheduleNextCheck();
  });

  console.log('[Bank Payment Monitor] Started monitoring bank payments with random intervals (10-59 seconds)');
};

const stopMonitoring = () => {
  if (monitoringTimeout) {
    clearTimeout(monitoringTimeout);
    monitoringTimeout = null;
    console.log('[Bank Payment Monitor] Stopped monitoring');
  }
};

module.exports = {
  startMonitoring,
  stopMonitoring,
  checkPendingBankPayments
};

