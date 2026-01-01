const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const redis = require('../database/redis');
const path = require('path');
const { generalRateLimiter } = require('../middleware/security');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/validation');
const upload = require('../middleware/upload');

// Cache TTL: 15 دقیقه (900 ثانیه)
const CACHE_TTL = 15 * 60;

// تابع برای invalidate کردن cache محصولات
const invalidateProductsCache = async () => {
  try {
    const redisClient = await redis.connect();
    await redisClient.del('products:active');
  } catch (error) {
    console.error('Error invalidating products cache:', error);
  }
};

// دریافت لیست محصولات
router.get('/', async (req, res) => {
  try {
    const { category, accountType, isActive } = req.query;
    
    // فقط برای درخواست‌های فعال بدون فیلتر اضافی (فرانت) cache می‌کنیم
    const shouldCache = isActive === 'true' || isActive === '1' || isActive === true;
    const noFilters = !category && !accountType;
    let cachedData = null;
    let fromCache = false;

    if (shouldCache && noFilters) {
      try {
        const redisClient = await redis.connect();
        const cacheKey = 'products:active';
        cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
          fromCache = true;
          const parsedData = JSON.parse(cachedData);
          // اطمینان از حذف purchasePrice از cache
          const productsWithoutPurchasePrice = parsedData.map(({ purchasePrice, ...product }) => product);
          return res.json({
            status: 1,
            message: 'Products fetched successfully',
            data: productsWithoutPurchasePrice,
            cached: true
          });
        }
      } catch (redisError) {
        console.error('Redis error (continuing with DB):', redisError);
        // اگر Redis خطا داشت، ادامه می‌دهیم و از دیتابیس می‌خوانیم
      }
    }
    
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    // فیلتر بر اساس دسته‌بندی
    if (category) {
      const validCategories = ['ChatGPT', 'Gemini', 'Cursor', 'CapCut', 'Discord', 'Youtube'];
      if (validCategories.includes(category)) {
        query += ' AND category = ?';
        params.push(category);
      }
    }

    // فیلتر بر اساس نوع اکانت
    if (accountType) {
      const validAccountTypes = ['اشتراکی', 'اختصاصی'];
      if (validAccountTypes.includes(accountType)) {
        query += ' AND accountType = ?';
        params.push(accountType);
      }
    }

    // فیلتر بر اساس وضعیت فعال/غیرفعال
    if (isActive !== undefined) {
      query += ' AND isActive = ?';
      params.push(isActive === 'true' || isActive === true);
    }

    query += ' ORDER BY createdAt DESC';

    const products = await mysql.query(query, params);

    // حذف purchasePrice از همه محصولات
    const productsWithoutPurchasePrice = products.map(({ purchasePrice, ...product }) => product);

    // Cache کردن نتایج برای درخواست‌های فرانت
    if (shouldCache && noFilters) {
      try {
        const redisClient = await redis.connect();
        const cacheKey = 'products:active';
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(productsWithoutPurchasePrice));
      } catch (redisError) {
        console.error('Redis cache error (ignored):', redisError);
      }
    }

    res.json({
      status: 1,
      message: 'Products fetched successfully',
      data: productsWithoutPurchasePrice,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// دریافت یک محصول خاص
router.get('/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid product ID'
      });
    }

    const query = 'SELECT * FROM products WHERE id = ?';
    const products = await mysql.query(query, [productId]);

    if (products.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Product not found'
      });
    }

    // حذف purchasePrice از response
    const product = products[0];
    const { purchasePrice, ...productWithoutPurchasePrice } = product;

    res.json({
      status: 1,
      message: 'Product fetched successfully',
      data: productWithoutPurchasePrice
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// اپلود تصویر محصول
router.post('/upload-image', authenticate, requireAdmin, generalRateLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 0,
        message: 'هیچ فایلی ارسال نشده است'
      });
    }

    // مسیر نسبی فایل (برای دسترسی از frontend)
    const imagePath = `/uploads/products/${req.file.filename}`;

    res.json({
      status: 1,
      message: 'تصویر با موفقیت آپلود شد',
      data: {
        imagePath: imagePath,
        filename: req.file.filename
      }
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'خطا در آپلود تصویر'
    });
  }
});

