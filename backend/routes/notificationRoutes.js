const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { generalRateLimiter } = require('../middleware/security');
const notificationService = require('../services/notificationService');

// Get user notifications
router.get('/', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    const notifications = await notificationService.getUserNotifications(userId, limit, offset, unreadOnly);

    res.json({
      status: 1,
      message: 'Notifications retrieved successfully',
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      status: 0,
      message: 'Internal server error'
    });
  }
});

// Get unread count
router.get('/unread-count', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const count = await notificationService.getUnreadCount(userId);

    res.json({
      status: 1,
      message: 'Unread count retrieved successfully',
      data: { count }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      status: 0,
      message: 'Internal server error'
    });
  }
});

// Mark notification as read
router.post('/:id/read', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const notificationId = parseInt(req.params.id);

    if (!notificationId) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid notification ID'
      });
    }

    await notificationService.markAsRead(notificationId, userId);

    res.json({
      status: 1,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      status: 0,
      message: 'Internal server error'
    });
  }
});

// Mark all notifications as read
router.post('/read-all', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    const result = await notificationService.markAllAsRead(userId);

    res.json({
      status: 1,
      message: 'All notifications marked as read',
      data: { updatedCount: result.updatedCount }
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      status: 0,
      message: 'Internal server error'
    });
  }
});

module.exports = router;

