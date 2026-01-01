const express = require('express');
const router = express.Router();
const samanService = require('../services/samanService');

/**
 * دریافت دستی صورتحساب (برای تست)
 */
router.post('/fetch-bill', async (req, res) => {
  try {
    console.log('[Saman Routes] Manual bill fetch requested');
    
    await samanService.fetchManually();
    
    res.json({
      status: 1,
      message: 'Bill statement fetch initiated'
    });
  } catch (error) {
    console.error('[Saman Routes] Error in manual fetch:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Failed to fetch bill statement'
    });
  }
});

/**
 * دریافت وضعیت سرویس
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      status: 1,
      message: 'Saman service is running',
      data: {
        depositNumber: '9451-810-5024276-1',
        iban: 'IR850560945181005024276001',
        interval: '10 minutes',
        hasCredentials: !!(process.env.SAMAN_USERNAME && process.env.SAMAN_PASSWORD)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 0,
      message: error.message || 'Failed to get service status'
    });
  }
});

module.exports = router;

