const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const redis = require('../database/redis');
const { generalRateLimiter, verifyRateLimiter } = require('../middleware/security');
const { validateMobile, sanitizeInput, validateVerifyOTP } = require('../middleware/validation');
const { signToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const { getUserData, refreshUserCache } = require('../utils/userCache');

const validateTelegramUser = (user) => {
  if (!user || typeof user !== 'object') return false;
  if (!user.id || typeof user.id !== 'number') return false;
  if (!user.first_name || typeof user.first_name !== 'string') return false;
  return true;
};

const getUserByPhoneNumber = async (phoneNumber) => {
  const query = `SELECT id, telegramID, userName, phoneNumber, userEmail, isPremium, loginInfo, role 
                 FROM users WHERE phoneNumber = ?`;
  const users = await mysql.query(query, [phoneNumber]);
  return users.length > 0 ? users[0] : null;
};

const createUserFromWebsite = async (phoneNumber) => {
  const existingUser = await getUserByPhoneNumber(phoneNumber);
  if (existingUser) {
    return {
      success: true,
      userId: existingUser.id,
      isNewUser: false
    };
  }

  const query = `
    INSERT INTO users (phoneNumber, loginInfo, role, userName, telegramID, userEmail, isPremium)
    VALUES (?, 'webSite', 'user', NULL, NULL, NULL, FALSE)
  `;
  
  try {
    const result = await mysql.query(query, [phoneNumber]);
    return {
      success: true,
      userId: result.insertId,
      isNewUser: true
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const existingUser = await getUserByPhoneNumber(phoneNumber);
      if (existingUser) {
        return {
          success: true,
          userId: existingUser.id,
          isNewUser: false
        };
      }
    }
    throw error;
  }
};

const getUserByTelegramID = async (telegramID) => {
  const query = `SELECT id, telegramID, userName, phoneNumber, userEmail, isPremium, loginInfo, role 
                 FROM users WHERE telegramID = ?`;
  const users = await mysql.query(query, [telegramID]);
  return users.length > 0 ? users[0] : null;
};

const createUserFromTelegram = async (telegramUser) => {
  const {
    id,
    first_name,
    last_name = '',
    username = null,
    language_code = null,
    is_premium = false,
    photo_url = null
  } = telegramUser;

  const existingUser = await getUserByTelegramID(id);
  if (existingUser) {
    return {
      success: true,
      userId: existingUser.id,
      isNewUser: false
    };
  }

  const userName = username || `${first_name}${last_name ? `_${last_name}` : ''}`.toLowerCase().replace(/\s+/g, '_');
  const userEmail = null;

  const query = `
    INSERT INTO users (
      telegramID, 
      userName, 
      phoneNumber, 
      userEmail, 
      isPremium, 
      loginInfo,
      role
    )
    VALUES (?, ?, NULL, ?, ?, 'telegramMiniApp', 'user')
  `;

  try {
    const result = await mysql.query(query, [
      id,
      userName,
      userEmail,
      is_premium
    ]);
    return {
      success: true,
      userId: result.insertId,
      isNewUser: true
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const existingUser = await getUserByTelegramID(id);
      if (existingUser) {
        return {
          success: true,
          userId: existingUser.id,
          isNewUser: false
        };
      }
    }
    throw error;
  }
};

router.post('/register', generalRateLimiter, async (req, res) => {
  try {
    console.log('Register request received:', {
      origin: req.headers.origin,
      method: req.method,
      body: req.body
    });
    
    const { phoneNumber, telegramUser } = req.body;

    if (telegramUser) {
      if (!validateTelegramUser(telegramUser)) {
        return res.status(400).json({
          status: 0,
          message: 'Invalid Telegram user data'
        });
      }

      const result = await createUserFromTelegram(telegramUser);
      return res.json({
        status: 1,
        message: result.isNewUser 
          ? 'User created successfully from Telegram' 
          : 'User already exists',
        data: {
          userId: result.userId
        }
      });
    }

    if (phoneNumber) {
      const sanitizedPhone = sanitizeInput(phoneNumber);
      
      if (!validateMobile(sanitizedPhone)) {
        return res.status(400).json({
          status: 0,
          message: 'Invalid mobile number format. Use 09xxxxxxxxx'
        });
      }

      const result = await createUserFromWebsite(sanitizedPhone);
      return res.json({
        status: 1,
        message: result.isNewUser 
          ? 'User created successfully from website' 
          : 'User already exists',
        data: {
          userId: result.userId
        }
      });
    }

    return res.status(400).json({
      status: 0,
      message: 'Either phoneNumber or telegramUser must be provided'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// Login with OTP endpoint
// Note: validateVerifyOTP middleware expects 'mobile' and 'otp' in req.body
// but we're using 'phoneNumber' in the frontend, so we'll handle it manually
router.post('/otp-login', verifyRateLimiter, async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        status: 0,
        message: 'Phone number and OTP are required'
      });
    }

    const sanitizedPhone = sanitizeInput(phoneNumber);
    const sanitizedOTP = sanitizeInput(otp);

    if (!validateMobile(sanitizedPhone)) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid mobile number format. Use 09xxxxxxxxx'
      });
    }

    // Validate OTP format
    const otpRegex = /^\d{5}$/;
    if (!otpRegex.test(sanitizedOTP)) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid OTP format. OTP must be 5 digits'
      });
    }

    // Verify OTP
    const otpKey = `otp:${sanitizedPhone}`;
    const redisClient = await redis.connect();
    const storedOTP = await redisClient.get(otpKey);

    if (!storedOTP) {
      return res.status(400).json({
        status: 0,
        message: 'OTP expired or not found'
      });
    }

    if (storedOTP !== sanitizedOTP) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid OTP'
      });
    }

    // OTP verified, delete it
    await redisClient.del(otpKey);

    // Create or get user
    const result = await createUserFromWebsite(sanitizedPhone);

    // Get user details for JWT payload and cache it
    const user = await getUserByPhoneNumber(sanitizedPhone);
    
    // Cache user data after login
    if (user) {
      await refreshUserCache(user.id);
    }
    
    // Create JWT token
    const token = signToken({
      userId: user.id,
      phoneNumber: user.phoneNumber,
      loginInfo: user.loginInfo
    });

    return res.json({
      status: 1,
      message: 'Login successful',
      data: {
        userId: result.userId,
        isNewUser: result.isNewUser,
        token: token
      }
    });
  } catch (error) {
    console.error('Error in OTP login:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// Telegram Mini App Auto Login endpoint
router.post('/telegram-login', generalRateLimiter, async (req, res) => {
  try {
    const { telegramUser } = req.body;

    if (!telegramUser) {
      return res.status(400).json({
        status: 0,
        message: 'Telegram user data is required'
      });
    }

    if (!validateTelegramUser(telegramUser)) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid Telegram user data'
      });
    }

    // Create or get user from Telegram
    const result = await createUserFromTelegram(telegramUser);
    
    // Get user details for JWT payload
    const user = await getUserByTelegramID(telegramUser.id);
    
    if (!user) {
      return res.status(500).json({
        status: 0,
        message: 'Failed to retrieve user data'
      });
    }
    
    // Cache user data after login
    await refreshUserCache(user.id);
    
    // Create JWT token
    const token = signToken({
      userId: user.id,
      phoneNumber: user.phoneNumber,
      loginInfo: user.loginInfo
    });

    return res.json({
      status: 1,
      message: 'Login successful',
      data: {
        userId: result.userId,
        isNewUser: result.isNewUser,
        token: token
      }
    });
  } catch (error) {
    console.error('Error in Telegram login:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// Get current user info endpoint
router.get('/me', authenticate, async (req, res) => {
  try {
    // @ts-ignore
    const userId = req.user.id || req.userId;
    
    // Get user data from cache (fast) - cache will be refreshed in background if needed
    const user = await getUserData(userId);
    
    if (!user) {
      return res.status(404).json({ status: 0, message: 'User not found' });
    }
    
    // Debug: Log role to help diagnose issues
    console.log(`[GET /me] User ${userId} role:`, user.role, 'Type:', typeof user.role);
    
    res.json({ status: 1, message: 'User data fetched successfully', data: user });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ status: 0, message: error.message || 'Internal server error' });
  }
});

// Update user profile endpoint
router.put('/profile', authenticate, generalRateLimiter, async (req, res) => {
  try {
    // @ts-ignore
    const userId = req.user.id || req.userId;
    const { userName, userEmail, phoneNumber } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (userName !== undefined) {
      updates.push('userName = ?');
      values.push(sanitizeInput(userName));
    }

    if (userEmail !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (userEmail && !emailRegex.test(userEmail)) {
        return res.status(400).json({ status: 0, message: 'Invalid email format' });
      }
      updates.push('userEmail = ?');
      values.push(userEmail ? sanitizeInput(userEmail) : null);
    }

    if (phoneNumber !== undefined) {
      // Validate phone format if provided
      if (phoneNumber && !validateMobile(phoneNumber)) {
        return res.status(400).json({ status: 0, message: 'Invalid mobile number format. Use 09xxxxxxxxx' });
      }
      updates.push('phoneNumber = ?');
      values.push(phoneNumber ? sanitizeInput(phoneNumber) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: 0, message: 'No fields to update' });
    }

    values.push(userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await mysql.query(query, values);

    // Refresh user cache with updated data
    const updatedUser = await refreshUserCache(userId);
    
    if (!updatedUser) {
      return res.status(404).json({ status: 0, message: 'User not found' });
    }

    res.json({
      status: 1,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ status: 0, message: error.message || 'Internal server error' });
  }
});

module.exports = router;

