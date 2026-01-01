const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const mysql = require('../database/mysql');
const { getUserData } = require('../utils/userCache');

/**
 * Middleware برای بررسی authentication
 * token را از header استخراج می‌کند و verify می‌کند
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);

    if (!token) {
      console.log('[Auth] No token provided');
      return res.status(401).json({
        success: false,
        status: 0,
        message: 'Authentication token is required'
      });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      console.error('[Auth] Token verification failed');
      return res.status(401).json({
        success: false,
        status: 0,
        message: 'Invalid or expired token'
      });
    }

    if (!decoded.userId) {
      console.error('[Auth] Token missing userId:', decoded);
      return res.status(401).json({
        success: false,
        status: 0,
        message: 'Invalid token format'
      });
    }

    // بررسی وجود کاربر از cache یا دیتابیس
    // همیشه فقط با id چک می‌کنیم - userId در token همیشه معتبر است
    const user = await getUserData(decoded.userId);

    if (!user) {
      console.error('[Auth] User not found for userId:', decoded.userId);
      return res.status(401).json({
        success: false,
        status: 0,
        message: 'User not found'
      });
    }

    // اضافه کردن اطلاعات کاربر به request
    req.user = user;
    req.userId = decoded.userId;

    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    console.error('[Auth] Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      status: 0,
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Optional authentication - اگر token وجود داشت، کاربر را اضافه می‌کند
 * اما اگر نبود، خطا نمی‌دهد
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);

    if (token) {
      const decoded = verifyToken(token);

      if (decoded) {
        const user = await getUserData(decoded.userId);

        if (user) {
          req.user = user;
          req.userId = decoded.userId;
        }
      }
    }

    next();
  } catch (error) {
    // در optional auth، خطا را ignore می‌کنیم
    next();
  }
};

/**
 * Middleware برای بررسی اینکه کاربر admin است یا نه
 * باید بعد از authenticate استفاده شود
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        status: 0,
        message: 'Authentication required'
      });
    }

    if (user.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({
        status: 0,
        message: 'Admin access required'
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({
      status: 0,
      message: 'Internal server error during admin check'
    });
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAdmin
};

