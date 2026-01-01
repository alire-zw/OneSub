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
              } else {
                // This is a wallet charge, update wallet balance
                const amountInRial = payment.amountToman * 10;
                const updateWalletQuery = `
                  UPDATE users 
                  SET walletBalance = walletBalance + ? 
                  WHERE id = ?
                `;
                await mysql.query(updateWalletQuery, [amountInRial, payment.userId]);
                console.log(`[Crypto Monitor] Wallet charged for user ${payment.userId}`);
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

