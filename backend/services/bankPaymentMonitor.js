const mysql = require('../database/mysql');
const zibalService = require('./zibalService');
const { refreshUserCache } = require('../utils/userCache');

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
        t.createdAt
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
            } else if (!payment.orderId || !payment.orderId.startsWith('OS')) {
              // This is a wallet charge, update wallet balance
              const amountInRial = payment.amount; // Already in Rial
              const updateWalletQuery = `
                UPDATE users 
                SET walletBalance = walletBalance + ? 
                WHERE id = ?
              `;
              await mysql.query(updateWalletQuery, [amountInRial, payment.userId]);
              console.log(`[Bank Payment Monitor] Wallet charged for user ${payment.userId}`);
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

