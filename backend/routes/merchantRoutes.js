const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generalRateLimiter } = require('../middleware/security');
const { sendMessage } = require('../services/smsService');

// ارسال درخواست همکاری
router.post('/request', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone, message } = req.body;

    // Validation
    if (!name || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'تمام فیلدها الزامی است'
      });
    }

    // بررسی اینکه کاربر قبلاً همکار است
    if (req.user.role?.toLowerCase() === 'merchants') {
      return res.status(400).json({
        success: false,
        message: 'شما در حال حاضر همکار هستید'
      });
    }

    // بررسی اینکه درخواست pending دارد
    const pendingRequest = await mysql.query(
      'SELECT id FROM merchants WHERE userId = ? AND status = ?',
      [userId, 'pending']
    );

    if (pendingRequest && pendingRequest.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'شما یک درخواست در حال بررسی دارید'
      });
    }

    // بررسی اینکه درخواست rejected دارد - اگر دارد، می‌تواند دوباره درخواست بدهد
    // درج درخواست جدید
    const insertQuery = `
      INSERT INTO merchants (userId, name, email, phone, message, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `;

    const result = await mysql.query(insertQuery, [
      userId,
      name.trim(),
      email.trim(),
      phone.trim(),
      message.trim()
    ]);

    res.json({
      success: true,
      message: 'درخواست شما با موفقیت ثبت شد و در حال بررسی است',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Error submitting merchant request:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در ثبت درخواست'
    });
  }
});

// بررسی وضعیت درخواست کاربر
router.get('/status', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;

    // بررسی role کاربر
    if (req.user.role?.toLowerCase() === 'merchants') {
      return res.json({
        success: true,
        status: 'approved',
        message: 'شما در حال حاضر همکار هستید'
      });
    }

    // بررسی آخرین درخواست
    const request = await mysql.query(
      `SELECT id, status, rejectionReason, createdAt, updatedAt 
       FROM merchants 
       WHERE userId = ? 
       ORDER BY createdAt DESC 
       LIMIT 1`,
      [userId]
    );

    if (!request || request.length === 0) {
      return res.json({
        success: true,
        status: 'none',
        message: 'درخواستی ثبت نشده است'
      });
    }

    const merchantRequest = request[0];

    res.json({
      success: true,
      status: merchantRequest.status,
      message: merchantRequest.status === 'pending' 
        ? 'درخواست شما در حال بررسی است' 
        : merchantRequest.status === 'approved'
        ? 'درخواست شما تایید شده است'
        : 'درخواست شما رد شده است',
      rejectionReason: merchantRequest.rejectionReason || null,
      createdAt: merchantRequest.createdAt,
      updatedAt: merchantRequest.updatedAt
    });
  } catch (error) {
    console.error('Error checking merchant status:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در بررسی وضعیت'
    });
  }
});

// دریافت لیست درخواست‌ها (admin)
router.get('/all', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT 
        m.id,
        m.userId,
        m.name,
        m.email,
        m.phone,
        m.message,
        m.status,
        m.rejectionReason,
        m.approvedBy,
        m.rejectedBy,
        m.createdAt,
        m.updatedAt,
        u.userName as userName,
        u.phoneNumber as userPhone,
        u.userEmail as userEmail,
        approver.userName as approverName,
        rejector.userName as rejectorName
      FROM merchants m
      LEFT JOIN users u ON m.userId = u.id
      LEFT JOIN users approver ON m.approvedBy = approver.id
      LEFT JOIN users rejector ON m.rejectedBy = rejector.id
    `;

    const params = [];

    if (status) {
      query += ' WHERE m.status = ?';
      params.push(status);
    }

    query += ' ORDER BY m.createdAt DESC';

    const requests = await mysql.query(query, params);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching merchant requests:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت درخواست‌ها'
    });
  }
});

// تایید درخواست (admin)
router.post('/:id/approve', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const requestId = req.params.id;
    const adminId = req.user.id;

    // بررسی وجود درخواست
    const request = await mysql.query(
      'SELECT * FROM merchants WHERE id = ?',
      [requestId]
    );

    if (!request || request.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'درخواست یافت نشد'
      });
    }

    const merchantRequest = request[0];

    if (merchantRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'این درخواست قبلاً پردازش شده است'
      });
    }

    // شروع transaction
    const connection = await mysql.getConnection();
    await connection.beginTransaction();

    try {
      // به‌روزرسانی وضعیت درخواست
      await connection.execute(
        `UPDATE merchants 
         SET status = 'approved', approvedBy = ?, updatedAt = NOW() 
         WHERE id = ?`,
        [adminId, requestId]
      );

      // تغییر role کاربر به merchants
      await connection.execute(
        `UPDATE users 
         SET role = 'merchants', lastActivity = NOW() 
         WHERE id = ?`,
        [merchantRequest.userId]
      );

      await connection.commit();

      // پاک کردن cache کاربر
      const { refreshUserCache } = require('../utils/userCache');
      await refreshUserCache(merchantRequest.userId);

      // ارسال پیامک به کاربر
      if (merchantRequest.phone) {
        try {
          await sendMessage(merchantRequest.phone, 'درخواست همکاری شما تایید شد. اکنون می‌توانید از قیمت‌های همکار استفاده کنید.');
        } catch (smsError) {
          console.error('Error sending SMS:', smsError);
          // ادامه می‌دهیم حتی اگر SMS ارسال نشد
        }
      }

      res.json({
        success: true,
        message: 'درخواست با موفقیت تایید شد'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error approving merchant request:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در تایید درخواست'
    });
  }
});

// رد درخواست (admin)
router.post('/:id/reject', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const requestId = req.params.id;
    const adminId = req.user.id;
    const { reason } = req.body;

    // بررسی وجود درخواست
    const request = await mysql.query(
      'SELECT * FROM merchants WHERE id = ?',
      [requestId]
    );

    if (!request || request.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'درخواست یافت نشد'
      });
    }

    const merchantRequest = request[0];

    if (merchantRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'این درخواست قبلاً پردازش شده است'
      });
    }

    // به‌روزرسانی وضعیت درخواست
    await mysql.query(
      `UPDATE merchants 
       SET status = 'rejected', rejectedBy = ?, rejectionReason = ?, updatedAt = NOW() 
       WHERE id = ?`,
      [adminId, reason || null, requestId]
    );

    // ارسال پیامک به کاربر
    if (merchantRequest.phone) {
      try {
        const smsMessage = reason 
          ? `درخواست همکاری شما رد شد. دلیل: ${reason}`
          : 'درخواست همکاری شما رد شد.';
        await sendMessage(merchantRequest.phone, smsMessage);
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
        // ادامه می‌دهیم حتی اگر SMS ارسال نشد
      }
    }

    res.json({
      success: true,
      message: 'درخواست با موفقیت رد شد'
    });
  } catch (error) {
    console.error('Error rejecting merchant request:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در رد درخواست'
    });
  }
});

module.exports = router;

