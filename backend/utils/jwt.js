const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * ساخت JWT token برای کاربر
 * @param {Object} payload - داده‌های کاربر (userId, phoneNumber, etc.)
 * @returns {string} JWT token
 */
const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * بررسی و decode کردن JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} decoded payload یا null در صورت خطا
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * استخراج token از header Authorization
 * @param {Object} req - Express request object
 * @returns {string|null} token یا null
 */
const extractTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

module.exports = {
  signToken,
  verifyToken,
  extractTokenFromHeader,
};

