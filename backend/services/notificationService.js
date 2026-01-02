const mysql = require('../database/mysql');

// Create notification
const createNotification = async (userId, type, title, message, link = null) => {
  try {
    const query = `
      INSERT INTO notifications (userId, type, title, message, link, isRead)
      VALUES (?, ?, ?, ?, ?, FALSE)
    `;
    
    const result = await mysql.query(query, [userId, type, title, message, link]);
    
    console.log(`[Notification Service] Notification created for user ${userId}, type: ${type}`);
    return {
      success: true,
      notificationId: result.insertId
    };
  } catch (error) {
    // If error is about invalid ENUM value, try with 'general' as fallback
    if (error.message && error.message.includes('ENUM')) {
      console.warn(`[Notification Service] Invalid type '${type}', falling back to 'general'`);
      try {
        const fallbackQuery = `
          INSERT INTO notifications (userId, type, title, message, link, isRead)
          VALUES (?, 'general', ?, ?, ?, FALSE)
        `;
        const result = await mysql.query(fallbackQuery, [userId, title, message, link]);
        console.log(`[Notification Service] Notification created with fallback type 'general' for user ${userId}`);
        return {
          success: true,
          notificationId: result.insertId
        };
      } catch (fallbackError) {
        console.error('[Notification Service] Error creating notification with fallback:', fallbackError);
        throw fallbackError;
      }
    }
    console.error('[Notification Service] Error creating notification:', error);
    throw error;
  }
};

// Get user notifications
const getUserNotifications = async (userId, limit = 50, offset = 0, unreadOnly = false) => {
  try {
    let query = `
      SELECT 
        id,
        type,
        title,
        message,
        link,
        isRead,
        createdAt,
        readAt
      FROM notifications
      WHERE userId = ?
    `;
    
    const params = [userId];
    
    if (unreadOnly) {
      query += ' AND isRead = FALSE';
    }
    
    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const notifications = await mysql.query(query, params);
    
    return notifications || [];
  } catch (error) {
    console.error('[Notification Service] Error fetching notifications:', error);
    throw error;
  }
};

// Mark notification as read
const markAsRead = async (notificationId, userId) => {
  try {
    const query = `
      UPDATE notifications 
      SET isRead = TRUE, readAt = NOW()
      WHERE id = ? AND userId = ?
    `;
    
    await mysql.query(query, [notificationId, userId]);
    
    return { success: true };
  } catch (error) {
    console.error('[Notification Service] Error marking notification as read:', error);
    throw error;
  }
};

// Mark all notifications as read
const markAllAsRead = async (userId) => {
  try {
    const query = `
      UPDATE notifications 
      SET isRead = TRUE, readAt = NOW()
      WHERE userId = ? AND isRead = FALSE
    `;
    
    const result = await mysql.query(query, [userId]);
    
    return { success: true, updatedCount: result.affectedRows };
  } catch (error) {
    console.error('[Notification Service] Error marking all notifications as read:', error);
    throw error;
  }
};

// Get unread count
const getUnreadCount = async (userId) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE userId = ? AND isRead = FALSE
    `;
    
    const result = await mysql.query(query, [userId]);
    
    return result[0]?.count || 0;
  } catch (error) {
    console.error('[Notification Service] Error getting unread count:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
};

