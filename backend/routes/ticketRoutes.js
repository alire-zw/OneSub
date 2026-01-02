const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const { generalRateLimiter } = require('../middleware/security');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/validation');

// ==================== ADMIN ROUTES ====================

// دریافت لیست تمام تیکت‌ها (ادمین)
router.get('/admin/all', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const { status, type } = req.query;

    let query = `
      SELECT 
        t.*,
        u.userName,
        u.phoneNumber,
        o.orderNumber,
        p.productName,
        p.imagePath as productImagePath,
        (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticketId = t.id AND tm.senderType = 'admin') as adminMessageCount,
        (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticketId = t.id AND tm.senderType = 'user') as userMessageCount
      FROM tickets t
      LEFT JOIN users u ON t.userId = u.id
      LEFT JOIN orders o ON t.orderId = o.id
      LEFT JOIN products p ON o.productId = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (type) {
      query += ' AND t.type = ?';
      params.push(type);
    }

    query += ' ORDER BY t.updatedAt DESC, t.createdAt DESC';

    const tickets = await mysql.query(query, params);

    res.json({
      status: 1,
      message: 'Tickets fetched successfully',
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// دریافت یک تیکت خاص با پیام‌هایش (ادمین)
router.get('/admin/:id', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);

    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid ticket ID'
      });
    }

    // دریافت اطلاعات تیکت
    const ticketQuery = `
      SELECT 
        t.*,
        u.userName,
        u.phoneNumber,
        u.userEmail,
        o.orderNumber,
        p.productName,
        p.imagePath as productImagePath
      FROM tickets t
      LEFT JOIN users u ON t.userId = u.id
      LEFT JOIN orders o ON t.orderId = o.id
      LEFT JOIN products p ON o.productId = p.id
      WHERE t.id = ?
    `;

    const tickets = await mysql.query(ticketQuery, [ticketId]);

    if (tickets.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Ticket not found'
      });
    }

    const ticket = tickets[0];

    // دریافت پیام‌های تیکت
    const messagesQuery = `
      SELECT 
        tm.*,
        u.userName as senderName
      FROM ticket_messages tm
      LEFT JOIN users u ON tm.senderId = u.id AND tm.senderType = 'user'
      WHERE tm.ticketId = ?
      ORDER BY tm.createdAt ASC
    `;

    const messages = await mysql.query(messagesQuery, [ticketId]);

    res.json({
      status: 1,
      message: 'Ticket fetched successfully',
      data: {
        ...ticket,
        messages: messages
      }
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// ارسال پیام از طرف ادمین
router.post('/admin/:id/messages', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const adminId = req.user?.id || req.userId;
    const { message } = req.body;

    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid ticket ID'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        status: 0,
        message: 'Message is required'
      });
    }

    // بررسی وجود تیکت
    const ticket = await mysql.query(
      'SELECT id, status FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (ticket.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Ticket not found'
      });
    }

    // بررسی اینکه تیکت بسته نشده باشد
    if (ticket[0].status === 'closed') {
      return res.status(400).json({
        status: 0,
        message: 'Cannot send message to closed ticket'
      });
    }

    // افزودن پیام از ادمین
    const insertQuery = `
      INSERT INTO ticket_messages (ticketId, senderId, senderType, message)
      VALUES (?, ?, 'admin', ?)
    `;

    const result = await mysql.query(insertQuery, [
      ticketId,
      adminId,
      sanitizeInput(message)
    ]);

    // بروزرسانی وضعیت تیکت به pending (در انتظار پاسخ کاربر)
    await mysql.query(
      'UPDATE tickets SET status = "pending", updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [ticketId]
    );

    // دریافت پیام ایجاد شده
    const createdMessage = await mysql.query(
      'SELECT * FROM ticket_messages WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      status: 1,
      message: 'Message sent successfully',
      data: createdMessage[0]
    });
  } catch (error) {
    console.error('Error sending admin message:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// تغییر وضعیت تیکت (ادمین)
router.put('/admin/:id/status', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid ticket ID'
      });
    }

    if (!status || !['open', 'pending', 'closed'].includes(status)) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid status. Must be: open, pending, or closed'
      });
    }

    // بررسی وجود تیکت
    const ticket = await mysql.query(
      'SELECT id FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (ticket.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Ticket not found'
      });
    }

    // بروزرسانی وضعیت
    await mysql.query(
      'UPDATE tickets SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [status, ticketId]
    );

    res.json({
      status: 1,
      message: 'Ticket status updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// ==================== USER ROUTES ====================

// دریافت لیست تیکت‌های کاربر
router.get('/', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    const query = `
      SELECT 
        t.*,
        o.orderNumber,
        p.productName,
        p.imagePath as productImagePath
      FROM tickets t
      LEFT JOIN orders o ON t.orderId = o.id
      LEFT JOIN products p ON o.productId = p.id
      WHERE t.userId = ?
      ORDER BY t.createdAt DESC
    `;

    const tickets = await mysql.query(query, [userId]);

    res.json({
      status: 1,
      message: 'Tickets fetched successfully',
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// دریافت یک تیکت خاص با پیام‌هایش
router.get('/:id', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const userId = req.user?.id || req.userId;

    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid ticket ID'
      });
    }

    // دریافت اطلاعات تیکت
    const ticketQuery = `
      SELECT 
        t.*,
        o.orderNumber,
        p.productName,
        p.imagePath as productImagePath
      FROM tickets t
      LEFT JOIN orders o ON t.orderId = o.id
      LEFT JOIN products p ON o.productId = p.id
      WHERE t.id = ? AND t.userId = ?
    `;

    const tickets = await mysql.query(ticketQuery, [ticketId, userId]);

    if (tickets.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Ticket not found'
      });
    }

    const ticket = tickets[0];

    // دریافت پیام‌های تیکت
    const messagesQuery = `
      SELECT 
        tm.*,
        u.userName as senderName
      FROM ticket_messages tm
      LEFT JOIN users u ON tm.senderId = u.id AND tm.senderType = 'user'
      WHERE tm.ticketId = ?
      ORDER BY tm.createdAt ASC
    `;

    const messages = await mysql.query(messagesQuery, [ticketId]);

    res.json({
      status: 1,
      message: 'Ticket fetched successfully',
      data: {
        ...ticket,
        messages: messages
      }
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// ایجاد تیکت جدید
router.post('/', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { type, subject, message, orderId, orderNumber } = req.body;

    // اعتبارسنجی
    if (!type || !['sales', 'technical', 'product_support'].includes(type)) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid ticket type. Must be: sales, technical, or product_support'
      });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        status: 0,
        message: 'Subject is required'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        status: 0,
        message: 'Message is required'
      });
    }

    // اگر نوع پشتیبانی محصول است، باید orderId یا orderNumber داشته باشد
    if (type === 'product_support') {
      if (!orderId && !orderNumber) {
        return res.status(400).json({
          status: 0,
          message: 'Order ID or Order Number is required for product support tickets'
        });
      }

      // اگر orderNumber داده شده، orderId را پیدا کن
      let finalOrderId = orderId;
      if (orderNumber && !orderId) {
        const orders = await mysql.query(
          'SELECT id FROM orders WHERE orderNumber = ? AND userId = ?',
          [orderNumber, userId]
        );
        if (orders.length === 0) {
          return res.status(400).json({
            status: 0,
            message: 'Order not found'
          });
        }
        finalOrderId = orders[0].id;
      }

      // بررسی اینکه سفارش متعلق به کاربر است
      if (finalOrderId) {
        const orderCheck = await mysql.query(
          'SELECT id FROM orders WHERE id = ? AND userId = ?',
          [finalOrderId, userId]
        );
        if (orderCheck.length === 0) {
          return res.status(403).json({
            status: 0,
            message: 'You do not have access to this order'
          });
        }
      }
    }

    // ایجاد تیکت
    const insertQuery = `
      INSERT INTO tickets (userId, type, subject, message, orderId, orderNumber, status)
      VALUES (?, ?, ?, ?, ?, ?, 'open')
    `;

    const orderIdValue = type === 'product_support' ? (orderId || null) : null;
    const orderNumberValue = type === 'product_support' ? (orderNumber || null) : null;

    const result = await mysql.query(insertQuery, [
      userId,
      type,
      sanitizeInput(subject),
      sanitizeInput(message),
      orderIdValue,
      orderNumberValue
    ]);

    // ایجاد پیام اولیه از کاربر
    const messageInsertQuery = `
      INSERT INTO ticket_messages (ticketId, senderId, senderType, message)
      VALUES (?, ?, 'user', ?)
    `;

    await mysql.query(messageInsertQuery, [
      result.insertId,
      userId,
      sanitizeInput(message)
    ]);

    // دریافت تیکت ایجاد شده
    const createdTicket = await mysql.query(
      'SELECT * FROM tickets WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      status: 1,
      message: 'Ticket created successfully',
      data: createdTicket[0]
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// ارسال پیام جدید به تیکت (کاربر)
router.post('/:id/messages', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const userId = req.user?.id || req.userId;
    const { message } = req.body;

    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid ticket ID'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        status: 0,
        message: 'Message is required'
      });
    }

    // بررسی اینکه تیکت متعلق به کاربر است
    const ticket = await mysql.query(
      'SELECT id, status FROM tickets WHERE id = ? AND userId = ?',
      [ticketId, userId]
    );

    if (ticket.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Ticket not found'
      });
    }

    // بررسی اینکه تیکت بسته نشده باشد
    if (ticket[0].status === 'closed') {
      return res.status(400).json({
        status: 0,
        message: 'Cannot send message to closed ticket'
      });
    }

    // افزودن پیام
    const insertQuery = `
      INSERT INTO ticket_messages (ticketId, senderId, senderType, message)
      VALUES (?, ?, 'user', ?)
    `;

    const result = await mysql.query(insertQuery, [
      ticketId,
      userId,
      sanitizeInput(message)
    ]);

    // بروزرسانی updatedAt تیکت
    await mysql.query(
      'UPDATE tickets SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [ticketId]
    );

    // دریافت پیام ایجاد شده
    const createdMessage = await mysql.query(
      'SELECT * FROM ticket_messages WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      status: 1,
      message: 'Message sent successfully',
      data: createdMessage[0]
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// دریافت سفارشات کاربر برای انتخاب در تیکت
router.get('/orders/my-orders', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    const query = `
      SELECT 
        o.id,
        o.orderNumber,
        o.createdAt,
        o.deliveryStatus,
        p.productName,
        p.imagePath as productImagePath,
        p.category
      FROM orders o
      INNER JOIN products p ON o.productId = p.id
      WHERE o.userId = ?
      ORDER BY o.createdAt DESC
      LIMIT 50
    `;

    const orders = await mysql.query(query, [userId]);

    res.json({
      status: 1,
      message: 'Orders fetched successfully',
      data: orders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// بستن تیکت (کاربر)
router.put('/:id/close', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const userId = req.user?.id || req.userId;

    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid ticket ID'
      });
    }

    // بررسی اینکه تیکت متعلق به کاربر است
    const ticket = await mysql.query(
      'SELECT id FROM tickets WHERE id = ? AND userId = ?',
      [ticketId, userId]
    );

    if (ticket.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Ticket not found'
      });
    }

    // بستن تیکت
    await mysql.query(
      'UPDATE tickets SET status = "closed", updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [ticketId]
    );

    res.json({
      status: 1,
      message: 'Ticket closed successfully'
    });
  } catch (error) {
    console.error('Error closing ticket:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

