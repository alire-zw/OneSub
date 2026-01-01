const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generalRateLimiter } = require('../middleware/security');

// دریافت لیست تراکنش‌های کاربر
router.get('/', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        id,
        userId,
        trackId,
        orderId,
        amount,
        status,
        paymentType,
        refNumber,
        cardNumber,
        description,
        paidAt,
        createdAt,
        updatedAt
      FROM transactions
      WHERE userId = ?
      ORDER BY createdAt DESC
    `;

    const transactions = await mysql.query(query, [userId]);

    res.json({
      status: 1,
      message: 'تراکنش‌ها با موفقیت دریافت شد',
      data: transactions || []
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      status: 0,
      message: 'خطا در دریافت تراکنش‌ها'
    });
  }
});

// دریافت آمار تراکنش‌های امروز (فقط برای ادمین)
router.get('/today-stats', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as totalAmount
      FROM transactions
      WHERE DATE(createdAt) = CURDATE()
      AND status IN ('completed', 'failed', 'cancelled')
      GROUP BY status
    `;

    const stats = await mysql.query(query);

    // فرمت کردن نتیجه
    const result = {
      completed: { count: 0, totalAmount: 0 },
      failed: { count: 0, totalAmount: 0 },
      cancelled: { count: 0, totalAmount: 0 }
    };

    stats.forEach(stat => {
      if (stat.status === 'completed') {
        result.completed.count = stat.count;
        result.completed.totalAmount = parseInt(stat.totalAmount) || 0;
      } else if (stat.status === 'failed') {
        result.failed.count = stat.count;
        result.failed.totalAmount = parseInt(stat.totalAmount) || 0;
      } else if (stat.status === 'cancelled') {
        result.cancelled.count = stat.count;
        result.cancelled.totalAmount = parseInt(stat.totalAmount) || 0;
      }
    });

    res.json({
      status: 1,
      message: 'آمار تراکنش‌های امروز با موفقیت دریافت شد',
      data: result
    });
  } catch (error) {
    console.error('Error fetching today stats:', error);
    res.status(500).json({
      status: 0,
      message: 'خطا در دریافت آمار تراکنش‌ها'
    });
  }
});

// دریافت لیست تمام تراکنش‌ها (فقط برای ادمین)
router.get('/all', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const query = `
      SELECT 
        t.id,
        t.userId,
        u.userName,
        u.phoneNumber,
        t.trackId,
        t.orderId,
        t.amount,
        t.status,
        t.paymentType,
        t.refNumber,
        t.cardNumber,
        t.description,
        t.paidAt,
        t.createdAt,
        t.updatedAt
      FROM transactions t
      LEFT JOIN users u ON t.userId = u.id
      ORDER BY t.createdAt DESC
    `;

    const transactions = await mysql.query(query);

    res.json({
      status: 1,
      message: 'تراکنش‌ها با موفقیت دریافت شد',
      data: transactions || []
    });
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    res.status(500).json({
      status: 0,
      message: 'خطا در دریافت تراکنش‌ها'
    });
  }
});

module.exports = router;

