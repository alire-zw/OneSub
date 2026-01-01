const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const { authenticate } = require('../middleware/auth');
const { generalRateLimiter } = require('../middleware/security');
const { getUserData } = require('../utils/userCache');
const nobitexService = require('../services/nobitexService');
const tronService = require('../services/tronService');

router.post('/tron/charge', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid amount. Amount must be a positive number'
      });
    }

    if (amount < 1000) {
      return res.status(400).json({
        status: 0,
        message: 'Minimum charge amount is 1000 Toman'
      });
    }

    if (amount > 100000000) {
      return res.status(400).json({
        status: 0,
        message: 'Maximum charge amount is 100,000,000 Toman'
      });
    }

    const user = await getUserData(userId);
    if (!user) {
      return res.status(404).json({
        status: 0,
        message: 'User not found'
      });
    }

    // Get TRX price from Nobitex
    const priceResult = await nobitexService.getTRXPrice();
    if (!priceResult.success) {
      return res.status(500).json({
        status: 0,
        message: priceResult.message || 'Failed to get TRX price'
      });
    }

    // Calculate TRX amount
    const trxAmount = nobitexService.calculateTrxAmount(amount, priceResult.price);

    // Create TRON wallet
    const walletResult = await tronService.createWallet();
    if (!walletResult.success) {
      return res.status(500).json({
        status: 0,
        message: walletResult.message || 'Failed to create TRON wallet'
      });
    }

    // Calculate expiration time (15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Create transaction record
    const orderId = `TRON-${userId}-${Date.now()}`;
    const trackId = Date.now();
    
    const insertTransactionQuery = `
      INSERT INTO transactions (userId, trackId, orderId, amount, status, paymentType, description)
      VALUES (?, ?, ?, ?, 'pending', 'tron', ?)
    `;
    
    const transactionResult = await mysql.query(insertTransactionQuery, [
      userId,
      trackId,
      orderId,
      amount * 10, // Convert to Rial for storage
      `TRON payment for user ${userId}`
    ]);

    const transactionId = transactionResult.insertId;

    // Create crypto record
    const insertCryptoQuery = `
      INSERT INTO crypto (userId, transactionId, walletAddress, privateKey, amountToman, amountTrx, trxPrice, status, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `;
    
    await mysql.query(insertCryptoQuery, [
      userId,
      transactionId,
      walletResult.address,
      walletResult.privateKey,
      amount,
      trxAmount,
      priceResult.price,
      expiresAt
    ]);

    res.json({
      status: 1,
      message: 'TRON payment request created successfully',
      data: {
        walletAddress: walletResult.address,
        amountToman: amount,
        amountTrx: trxAmount,
        trxPrice: priceResult.price,
        expiresAt: expiresAt.toISOString(),
        trackId: trackId,
        orderId: orderId
      }
    });
  } catch (error) {
    console.error('Error creating TRON charge request:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// Public endpoint to get payment info by trackId (no auth required for payment page)
router.get('/tron/payment/:trackId', generalRateLimiter, async (req, res) => {
  try {
    const { trackId } = req.params;

    const trackIdNum = parseInt(trackId);
    if (isNaN(trackIdNum)) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid trackId'
      });
    }

    const query = `
      SELECT 
        t.id,
        t.trackId,
        t.orderId,
        t.amount,
        t.status,
        t.paymentType,
        t.createdAt,
        t.paidAt,
        c.walletAddress,
        c.amountToman,
        c.amountTrx,
        c.trxPrice,
        c.status as cryptoStatus,
        c.expiresAt,
        c.completedAt,
        o.orderNumber,
        o.productId
      FROM transactions t
      LEFT JOIN crypto c ON t.id = c.transactionId
      LEFT JOIN orders o ON o.transactionId = t.id
      WHERE t.trackId = ? AND t.paymentType = 'tron'
    `;

    const results = await mysql.query(query, [trackIdNum]);
    
    if (results.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Transaction not found'
      });
    }

    const transaction = results[0];
    
    // Determine orderNumber: if orderNumber exists from orders table, use it; otherwise use orderId if it starts with "OS"
    let orderNumber = transaction.orderNumber || null;
    if (!orderNumber && transaction.orderId && transaction.orderId.startsWith('OS')) {
      orderNumber = transaction.orderId;
    }

    res.json({
      status: 1,
      message: 'Payment information retrieved successfully',
      data: {
        trackId: transaction.trackId,
        orderId: transaction.orderId,
        orderNumber: orderNumber,
        productId: transaction.productId,
        amountToman: transaction.amountToman ? transaction.amountToman : transaction.amount / 10,
        amountTrx: transaction.amountTrx,
        trxPrice: transaction.trxPrice,
        walletAddress: transaction.walletAddress,
        status: transaction.status,
        cryptoStatus: transaction.cryptoStatus,
        expiresAt: transaction.expiresAt,
        completedAt: transaction.completedAt,
        paidAt: transaction.paidAt,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting TRON payment info:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// Public endpoint to check payment status by wallet address (for order payments)
router.get('/tron/wallet/:walletAddress', generalRateLimiter, async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({
        status: 0,
        message: 'Wallet address is required'
      });
    }

    // Find order by wallet address
    const orderQuery = `
      SELECT 
        o.id as orderId,
        o.orderNumber,
        o.productId,
        o.userId,
        o.status as orderStatus,
        o.paymentMethod,
        o.createdAt,
        o.completedAt,
        t.id as transactionId,
        t.trackId,
        t.status as transactionStatus,
        t.paidAt,
        c.amountToman,
        c.amountTrx,
        c.trxPrice,
        c.status as cryptoStatus,
        c.expiresAt,
        c.completedAt as cryptoCompletedAt
      FROM orders o
      LEFT JOIN transactions t ON o.transactionId = t.id
      LEFT JOIN crypto c ON t.id = c.transactionId
      WHERE o.walletAddress = ? 
      AND o.paymentMethod = 'crypto'
      ORDER BY o.createdAt DESC
      LIMIT 1
    `;

    const orderResults = await mysql.query(orderQuery, [walletAddress]);
    
    if (orderResults.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Order not found for this wallet address'
      });
    }

    const order = orderResults[0];

    res.json({
      status: 1,
      message: 'Order information retrieved successfully',
      data: {
        orderNumber: order.orderNumber,
        productId: order.productId,
        orderStatus: order.orderStatus,
        transactionStatus: order.transactionStatus || 'pending',
        cryptoStatus: order.cryptoStatus || 'pending',
        amountToman: order.amountToman,
        amountTrx: order.amountTrx,
        trxPrice: order.trxPrice,
        trackId: order.trackId,
        expiresAt: order.expiresAt,
        completedAt: order.completedAt || order.cryptoCompletedAt,
        paidAt: order.paidAt
      }
    });
  } catch (error) {
    console.error('Error getting order by wallet address:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

router.get('/tron/status/:trackId', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { trackId } = req.params;

    const trackIdNum = parseInt(trackId);
    if (isNaN(trackIdNum)) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid trackId'
      });
    }

    const query = `
      SELECT 
        t.id,
        t.trackId,
        t.orderId,
        t.amount,
        t.status,
        t.paymentType,
        t.createdAt,
        t.paidAt,
        c.walletAddress,
        c.amountToman,
        c.amountTrx,
        c.trxPrice,
        c.status as cryptoStatus,
        c.expiresAt,
        c.completedAt
      FROM transactions t
      LEFT JOIN crypto c ON t.id = c.transactionId
      WHERE t.trackId = ? AND t.userId = ?
    `;

    const results = await mysql.query(query, [trackIdNum, userId]);
    
    if (results.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Transaction not found'
      });
    }

    const transaction = results[0];

    res.json({
      status: 1,
      message: 'Transaction status retrieved successfully',
      data: {
        trackId: transaction.trackId,
        orderId: transaction.orderId,
        amountToman: transaction.amountToman ? transaction.amountToman : transaction.amount / 10,
        amountTrx: transaction.amountTrx,
        trxPrice: transaction.trxPrice,
        walletAddress: transaction.walletAddress,
        status: transaction.status,
        cryptoStatus: transaction.cryptoStatus,
        expiresAt: transaction.expiresAt,
        completedAt: transaction.completedAt,
        paidAt: transaction.paidAt,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting TRON status:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

