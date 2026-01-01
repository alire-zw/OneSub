const express = require('express');
const router = express.Router();
const smsService = require('../services/smsService');
const redis = require('../database/redis');
const { smsRateLimiter, verifyRateLimiter } = require('../middleware/security');
const { validateSendOTP, validateVerifyOTP } = require('../middleware/validation');

const generateOTP = () => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

router.post('/send-otp', smsRateLimiter, validateSendOTP, async (req, res) => {
  try {
    const { mobile } = req.body;

    const otp = generateOTP();
    const otpKey = `otp:${mobile}`;
    const otpTTL = 300;

    console.log(`Generated OTP for ${mobile}: ${otp}`);
    const redisClient = await redis.connect();
    await redisClient.setEx(otpKey, otpTTL, otp);
    console.log(`OTP stored in Redis for ${mobile}, expires in ${otpTTL} seconds`);

    const smsResult = await smsService.sendOTP(mobile, otp);

    if (smsResult.success) {
      res.json({
        status: 1,
        message: 'OTP sent successfully',
        data: {
          expiresIn: otpTTL
        }
      });
    } else {
      await redisClient.del(otpKey);
      res.status(400).json({
        status: 0,
        message: smsResult.message || 'Failed to send OTP'
      });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

router.post('/verify-otp', verifyRateLimiter, validateVerifyOTP, async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    const otpKey = `otp:${mobile}`;
    const redisClient = await redis.connect();
    const storedOTP = await redisClient.get(otpKey);

    if (!storedOTP) {
      return res.status(400).json({
        status: 0,
        message: 'OTP expired or not found'
      });
    }

    if (storedOTP !== otp) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid OTP'
      });
    }

    await redisClient.del(otpKey);

    res.json({
      status: 1,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