// ساخت محصول جدید (فقط admin)
router.post('/', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const {
      productName,
      category,
      accountType,
      duration,
      purchasePrice,
      regularPrice,
      merchantPrice,
      activationTimeMinutes,
      activationType,
      imagePath,
      additionalInfo,
      noteType,
      noteText,
      isActive
    } = req.body;

    // اعتبارسنجی فیلدهای اجباری
    if (!productName || !category || !accountType || !duration || 
        purchasePrice === undefined || regularPrice === undefined || 
        merchantPrice === undefined || !activationType) {
      return res.status(400).json({
        status: 0,
        message: 'Missing required fields: productName, category, accountType, duration, purchasePrice, regularPrice, merchantPrice, activationType'
      });
    }

    // اعتبارسنجی دسته‌بندی
    const validCategories = ['ChatGPT', 'Gemini', 'Cursor', 'CapCut', 'Discord', 'Youtube'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        status: 0,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    // اعتبارسنجی نوع اکانت
    const validAccountTypes = ['اشتراکی', 'اختصاصی'];
    if (!validAccountTypes.includes(accountType)) {
      return res.status(400).json({
        status: 0,
        message: `Invalid accountType. Must be one of: ${validAccountTypes.join(', ')}`
      });
    }

    // اعتبارسنجی نوع فعالسازی
    const validActivationTypes = ['ایمیل شخصی', 'ایمیل آماده'];
    if (!validActivationTypes.includes(activationType)) {
      return res.status(400).json({
        status: 0,
        message: `Invalid activationType. Must be one of: ${validActivationTypes.join(', ')}`
      });
    }

    // اعتبارسنجی نوع نکته (اگر ارسال شده باشد)
    if (noteType !== undefined && noteType !== null && noteType !== '') {
      const validNoteTypes = ['info', 'warning', 'note'];
      if (!validNoteTypes.includes(noteType)) {
        return res.status(400).json({
          status: 0,
          message: `Invalid noteType. Must be one of: ${validNoteTypes.join(', ')}`
        });
      }
    }

    // اگر noteType وجود دارد، noteText هم باید وجود داشته باشد
    if ((noteType && !noteText) || (!noteType && noteText)) {
      return res.status(400).json({
        status: 0,
        message: 'Both noteType and noteText must be provided together, or both should be empty'
      });
    }

    // اعتبارسنجی مقادیر عددی
    if (typeof duration !== 'number' || duration <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Duration must be a positive number'
      });
    }

    if (typeof purchasePrice !== 'number' || purchasePrice < 0) {
      return res.status(400).json({
        status: 0,
        message: 'PurchasePrice must be a non-negative number'
      });
    }

    if (typeof regularPrice !== 'number' || regularPrice < 0) {
      return res.status(400).json({
        status: 0,
        message: 'RegularPrice must be a non-negative number'
      });
    }

    if (typeof merchantPrice !== 'number' || merchantPrice < 0) {
      return res.status(400).json({
        status: 0,
        message: 'MerchantPrice must be a non-negative number'
      });
    }

    const activationTime = activationTimeMinutes !== undefined 
      ? (typeof activationTimeMinutes === 'number' && activationTimeMinutes >= 0 ? activationTimeMinutes : 0)
      : 0;

    const query = `
      INSERT INTO products (
        productName, category, accountType, duration, 
        purchasePrice, regularPrice, merchantPrice, 
        activationTimeMinutes, activationType, imagePath, 
        additionalInfo, noteType, noteText, isActive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      sanitizeInput(productName),
      category,
      accountType,
      duration,
      purchasePrice,
      regularPrice,
      merchantPrice,
      activationTime,
      activationType,
      imagePath ? sanitizeInput(imagePath) : null,
      additionalInfo ? sanitizeInput(additionalInfo) : null,
      noteType && noteType !== '' ? noteType : null,
      noteText && noteText !== '' ? sanitizeInput(noteText) : null,
      isActive !== undefined ? (isActive === true || isActive === 'true') : true
    ];

    const result = await mysql.query(query, values);

    // دریافت محصول ایجاد شده
    const createdProduct = await mysql.query('SELECT * FROM products WHERE id = ?', [result.insertId]);

    // Invalidate cache
    await invalidateProductsCache();

    res.status(201).json({
      status: 1,
      message: 'Product created successfully',
      data: createdProduct[0]
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// به‌روزرسانی محصول (فقط admin)
router.put('/:id', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid product ID'
      });
    }

    // بررسی وجود محصول
    const existingProduct = await mysql.query('SELECT * FROM products WHERE id = ?', [productId]);
    if (existingProduct.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Product not found'
      });
    }

    const {
      productName,
      category,
      accountType,
      duration,
      purchasePrice,
      regularPrice,
      merchantPrice,
      activationTimeMinutes,
      activationType,
      imagePath,
      additionalInfo,
      isActive
    } = req.body;

    // ساخت query به صورت dynamic
    const updates = [];
    const values = [];

    if (productName !== undefined) {
      updates.push('productName = ?');
      values.push(sanitizeInput(productName));
    }

    if (category !== undefined) {
      const validCategories = ['ChatGPT', 'Gemini', 'Cursor', 'CapCut', 'Discord', 'Youtube'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          status: 0,
          message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        });
      }
      updates.push('category = ?');
      values.push(category);
    }

    if (accountType !== undefined) {
      const validAccountTypes = ['اشتراکی', 'اختصاصی'];
      if (!validAccountTypes.includes(accountType)) {
        return res.status(400).json({
          status: 0,
          message: `Invalid accountType. Must be one of: ${validAccountTypes.join(', ')}`
        });
      }
      updates.push('accountType = ?');
      values.push(accountType);
    }

    if (duration !== undefined) {
      if (typeof duration !== 'number' || duration <= 0) {
        return res.status(400).json({
          status: 0,
          message: 'Duration must be a positive number'
        });
      }
      updates.push('duration = ?');
      values.push(duration);
    }

    if (purchasePrice !== undefined) {
      if (typeof purchasePrice !== 'number' || purchasePrice < 0) {
        return res.status(400).json({
          status: 0,
          message: 'PurchasePrice must be a non-negative number'
        });
      }
      updates.push('purchasePrice = ?');
      values.push(purchasePrice);
    }

    if (regularPrice !== undefined) {
      if (typeof regularPrice !== 'number' || regularPrice < 0) {
        return res.status(400).json({
          status: 0,
          message: 'RegularPrice must be a non-negative number'
        });
      }
      updates.push('regularPrice = ?');
      values.push(regularPrice);
    }

    if (merchantPrice !== undefined) {
      if (typeof merchantPrice !== 'number' || merchantPrice < 0) {
        return res.status(400).json({
          status: 0,
          message: 'MerchantPrice must be a non-negative number'
        });
      }
      updates.push('merchantPrice = ?');
      values.push(merchantPrice);
    }

    if (activationTimeMinutes !== undefined) {
      if (typeof activationTimeMinutes !== 'number' || activationTimeMinutes < 0) {
        return res.status(400).json({
          status: 0,
          message: 'ActivationTimeMinutes must be a non-negative number'
        });
      }
      updates.push('activationTimeMinutes = ?');
      values.push(activationTimeMinutes);
    }

    if (activationType !== undefined) {
      const validActivationTypes = ['ایمیل شخصی', 'ایمیل آماده'];
      if (!validActivationTypes.includes(activationType)) {
        return res.status(400).json({
          status: 0,
          message: `Invalid activationType. Must be one of: ${validActivationTypes.join(', ')}`
        });
      }
      updates.push('activationType = ?');
      values.push(activationType);
    }

    if (imagePath !== undefined) {
      updates.push('imagePath = ?');
      values.push(imagePath ? sanitizeInput(imagePath) : null);
    }

    if (additionalInfo !== undefined) {
      updates.push('additionalInfo = ?');
      values.push(additionalInfo ? sanitizeInput(additionalInfo) : null);
    }

    if (noteType !== undefined) {
      if (noteType !== null && noteType !== '') {
        const validNoteTypes = ['info', 'warning', 'note'];
        if (!validNoteTypes.includes(noteType)) {
          return res.status(400).json({
            status: 0,
            message: `Invalid noteType. Must be one of: ${validNoteTypes.join(', ')}`
          });
        }
        // اگر noteType وجود دارد، noteText هم باید وجود داشته باشد
        if (!noteText || noteText === '') {
          return res.status(400).json({
            status: 0,
            message: 'noteText must be provided when noteType is set'
          });
        }
      }
      updates.push('noteType = ?');
      values.push(noteType && noteType !== '' ? noteType : null);
    }

    if (noteText !== undefined) {
      // اگر noteText وجود دارد، noteType هم باید وجود داشته باشد
      if (noteText && noteText !== '') {
        if (!noteType || noteType === '') {
          return res.status(400).json({
            status: 0,
            message: 'noteType must be provided when noteText is set'
          });
        }
      }
      updates.push('noteText = ?');
      values.push(noteText && noteText !== '' ? sanitizeInput(noteText) : null);
    }

    if (isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(isActive === true || isActive === 'true');
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 0,
        message: 'No fields to update'
      });
    }

    values.push(productId);

    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;
    await mysql.query(query, values);

    // دریافت محصول به‌روزرسانی شده
    const updatedProduct = await mysql.query('SELECT * FROM products WHERE id = ?', [productId]);

    // Invalidate cache
    await invalidateProductsCache();

    res.json({
      status: 1,
      message: 'Product updated successfully',
      data: updatedProduct[0]
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// حذف محصول (فقط admin)
router.delete('/:id', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid product ID'
      });
    }

    // بررسی وجود محصول
    const existingProduct = await mysql.query('SELECT * FROM products WHERE id = ?', [productId]);
    if (existingProduct.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Product not found'
      });
    }

    // حذف محصول
    await mysql.query('DELETE FROM products WHERE id = ?', [productId]);

    // Invalidate cache
    await invalidateProductsCache();

    res.json({
      status: 1,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

