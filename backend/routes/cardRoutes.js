const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const { authenticate } = require('../middleware/auth');
const { generalRateLimiter } = require('../middleware/security');
const { cardToIban } = require('../services/zibalService');

// تبدیل شماره کارت به شبا
router.post('/card-to-iban', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const { cardNumber } = req.body;

    if (!cardNumber) {
      return res.status(400).json({
        success: false,
        message: 'شماره کارت الزامی است'
      });
    }

    // حذف کاراکترهای غیر عددی از شماره کارت
    const cleanCardNumber = cardNumber.replace(/[^\d]/g, '');

    if (cleanCardNumber.length !== 16) {
      return res.status(400).json({
        success: false,
        message: 'شماره کارت باید 16 رقم باشد'
      });
    }

    // دریافت کلید API از متغیرهای محیطی
    const apiKey = process.env.ZIBAL_FACILITY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'کلید API تنظیم نشده است'
      });
    }

    // فراخوانی سرویس تبدیل کارت به شبا
    const result = await cardToIban(cleanCardNumber, apiKey);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'خطا در تبدیل کارت به شبا',
        resultCode: result.resultCode
      });
    }
  } catch (error) {
    console.error('Error converting card to IBAN:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در تبدیل کارت به شبا'
    });
  }
});

// دریافت لیست کارت‌های کاربر
router.get('/', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT id, userId, cardName, cardNumber, shebaNumber, bankName, createdAt, updatedAt
      FROM cards
      WHERE userId = ?
      ORDER BY createdAt DESC
    `;

    const cards = await mysql.query(query, [userId]);

    res.json({
      success: true,
      cards: cards
    });
  } catch (error) {
    console.error('Error fetching bank cards:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت کارت‌های بانکی'
    });
  }
});

// اضافه کردن کارت جدید
router.post('/', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { cardName, cardNumber, shebaNumber, bankName } = req.body;

    console.log('[Card Routes] Add card request:', {
      userId,
      cardNumber: cardNumber ? cardNumber.replace(/\d(?=\d{4})/g, '*') : null,
      bankName,
      hasSheba: !!shebaNumber
    });

    // Validation
    if (!cardNumber || !bankName) {
      console.log('[Card Routes] Validation failed: missing cardNumber or bankName');
      return res.status(400).json({
        success: false,
        message: 'شماره کارت و نام بانک الزامی است'
      });
    }

    // حذف کاراکترهای غیر عددی از شماره کارت
    const cleanCardNumber = cardNumber.replace(/[^\d]/g, '');

    if (cleanCardNumber.length !== 16) {
      return res.status(400).json({
        success: false,
        message: 'شماره کارت باید 16 رقم باشد'
      });
    }

    // بررسی تکراری نبودن کارت برای این کاربر
    const existingCard = await mysql.query(
      'SELECT id FROM cards WHERE userId = ? AND cardNumber = ?',
      [userId, cleanCardNumber]
    );

    if (existingCard && existingCard.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'این کارت قبلاً ثبت شده است'
      });
    }

    // اگر شبا ارسال نشده باشد، سعی می‌کنیم از API زیبال دریافت کنیم
    let finalShebaNumber = shebaNumber;
    let finalBankName = bankName;

    if (!finalShebaNumber) {
      try {
        const apiKey = process.env.ZIBAL_FACILITY_API_KEY;
        if (apiKey) {
          const ibanResult = await cardToIban(cleanCardNumber, apiKey);
          if (ibanResult.success && ibanResult.data) {
            // حذف "IR" از ابتدای شبا برای ذخیره در دیتابیس
            if (ibanResult.data.IBAN) {
              finalShebaNumber = ibanResult.data.IBAN.replace(/^IR/i, '');
            }
            // اگر نام بانک از API دریافت شد و در request ارسال نشده بود، استفاده می‌کنیم
            if (ibanResult.data.bankName && !bankName) {
              finalBankName = ibanResult.data.bankName;
            }
          }
        }
      } catch (error) {
        console.error('Error converting card to IBAN during card creation:', error);
        // اگر تبدیل کارت به شبا با خطا مواجه شد، ادامه می‌دهیم بدون شبا
      }
    }

    // درج کارت جدید
    const insertQuery = `
      INSERT INTO cards (userId, cardName, cardNumber, shebaNumber, bankName)
      VALUES (?, ?, ?, ?, ?)
    `;

    console.log('[Card Routes] Inserting card:', {
      userId,
      cardName: cardName || null,
      cardNumber: cleanCardNumber.replace(/\d(?=\d{4})/g, '*'),
      shebaNumber: finalShebaNumber || null,
      bankName: finalBankName
    });

    const result = await mysql.query(insertQuery, [
      userId,
      cardName || null,
      cleanCardNumber,
      finalShebaNumber || null,
      finalBankName
    ]);

    console.log('[Card Routes] Card inserted successfully:', result.insertId);

    res.json({
      success: true,
      message: 'کارت با موفقیت اضافه شد',
      card: {
        id: result.insertId,
        userId,
        cardName: cardName || null,
        cardNumber: cleanCardNumber,
        shebaNumber: finalShebaNumber || null,
        bankName: finalBankName,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('[Card Routes] Error adding bank card:', error);
    console.error('[Card Routes] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'خطا در افزودن کارت بانکی',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// حذف کارت
router.delete('/:id', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const cardId = req.params.id;

    // بررسی اینکه کارت متعلق به کاربر است
    const card = await mysql.query(
      'SELECT id FROM cards WHERE id = ? AND userId = ?',
      [cardId, userId]
    );

    if (!card || card.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'کارت یافت نشد'
      });
    }

    // حذف کارت
    await mysql.query('DELETE FROM cards WHERE id = ? AND userId = ?', [cardId, userId]);

    res.json({
      success: true,
      message: 'کارت با موفقیت حذف شد'
    });
  } catch (error) {
    console.error('Error deleting bank card:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در حذف کارت بانکی'
    });
  }
});

module.exports = router;
