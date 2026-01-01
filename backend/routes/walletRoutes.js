const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const { generalRateLimiter } = require('../middleware/security');
const { authenticate } = require('../middleware/auth');
const zibalService = require('../services/zibalService');
const { getUserData } = require('../utils/userCache');

const ZIBAL_MERCHANT = process.env.ZIBAL_MERCHANT || 'zibal';
const BASE_URL = process.env.BASE_URL || process.env.BACKEND_URL || 'http://localhost:4536';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8903';

router.post('/charge', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { amount, mobile, nationalCode } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
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

    const orderId = `WLT-${userId}-${Date.now()}`;
    const callbackUrl = `${BASE_URL}/api/wallet/callback`;

    // Convert Toman to Rial for Zibal (Zibal expects amount in Rial)
    const amountInRial = amount * 10;

    const paymentOptions = {
      merchant: ZIBAL_MERCHANT,
      amount: amountInRial,
      callbackUrl: callbackUrl,
      description: `Wallet charge for user ${userId}`,
      orderId: orderId
    };

    if (mobile) paymentOptions.mobile = mobile;
    if (nationalCode) paymentOptions.nationalCode = nationalCode;

    const paymentResult = await zibalService.requestPayment(paymentOptions);

    if (!paymentResult.success) {
      return res.status(400).json({
        status: 0,
        message: paymentResult.message || 'Failed to create payment request',
        resultCode: paymentResult.resultCode
      });
    }

    // Store amount in Rial in database
    const insertQuery = `
      INSERT INTO transactions (userId, trackId, orderId, amount, status, description)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `;
    
    await mysql.query(insertQuery, [
      userId,
      paymentResult.trackId,
      orderId,
      amountInRial,
      paymentOptions.description
    ]);

    const paymentUrl = zibalService.getPaymentUrl(paymentResult.trackId);

    res.json({
      status: 1,
      message: 'Payment request created successfully',
      data: {
        trackId: paymentResult.trackId,
        paymentUrl: paymentUrl,
        amount: amount,
        orderId: orderId
      }
    });
  } catch (error) {
    console.error('Error creating charge request:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { trackId, success, status, orderId } = req.query;

    if (!trackId) {
      return res.status(400).send('TrackId is required');
    }

    const trackIdNum = parseInt(trackId);
    if (isNaN(trackIdNum)) {
      return res.status(400).send('Invalid TrackId');
    }

    const verifyResult = await zibalService.verifyPayment(trackIdNum, ZIBAL_MERCHANT);

    const transactionQuery = `SELECT * FROM transactions WHERE trackId = ?`;
    const transactions = await mysql.query(transactionQuery, [trackIdNum]);
    
    if (transactions.length === 0) {
      return res.status(404).send('Transaction not found');
    }

    const transaction = transactions[0];

    if (verifyResult.success) {
      if (transaction.status === 'pending') {
        const updateTransactionQuery = `
          UPDATE transactions 
          SET status = 'completed', 
              refNumber = ?, 
              cardNumber = ?, 
              paidAt = ?,
              description = ?
          WHERE trackId = ?
        `;
        
        await mysql.query(updateTransactionQuery, [
          verifyResult.refNumber,
          verifyResult.cardNumber,
          verifyResult.paidAt ? new Date(verifyResult.paidAt) : new Date(),
          verifyResult.description || transaction.description,
          trackIdNum
        ]);

        const updateWalletQuery = `
          UPDATE users 
          SET walletBalance = walletBalance + ? 
          WHERE id = ?
        `;
        
        await mysql.query(updateWalletQuery, [verifyResult.amount, transaction.userId]);
        
        const { refreshUserCache } = require('../utils/userCache');
        await refreshUserCache(transaction.userId);
      }

      const amountToman = Math.floor(verifyResult.amount / 10);
      const redirectUrl = `${FRONTEND_URL}/wallet?success=1&trackId=${trackId}&amount=${amountToman}&paidAt=${encodeURIComponent(verifyResult.paidAt || new Date().toISOString())}`;
      
      res.redirect(redirectUrl);
    } else {
      if (transaction.status === 'pending') {
        const updateTransactionQuery = `
          UPDATE transactions 
          SET status = 'failed',
              description = ?
          WHERE trackId = ?
        `;
        
        await mysql.query(updateTransactionQuery, [
          verifyResult.message || 'Payment verification failed',
          trackIdNum
        ]);
      }

      const redirectUrl = `${FRONTEND_URL}/wallet?success=0&trackId=${trackId}`;
      
      res.redirect(redirectUrl);
    }
  } catch (error) {
    console.error('Error in payment callback:', error);
    const trackId = req.query.trackId || '';
    const redirectUrl = `${FRONTEND_URL}/wallet?success=0&trackId=${trackId}&error=${encodeURIComponent(error.message)}`;
    res.redirect(redirectUrl);
  }
});

router.get('/balance', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const user = await getUserData(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 0,
        message: 'User not found'
      });
    }

    res.json({
      status: 1,
      message: 'Balance retrieved successfully',
      data: {
        balance: user.walletBalance || 0
      }
    });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

router.get('/transactions', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { page = 1, limit = 20, status } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT id, trackId, orderId, amount, status, paymentType, refNumber, cardNumber, 
             description, paidAt, createdAt, updatedAt
      FROM transactions 
      WHERE userId = ?
    `;
    const params = [userId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const transactions = await mysql.query(query, params);
    
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM transactions 
      WHERE userId = ?
    `;
    const countParams = [userId];
    
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    const countResult = await mysql.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;
    
    res.json({
      status: 1,
      message: 'Transactions retrieved successfully',
      data: {
        transactions: transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

