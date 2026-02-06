const mysql = require('../database/mysql');
const tronService = require('../services/tronService');
const { refreshUserCache } = require('../utils/userCache');
const nobitexService = require('../services/nobitexService');

let monitoringInterval = null;

const checkPendingPayments = async () => {
  try {
    // Get all pending crypto payments that haven't expired
    const query = `
      SELECT 
        c.id,
        c.userId,
        c.transactionId,
        c.walletAddress,
        c.privateKey,
        c.amountToman,
        c.amountTrx,
        c.expiresAt,
        t.amount as transactionAmount,
        t.orderId
      FROM crypto c
      INNER JOIN transactions t ON c.transactionId = t.id
      WHERE c.status = 'pending'
      AND t.status = 'pending'
      AND c.expiresAt > NOW()
    `;

    const pendingPayments = await mysql.query(query);

    // Also check orders with pending crypto payments directly by wallet address
    // This is a fallback in case transaction/crypto record has issues
    const ordersWithPendingCryptoQuery = `
      SELECT 
        o.id as orderId,
        o.orderNumber,
        o.userId,
        o.amount,
        o.walletAddress,
        o.status as orderStatus
      FROM orders o
      WHERE o.paymentMethod = 'crypto'
      AND o.status = 'pending'
      AND o.walletAddress IS NOT NULL
      AND o.walletAddress != ''
      AND o.createdAt > DATE_SUB(NOW(), INTERVAL 20 MINUTE)
    `;

    const pendingOrders = await mysql.query(ordersWithPendingCryptoQuery);

    // Check wallet addresses from orders directly
    for (const order of pendingOrders) {
      try {
        const balanceResult = await tronService.getBalance(order.walletAddress);
        
        if (balanceResult.success && balanceResult.balanceInTrx > 0) {
          // Find corresponding crypto record if exists
          const cryptoQuery = `
            SELECT c.id, c.transactionId, c.amountTrx, c.amountToman
            FROM crypto c
            INNER JOIN transactions t ON c.transactionId = t.id
            WHERE c.walletAddress = ? AND c.status = 'pending'
            LIMIT 1
          `;
          const cryptoRecords = await mysql.query(cryptoQuery, [order.walletAddress]);
          
          let expectedAmount = null;
          
          if (cryptoRecords && cryptoRecords.length > 0) {
            const crypto = cryptoRecords[0];
            expectedAmount = parseFloat(crypto.amountTrx);
          } else {
            // If crypto record doesn't exist, calculate expected amount from order amount
            // Get current TRX price
            const priceResult = await nobitexService.getTRXPrice();
            if (priceResult.success) {
              const amountInToman = order.amount / 10; // Convert from Rial to Toman
              expectedAmount = nobitexService.calculateTrxAmount(amountInToman, priceResult.price);
            }
          }
          
          if (expectedAmount) {
            const tolerance = expectedAmount * 0.05;
            
            if (Math.abs(balanceResult.balanceInTrx - expectedAmount) <= tolerance || 
                balanceResult.balanceInTrx >= expectedAmount) {
              // Payment received for this order via wallet address check
              // Update order status
              const updateOrderQuery = `
                UPDATE orders 
                SET status = 'completed', 
                    paidAmount = amount,
                    completedAt = NOW()
                WHERE id = ? AND status = 'pending'
              `;
              await mysql.query(updateOrderQuery, [order.orderId]);
              console.log(`[Crypto Monitor] Order ${order.orderNumber} completed via wallet address check`);
              
              // Also update crypto and transaction if they exist
              if (cryptoRecords && cryptoRecords.length > 0) {
                const crypto = cryptoRecords[0];
                await mysql.query(`
                  UPDATE transactions 
                  SET status = 'completed', paidAt = NOW()
                  WHERE id = ? AND status = 'pending'
                `, [crypto.transactionId]);
                
                await mysql.query(`
                  UPDATE crypto 
                  SET status = 'completed', completedAt = NOW()
                  WHERE id = ? AND status = 'pending'
                `, [crypto.id]);
              }
              
              await refreshUserCache(order.userId);

              // ارسال نوتیفیکیشن‌ها و گزارش ادمین
              try {
                const telegramBot = require('./telegramBot');
                const notificationService = require('./notificationService');
                
                // دریافت اطلاعات سفارش و محصول
                const orderQuery = `
                  SELECT o.*, p.productName 
                  FROM orders o
                  LEFT JOIN products p ON o.productId = p.id
                  WHERE o.id = ?
                `;
                const orders = await mysql.query(orderQuery, [order.orderId]);
                
                if (orders && orders.length > 0) {
                  const orderData = orders[0];
                  const productName = orderData.productName || 'نامشخص';
                  const amountInToman = Math.floor(orderData.amount / 10);

                  // دریافت اطلاعات کاربر
                  const userQuery = 'SELECT telegramID, phoneNumber FROM users WHERE id = ?';
                  const users = await mysql.query(userQuery, [order.userId]);
                  
                  if (users && users.length > 0) {
                    const user = users[0];

                    // ارسال نوتیفیکیشن تلگرام
                    if (user.telegramID) {
                      await telegramBot.sendOrderCompletionNotification(
                        user.telegramID,
                        order.orderNumber,
                        productName,
                        amountInToman
                      );
                    }

                    // ایجاد نوتیفیکیشن درون اپ
                    const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
                    await notificationService.createNotification(
                      order.userId,
                      'order',
                      'خرید شما موفق بود',
                      `سفارش شما با شماره ${order.orderNumber} با موفقیت ثبت و پرداخت شد.\n\n🛍️ محصول: ${productName}\n💵 مبلغ: ${amountInToman.toLocaleString('fa-IR')} تومان\n\n✅ پس از تایید توسط کارشناسان ما، وضعیت سفارش شما تغییر خواهد کرد و محصول به شما تحویل داده خواهد شد.`,
                      `${frontendUrl}/dashboard`
                    );

                    // ارسال گزارش ادمین
                    await telegramBot.sendAdminOrderReport(
                      order.userId,
                      order.orderNumber,
                      productName,
                      amountInToman,
                      'Cryptocurrency',
                      order.walletAddress
                    );

                    // گزارش کانال دوم (گزارش خرید کاربران)
                    try {
                      await telegramBot.sendSecondChannelOrderReport(order.userId, order.orderNumber);
                    } catch (secondChannelError) {
                      console.error('[Crypto Monitor] Error sending second channel order report:', secondChannelError);
                    }
                  }
                }
              } catch (error) {
                console.error(`[Crypto Monitor] Error sending order completion notifications:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error(`[Crypto Monitor] Error checking order ${order.orderNumber} wallet:`, error);
      }
    }

    for (const payment of pendingPayments) {
      try {
        // Check wallet balance
        const balanceResult = await tronService.getBalance(payment.walletAddress);
        
        if (balanceResult.success && balanceResult.balanceInTrx > 0) {
          // Payment received!
          const receivedAmount = balanceResult.balanceInTrx;
          const expectedAmount = parseFloat(payment.amountTrx);
          
          // Check if received amount is close to expected amount (with 5% tolerance)
          const tolerance = expectedAmount * 0.05;
          if (Math.abs(receivedAmount - expectedAmount) <= tolerance || receivedAmount >= expectedAmount) {
            // Update transaction status
            const updateTransactionQuery = `
              UPDATE transactions 
              SET status = 'completed', 
                  paidAt = NOW()
              WHERE id = ?
            `;
            await mysql.query(updateTransactionQuery, [payment.transactionId]);

            // Update crypto status
            const updateCryptoQuery = `
              UPDATE crypto 
              SET status = 'completed', 
                  completedAt = NOW()
              WHERE id = ?
            `;
            await mysql.query(updateCryptoQuery, [payment.id]);

            // Check if this transaction is for an order (orderNumber starts with "OS")
            const transactionQuery = `SELECT orderId FROM transactions WHERE id = ?`;
            const transactionResult = await mysql.query(transactionQuery, [payment.transactionId]);
            
            if (transactionResult && transactionResult.length > 0) {
              const orderIdFromTransaction = transactionResult[0].orderId;
              
              // Check if orderId is an order number (starts with "OS") or a wallet charge order
              if (orderIdFromTransaction && orderIdFromTransaction.startsWith('OS')) {
                // This is a direct purchase order, not a wallet charge
                // Update the order status to completed
                const updateOrderQuery = `
                  UPDATE orders 
                  SET status = 'completed', 
                      paidAmount = amount,
                      completedAt = NOW()
                  WHERE orderNumber = ? AND status = 'pending'
                `;
                await mysql.query(updateOrderQuery, [orderIdFromTransaction]);
                console.log(`[Crypto Monitor] Order ${orderIdFromTransaction} completed`);

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
                  const orders = await mysql.query(orderQuery, [orderIdFromTransaction]);
                  
                  if (orders && orders.length > 0) {
                    const orderData = orders[0];
                    const productName = orderData.productName || 'نامشخص';
                    const amountInToman = Math.floor(orderData.amount / 10);

                    // دریافت اطلاعات کاربر
                    const userQuery = 'SELECT telegramID, phoneNumber FROM users WHERE id = ?';
                    const users = await mysql.query(userQuery, [payment.userId]);
                    
                    if (users && users.length > 0) {
                      const user = users[0];

                      // ارسال نوتیفیکیشن تلگرام
                      if (user.telegramID) {
                        await telegramBot.sendOrderCompletionNotification(
                          user.telegramID,
                          orderIdFromTransaction,
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
                        `سفارش شما با شماره ${orderIdFromTransaction} با موفقیت ثبت و پرداخت شد.\n\n🛍️ محصول: ${productName}\n💵 مبلغ: ${amountInToman.toLocaleString('fa-IR')} تومان\n\n✅ پس از تایید توسط کارشناسان ما، وضعیت سفارش شما تغییر خواهد کرد و محصول به شما تحویل داده خواهد شد.`,
                        `${frontendUrl}/dashboard`
                      );

                      // ارسال گزارش ادمین
                      await telegramBot.sendAdminOrderReport(
                        payment.userId,
                        orderIdFromTransaction,
                        productName,
                        amountInToman,
                        'Cryptocurrency',
                        payment.walletAddress
                      );

                      // گزارش کانال دوم (گزارش خرید کاربران)
                      try {
                        await telegramBot.sendSecondChannelOrderReport(payment.userId, orderIdFromTransaction);
                      } catch (secondChannelError) {
                        console.error('[Crypto Monitor] Error sending second channel order report:', secondChannelError);
                      }
                    }
                  }
                } catch (error) {
                  console.error(`[Crypto Monitor] Error sending order completion notifications:`, error);
                }
              } else {
                // This is a wallet charge, update wallet balance
            const amountInRial = payment.amountToman * 10;
                const amountInToman = payment.amountToman;
            const updateWalletQuery = `
              UPDATE users 
              SET walletBalance = walletBalance + ? 
              WHERE id = ?
            `;
            await mysql.query(updateWalletQuery, [amountInRial, payment.userId]);
                console.log(`[Crypto Monitor] Wallet charged for user ${payment.userId}`);

                // Get user data for notifications
                const telegramBot = require('./telegramBot');
                const smsService = require('./smsService');
                const notificationService = require('./notificationService');
                
                const userQuery = `SELECT telegramID, phoneNumber FROM users WHERE id = ?`;
                const users = await mysql.query(userQuery, [payment.userId]);
                
                if (users && users.length > 0) {
                  const user = users[0];
                  
                  // Send Telegram notification if user has telegramID
                  if (user.telegramID) {
                    try {
                      await telegramBot.sendWalletChargeNotification(user.telegramID, amountInToman, null);
                    } catch (error) {
                      console.error(`[Crypto Monitor] Error sending Telegram notification:`, error);
                    }
                  }
                  
                  // Send SMS notification if user has phoneNumber
                  if (user.phoneNumber) {
                    try {
                      await smsService.sendWalletChargeSMS(user.phoneNumber, amountInToman);
                    } catch (error) {
                      console.error(`[Crypto Monitor] Error sending SMS notification:`, error);
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
                    console.error(`[Crypto Monitor] Error creating in-app notification:`, error);
                  }

                  // Send admin channel report
                  try {
                    await telegramBot.sendAdminChargeReport(
                      payment.userId,
                      amountInToman,
                      'Cryptocurrency',
                      null,
                      payment.walletAddress
                    );
                  } catch (error) {
                    console.error(`[Crypto Monitor] Error sending admin report:`, error);
                  }
                }
              }
            }

            // Refresh user cache
            await refreshUserCache(payment.userId);

            // Send remaining balance to master wallet
            const sendResult = await tronService.sendToMaster(payment.privateKey);
            if (sendResult.success) {
              console.log(`[Crypto Monitor] Payment completed for user ${payment.userId}, transaction ${payment.transactionId}. Sent to master wallet: ${sendResult.txid}`);
            } else {
              console.error(`[Crypto Monitor] Failed to send to master wallet for transaction ${payment.transactionId}:`, sendResult.message);
            }

            console.log(`[Crypto Monitor] Payment completed for user ${payment.userId}, transaction ${payment.transactionId}`);
          }
        }
      } catch (error) {
        console.error(`[Crypto Monitor] Error checking payment ${payment.id}:`, error);
      }
    }

    // Check for expired payments
    const expiredQuery = `
      SELECT c.id, c.transactionId, c.userId
      FROM crypto c
      INNER JOIN transactions t ON c.transactionId = t.id
      WHERE c.status = 'pending'
      AND t.status = 'pending'
      AND c.expiresAt <= NOW()
    `;

    const expiredPayments = await mysql.query(expiredQuery);

    for (const payment of expiredPayments) {
      // Mark as expired
      await mysql.query(`
        UPDATE crypto 
        SET status = 'expired' 
        WHERE id = ?
      `, [payment.id]);

      await mysql.query(`
        UPDATE transactions 
        SET status = 'cancelled' 
        WHERE id = ?
      `, [payment.transactionId]);

      console.log(`[Crypto Monitor] Payment expired for transaction ${payment.transactionId}`);
    }
  } catch (error) {
    console.error('[Crypto Monitor] Error in checkPendingPayments:', error);
  }
};

const startMonitoring = () => {
  if (monitoringInterval) {
    console.log('[Crypto Monitor] Monitoring already started');
    return;
  }

  // Check immediately on start
  checkPendingPayments();

  // Then check every 30 seconds
  monitoringInterval = setInterval(checkPendingPayments, 30 * 1000);
  console.log('[Crypto Monitor] Started monitoring TRON payments (checking every 30 seconds)');
};

const stopMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[Crypto Monitor] Stopped monitoring');
  }
};

module.exports = {
  startMonitoring,
  stopMonitoring,
  checkPendingPayments
};

