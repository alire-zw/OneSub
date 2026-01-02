const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const redis = require('../database/redis');
const path = require('path');
const fs = require('fs');
const { generalRateLimiter } = require('../middleware/security');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/validation');
const upload = require('../middleware/bannerUpload');

// Cache TTL: 15 دقیقه (900 ثانیه)
const CACHE_TTL = 15 * 60;

// تابع برای invalidate کردن cache بنرها
const invalidateBannersCache = async () => {
  try {
    const redisClient = await redis.connect();
    await redisClient.del('banners:active');
  } catch (error) {
    console.error('Error invalidating banners cache:', error);
  }
};

// دریافت لیست بنرها (برای ادمین و فرانت)
router.get('/', async (req, res) => {
  try {
    const { isActive, all } = req.query;
    
    // فقط برای درخواست‌های بدون فیلتر خاص (فرانت) cache می‌کنیم
    const shouldCache = (isActive === undefined || isActive === 'true' || isActive === '1') && all !== 'true';
    let cachedData = null;
    let fromCache = false;

    if (shouldCache) {
      try {
        const redisClient = await redis.connect();
        const cacheKey = 'banners:active';
        cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
          fromCache = true;
          const parsedData = JSON.parse(cachedData);
          return res.json({
            status: 1,
            message: 'Banners fetched successfully',
            data: parsedData,
            cached: true
          });
        }
      } catch (redisError) {
        console.error('Redis error (continuing with DB):', redisError);
        // اگر Redis خطا داشت، ادامه می‌دهیم و از دیتابیس می‌خوانیم
      }
    }
    
    let query = 'SELECT * FROM banners WHERE 1=1';
    const params = [];

    // اگر all=true باشد، همه بنرها را برمی‌گردانیم (برای صفحه ادمین)
    if (all === 'true') {
      // هیچ فیلتری اعمال نمی‌کنیم
    } else if (isActive !== undefined) {
      // فیلتر بر اساس وضعیت فعال/غیرفعال
      query += ' AND isActive = ?';
      params.push(isActive === 'true' || isActive === true);
    } else {
      // به صورت پیش‌فرض فقط بنرهای فعال را برای فرانت نمایش می‌دهیم
      query += ' AND isActive = 1';
    }

    query += ' ORDER BY displayOrder ASC, createdAt DESC';

    const banners = await mysql.query(query, params);

    // Cache کردن نتایج برای درخواست‌های فرانت
    if (shouldCache) {
      try {
        const redisClient = await redis.connect();
        const cacheKey = 'banners:active';
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(banners));
      } catch (redisError) {
        console.error('Redis cache error (ignored):', redisError);
      }
    }

    res.json({
      status: 1,
      message: 'Banners fetched successfully',
      data: banners,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// اپلود تصویر بنر (باید قبل از route /:id باشد)
router.post('/upload-image', authenticate, requireAdmin, generalRateLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 0,
        message: 'No image file uploaded'
      });
    }

    const imagePath = `/uploads/banners/${req.file.filename}`;

    res.json({
      status: 1,
      message: 'Image uploaded successfully',
      data: {
        imagePath: imagePath,
        filename: req.file.filename
      }
    });
  } catch (error) {
    console.error('Error uploading banner image:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// دریافت یک بنر خاص
router.get('/:id', async (req, res) => {
  try {
    const bannerId = parseInt(req.params.id);

    if (isNaN(bannerId) || bannerId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid banner ID'
      });
    }

    const query = 'SELECT * FROM banners WHERE id = ?';
    const banners = await mysql.query(query, [bannerId]);

    if (banners.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Banner not found'
      });
    }

    res.json({
      status: 1,
      message: 'Banner fetched successfully',
      data: banners[0]
    });
  } catch (error) {
    console.error('Error fetching banner:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// ایجاد بنر جدید
router.post('/', authenticate, requireAdmin, generalRateLimiter, upload.single('image'), async (req, res) => {
  try {
    const {
      linkType,
      linkId,
      linkValue,
      displayOrder,
      isActive
    } = req.body;

    // بررسی فایل تصویر
    if (!req.file) {
      return res.status(400).json({
        status: 0,
        message: 'Image file is required'
      });
    }

    const imagePath = `/uploads/banners/${req.file.filename}`;

    // اعتبارسنجی فیلدها
    if (!linkType || !['product', 'category'].includes(linkType)) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid linkType. Must be "product" or "category"'
      });
    }

    if (linkType === 'product' && (!linkId || isNaN(parseInt(linkId)))) {
      return res.status(400).json({
        status: 0,
        message: 'linkId is required and must be a valid number for product type'
      });
    }

    if (linkType === 'category' && !linkValue) {
      return res.status(400).json({
        status: 0,
        message: 'linkValue is required for category type'
      });
    }

    // اگر product باشد، بررسی کنیم که محصول وجود دارد
    if (linkType === 'product') {
      const product = await mysql.query('SELECT id FROM products WHERE id = ?', [parseInt(linkId)]);
      if (product.length === 0) {
        return res.status(400).json({
          status: 0,
          message: 'Product not found'
        });
      }
    }

    // اگر category باشد، بررسی کنیم که دسته‌بندی معتبر است
    if (linkType === 'category') {
      const validCategories = ['ChatGPT', 'Gemini', 'Cursor', 'CapCut', 'Discord', 'Youtube'];
      if (!validCategories.includes(linkValue)) {
        return res.status(400).json({
          status: 0,
          message: 'Invalid category. Must be one of: ' + validCategories.join(', ')
        });
      }
    }

    const order = displayOrder ? parseInt(displayOrder) : 1;
    const active = isActive !== undefined ? (isActive === 'true' || isActive === true) : true;

    // درج بنر جدید
    const insertQuery = `
      INSERT INTO banners (
        imagePath, linkType, linkId, linkValue, displayOrder, isActive
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      imagePath,
      linkType,
      linkType === 'product' ? parseInt(linkId) : null,
      linkType === 'category' ? sanitizeInput(linkValue) : null,
      order,
      active
    ];

    const result = await mysql.query(insertQuery, values);
    const createdBanner = await mysql.query('SELECT * FROM banners WHERE id = ?', [result.insertId]);

    // Invalidate cache
    await invalidateBannersCache();

    res.status(201).json({
      status: 1,
      message: 'Banner created successfully',
      data: createdBanner[0]
    });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// بروزرسانی بنر
router.put('/:id', authenticate, requireAdmin, generalRateLimiter, upload.single('image'), async (req, res) => {
  try {
    const bannerId = parseInt(req.params.id);

    if (isNaN(bannerId) || bannerId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid banner ID'
      });
    }

    // بررسی وجود بنر
    const existingBanner = await mysql.query('SELECT * FROM banners WHERE id = ?', [bannerId]);
    if (existingBanner.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Banner not found'
      });
    }

    const {
      linkType,
      linkId,
      linkValue,
      displayOrder,
      isActive
    } = req.body;

    const updates = [];
    const values = [];

    // بروزرسانی تصویر اگر آپلود شده باشد
    if (req.file) {
      // حذف تصویر قبلی
      const oldImagePath = path.join(__dirname, '..', existingBanner[0].imagePath);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
        } catch (error) {
          console.error('Error deleting old image:', error);
        }
      }

      const imagePath = `/uploads/banners/${req.file.filename}`;
      updates.push('imagePath = ?');
      values.push(imagePath);
    }

    // بروزرسانی linkType
    if (linkType !== undefined) {
      if (!['product', 'category'].includes(linkType)) {
        return res.status(400).json({
          status: 0,
          message: 'Invalid linkType. Must be "product" or "category"'
        });
      }
      updates.push('linkType = ?');
      values.push(linkType);

      // بروزرسانی linkId و linkValue بر اساس linkType
      if (linkType === 'product') {
        if (!linkId || isNaN(parseInt(linkId))) {
          return res.status(400).json({
            status: 0,
            message: 'linkId is required and must be a valid number for product type'
          });
        }

        // بررسی وجود محصول
        const product = await mysql.query('SELECT id FROM products WHERE id = ?', [parseInt(linkId)]);
        if (product.length === 0) {
          return res.status(400).json({
            status: 0,
            message: 'Product not found'
          });
        }

        updates.push('linkId = ?');
        values.push(parseInt(linkId));
        updates.push('linkValue = NULL');
      } else if (linkType === 'category') {
        if (!linkValue) {
          return res.status(400).json({
            status: 0,
            message: 'linkValue is required for category type'
          });
        }

        // بررسی معتبر بودن دسته‌بندی
        const validCategories = ['ChatGPT', 'Gemini', 'Cursor', 'CapCut', 'Discord', 'Youtube'];
        if (!validCategories.includes(linkValue)) {
          return res.status(400).json({
            status: 0,
            message: 'Invalid category. Must be one of: ' + validCategories.join(', ')
          });
        }

        updates.push('linkId = NULL');
        updates.push('linkValue = ?');
        values.push(sanitizeInput(linkValue));
      }
    } else {
      // اگر linkType تغییر نکرده باشد، فقط linkId یا linkValue را بروزرسانی می‌کنیم
      if (linkId !== undefined && existingBanner[0].linkType === 'product') {
        const product = await mysql.query('SELECT id FROM products WHERE id = ?', [parseInt(linkId)]);
        if (product.length === 0) {
          return res.status(400).json({
            status: 0,
            message: 'Product not found'
          });
        }
        updates.push('linkId = ?');
        values.push(parseInt(linkId));
      }

      if (linkValue !== undefined && existingBanner[0].linkType === 'category') {
        const validCategories = ['ChatGPT', 'Gemini', 'Cursor', 'CapCut', 'Discord', 'Youtube'];
        if (!validCategories.includes(linkValue)) {
          return res.status(400).json({
            status: 0,
            message: 'Invalid category. Must be one of: ' + validCategories.join(', ')
          });
        }
        updates.push('linkValue = ?');
        values.push(sanitizeInput(linkValue));
      }
    }

    // بروزرسانی displayOrder
    if (displayOrder !== undefined) {
      updates.push('displayOrder = ?');
      values.push(parseInt(displayOrder));
    }

    // بروزرسانی isActive
    if (isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(isActive === 'true' || isActive === true);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 0,
        message: 'No fields to update'
      });
    }

    values.push(bannerId);
    const query = `UPDATE banners SET ${updates.join(', ')} WHERE id = ?`;

    await mysql.query(query, values);
    const updatedBanner = await mysql.query('SELECT * FROM banners WHERE id = ?', [bannerId]);

    // Invalidate cache
    await invalidateBannersCache();

    res.json({
      status: 1,
      message: 'Banner updated successfully',
      data: updatedBanner[0]
    });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// حذف بنر
router.delete('/:id', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const bannerId = parseInt(req.params.id);

    if (isNaN(bannerId) || bannerId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid banner ID'
      });
    }

    // بررسی وجود بنر
    const existingBanner = await mysql.query('SELECT * FROM banners WHERE id = ?', [bannerId]);
    if (existingBanner.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Banner not found'
      });
    }

    // حذف فایل تصویر
    const imagePath = path.join(__dirname, '..', existingBanner[0].imagePath);
    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (error) {
        console.error('Error deleting banner image:', error);
      }
    }

    // حذف بنر از دیتابیس
    await mysql.query('DELETE FROM banners WHERE id = ?', [bannerId]);

    // Invalidate cache
    await invalidateBannersCache();

    res.json({
      status: 1,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

