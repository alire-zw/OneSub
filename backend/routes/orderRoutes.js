const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const { generalRateLimiter } = require('../middleware/security');
const { authenticate } = require('../middleware/auth');
const zibalService = require('../services/zibalService');
const { getUserData, refreshUserCache } = require('../utils/userCache');
const nobitexService = require('../services/nobitexService');
const tronService = require('../services/tronService');

const ZIBAL_MERCHANT = process.env.ZIBAL_MERCHANT || 'zibal';
const BASE_URL = process.env.BASE_URL || process.env.BACKEND_URL || 'http://localhost:4536';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8903';

// تولید شماره سفارش به فرمت OS100001, OS100002, ...
const generateOrderNumber = async () => {
  try {
    // پیدا کردن آخرین شماره سفارش
    const lastOrder = await mysql.query(
      'SELECT orderNumber FROM orders ORDER BY id DESC LIMIT 1'
    );
    
    if (lastOrder && lastOrder.length > 0) {
      const lastNumber = lastOrder[0].orderNumber.replace('OS', '');
      const nextNumber = parseInt(lastNumber) + 1;
      return `OS${nextNumber.toString().padStart(6, '0')}`;
    } else {
      return 'OS100001';
    }
  } catch (error) {
    console.error('Error generating order number:', error);
    // در صورت خطا، از timestamp استفاده می‌کنیم
    return `OS${Date.now().toString().slice(-6)}`;
  }
};

// خرید با کیف پول
router.post('/purchase-with-wallet', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { productId, orderEmail } = req.body;

    if (!productId) {
      return res.status(400).json({
        status: 0,
        message: 'Product ID is required'
      });
    }

    // دریافت اطلاعات کاربر و محصول
    const user = await getUserData(userId);
    if (!user) {
      return res.status(404).json({
        status: 0,
        message: 'User not found'
      });
    }

    const productQuery = 'SELECT * FROM products WHERE id = ? AND isActive = 1';
    const products = await mysql.query(productQuery, [productId]);
    
    if (products.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Product not found or inactive'
      });
    }

    const product = products[0];
    
    // تعیین قیمت بر اساس نقش کاربر
    let price = product.regularPrice;
    if (user.role === 'merchants') {
      price = product.merchantPrice;
    }

    // بررسی موجودی کیف پول (موجودی در Rial است)
    const walletBalanceInRial = user.walletBalance || 0;
    const walletBalanceInToman = Math.floor(walletBalanceInRial / 10);
    const priceInRial = price * 10;

    if (walletBalanceInRial < priceInRial) {
      return res.status(400).json({
        status: 0,
        message: 'Insufficient wallet balance'
      });
    }

    // تولید شماره سفارش
    const orderNumber = await generateOrderNumber();

    // کسر موجودی از کیف پول
    const updateWalletQuery = `
      UPDATE users 
      SET walletBalance = walletBalance - ? 
      WHERE id = ?
    `;
    
    await mysql.query(updateWalletQuery, [priceInRial, userId]);

    // ایجاد سفارش
    const insertOrderQuery = `
      INSERT INTO orders (userId, orderNumber, productId, paymentMethod, orderEmail, amount, paidAmount, status, completedAt)
      VALUES (?, ?, ?, 'wallet', ?, ?, ?, 'completed', NOW())
    `;
    
    const orderResult = await mysql.query(insertOrderQuery, [
      userId,
      orderNumber,
      productId,
      orderEmail || null,
      price,
      price
    ]);

    // به‌روزرسانی cache کاربر
    await refreshUserCache(userId);

    res.json({
      status: 1,
      message: 'Order created successfully',
      data: {
        orderId: orderResult.insertId,
        orderNumber: orderNumber,
        amount: price
      }
    });
  } catch (error) {
    console.error('Error creating order with wallet:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// خرید مستقیم با درگاه
router.post('/purchase-direct', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { productId, orderEmail, useWalletBalance } = req.body;

    if (!productId) {
      return res.status(400).json({
        status: 0,
        message: 'Product ID is required'
      });
    }

    // دریافت اطلاعات کاربر و محصول
    const user = await getUserData(userId);
    if (!user) {
      return res.status(404).json({
        status: 0,
        message: 'User not found'
      });
    }

    const productQuery = 'SELECT * FROM products WHERE id = ? AND isActive = 1';
    const products = await mysql.query(productQuery, [productId]);
    
    if (products.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Product not found or inactive'
      });
    }

    const product = products[0];
    
    // تعیین قیمت بر اساس نقش کاربر
    let price = product.regularPrice;
    if (user.role === 'merchants') {
      price = product.merchantPrice;
    }

    // محاسبه مبلغ نهایی (اگر از موجودی استفاده شود)
    let finalAmount = price;
    let paidFromWallet = 0;

    if (useWalletBalance) {
      const walletBalanceInRial = user.walletBalance || 0;
      const walletBalanceInToman = Math.floor(walletBalanceInRial / 10);
      
      if (walletBalanceInToman > 0 && walletBalanceInToman < price) {
        paidFromWallet = walletBalanceInToman;
        finalAmount = price - walletBalanceInToman;
      }
    }

    if (finalAmount <= 0) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid payment amount'
      });
    }

    // تولید شماره سفارش
    const orderNumber = await generateOrderNumber();

    // اگر از موجودی استفاده شده، کسر کنیم
    if (paidFromWallet > 0) {
      const priceInRial = paidFromWallet * 10;
      const updateWalletQuery = `
        UPDATE users 
        SET walletBalance = walletBalance - ? 
        WHERE id = ?
      `;
      
      await mysql.query(updateWalletQuery, [priceInRial, userId]);
      await refreshUserCache(userId);
    }

    // ایجاد سفارش با وضعیت pending
    const insertOrderQuery = `
      INSERT INTO orders (userId, orderNumber, productId, paymentMethod, orderEmail, amount, paidAmount, status)
      VALUES (?, ?, ?, 'online', ?, ?, ?, 'pending')
    `;
    
    const orderResult = await mysql.query(insertOrderQuery, [
      userId,
      orderNumber,
      productId,
      orderEmail || null,
      price,
      paidFromWallet
    ]);

    // ایجاد درخواست پرداخت درگاه
    const orderId = `ORD-${orderNumber}`;
    const callbackUrl = `${BASE_URL}/api/orders/callback`;
    const amountInRial = finalAmount * 10; // تبدیل تومان به ریال برای درگاه

    const paymentOptions = {
      merchant: ZIBAL_MERCHANT,
      amount: amountInRial,
      callbackUrl: callbackUrl,
      description: `Order ${orderNumber} - ${product.productName}`,
      orderId: orderId
    };

    const paymentResult = await zibalService.requestPayment(paymentOptions);

    if (!paymentResult.success) {
      // در صورت خطا، سفارش را cancelled می‌کنیم
      await mysql.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', orderResult.insertId]);
      
      return res.status(400).json({
        status: 0,
        message: paymentResult.message || 'Failed to create payment request',
        resultCode: paymentResult.resultCode
      });
    }

    // ذخیره transaction
    const insertTransactionQuery = `
      INSERT INTO transactions (userId, trackId, orderId, amount, status, paymentType, description)
      VALUES (?, ?, ?, ?, 'pending', 'zibal', ?)
    `;
    
    await mysql.query(insertTransactionQuery, [
      userId,
      paymentResult.trackId,
      orderId,
      amountInRial,
      paymentOptions.description
    ]);

    // به‌روزرسانی سفارش با transactionId
    const transactionResult = await mysql.query('SELECT id FROM transactions WHERE trackId = ?', [paymentResult.trackId]);
    if (transactionResult && transactionResult.length > 0) {
      await mysql.query('UPDATE orders SET transactionId = ? WHERE id = ?', [transactionResult[0].id, orderResult.insertId]);
    }

    const paymentUrl = zibalService.getPaymentUrl(paymentResult.trackId);

    res.json({
      status: 1,
      message: 'Payment request created successfully',
      data: {
        orderId: orderResult.insertId,
        orderNumber: orderNumber,
        trackId: paymentResult.trackId,
        paymentUrl: paymentUrl,
        amount: finalAmount,
        paidFromWallet: paidFromWallet
      }
    });
  } catch (error) {
    console.error('Error creating direct purchase:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// Helper to validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Purchase with Cryptocurrency
router.post('/purchase-with-crypto', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { productId, orderEmail } = req.body;

    if (!productId) {
      return res.status(400).json({ status: 0, message: 'Product ID is required' });
    }

    const productQuery = 'SELECT * FROM products WHERE id = ? AND isActive = 1';
    const products = await mysql.query(productQuery, [productId]);
    
    if (products.length === 0) {
      return res.status(404).json({ status: 0, message: 'Product not found or inactive' });
    }

    const product = products[0];
    
    const user = await getUserData(userId);
    if (!user) {
      return res.status(404).json({ status: 0, message: 'User not found' });
    }

    // تعیین قیمت بر اساس نقش کاربر
    let price = product.regularPrice;
    if (user.role === 'merchants') {
      price = product.merchantPrice;
    }

    // Validate email if required
    if (product.activationType.toLowerCase().includes("ایمیل شخصی") || product.activationType.toLowerCase().includes("personal email")) {
      if (!orderEmail || !isValidEmail(orderEmail)) {
        return res.status(400).json({ status: 0, message: 'Valid order email is required for this product' });
      }
    }

    const orderNumber = await generateOrderNumber();
    const amountInToman = price;

    // Get TRX price from Nobitex
    const priceResult = await nobitexService.getTRXPrice();
    if (!priceResult.success) {
      return res.status(500).json({
        status: 0,
        message: priceResult.message || 'Failed to get TRX price'
      });
    }

    // Calculate TRX amount
    const trxAmount = nobitexService.calculateTrxAmount(amountInToman, priceResult.price);

    // Create TRON wallet
    const walletResult = await tronService.createWallet();
    if (!walletResult.success) {
      return res.status(500).json({
        status: 0,
        message: walletResult.message || 'Failed to create TRON wallet'
      });
    }

    // Calculate expiration time (15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Create order (pending status) with wallet address
    const insertOrderQuery = `
      INSERT INTO orders (userId, orderNumber, productId, paymentMethod, orderEmail, amount, paidAmount, status, walletAddress)
      VALUES (?, ?, ?, 'crypto', ?, ?, 0, 'pending', ?)
    `;
    const orderResult = await mysql.query(insertOrderQuery, [
      userId,
      orderNumber,
      productId,
      orderEmail || null,
      amountInToman * 10, // Convert to Rial for storage
      walletResult.address // Store wallet address in order
    ]);

    const orderId = orderResult.insertId;
    const trackId = Date.now();

    // Create transaction record
    const insertTransactionQuery = `
      INSERT INTO transactions (userId, trackId, orderId, amount, status, paymentType, description)
      VALUES (?, ?, ?, ?, 'pending', 'tron', ?)
    `;
    
    const transactionResult = await mysql.query(insertTransactionQuery, [
      userId,
      trackId,
      orderNumber,
      amountInToman * 10, // Convert to Rial for storage
      `Cryptocurrency payment for order ${orderNumber}`
    ]);

    const transactionId = transactionResult.insertId;

    // Create crypto record
    const insertCryptoQuery = `
      INSERT INTO crypto (userId, transactionId, walletAddress, privateKey, amountToman, amountTrx, trxPrice, status, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `;
    
    await mysql.query(insertCryptoQuery, [
      userId,
      transactionId,
      walletResult.address,
      walletResult.privateKey,
      amountInToman,
      trxAmount,
      priceResult.price,
      expiresAt
    ]);

    // Update order with transactionId
    await mysql.query('UPDATE orders SET transactionId = ? WHERE id = ?', [transactionId, orderId]);

    res.json({
      status: 1,
      message: 'Cryptocurrency payment request created successfully',
      data: {
        trackId: trackId,
        orderNumber: orderNumber,
        walletAddress: walletResult.address,
        amountToman: amountInToman,
        amountTrx: trxAmount,
        trxPrice: priceResult.price,
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating crypto purchase request:', error);
    res.status(500).json({ status: 0, message: error.message || 'Internal server error' });
  }
});

// Callback پرداخت درگاه
router.get('/callback', async (req, res) => {
  try {
    const { trackId, success, status, orderId } = req.query;

    if (!trackId) {
      return res.status(400).send('TrackId is required');
    }

    const trackIdNum = parseInt(trackId);
    if (isNaN(trackIdNum)) {
      return res.status(400).send('Invalid TrackId');
    }

    const verifyResult = await zibalService.verifyPayment(trackIdNum, ZIBAL_MERCHANT);

    const transactionQuery = `SELECT * FROM transactions WHERE trackId = ?`;
    const transactions = await mysql.query(transactionQuery, [trackIdNum]);
    
    if (transactions.length === 0) {
      return res.status(404).send('Transaction not found');
    }

    const transaction = transactions[0];

    // پیدا کردن سفارش مرتبط
    const orderNumber = orderId ? orderId.replace('ORD-', '') : null;
    let orderQuery = 'SELECT * FROM orders WHERE transactionId = ?';
    let orderParams = [transaction.id];
    
    if (orderNumber) {
      orderQuery = 'SELECT * FROM orders WHERE orderNumber = ? OR transactionId = ?';
      orderParams = [orderNumber, transaction.id];
    }

    const orders = await mysql.query(orderQuery, orderParams);
    
    if (orders.length === 0) {
      return res.status(404).send('Order not found');
    }

    const order = orders[0];

    if (verifyResult.success) {
      if (transaction.status === 'pending' && order.status === 'pending') {
        // به‌روزرسانی transaction
        const updateTransactionQuery = `
          UPDATE transactions 
          SET status = 'completed', 
              refNumber = ?, 
              cardNumber = ?, 
              paidAt = ?,
              description = ?
          WHERE trackId = ?
        `;
        
        await mysql.query(updateTransactionQuery, [
          verifyResult.refNumber,
          verifyResult.cardNumber,
          verifyResult.paidAt ? new Date(verifyResult.paidAt) : new Date(),
          verifyResult.description || transaction.description,
          trackIdNum
        ]);

        // به‌روزرسانی سفارش
        const updateOrderQuery = `
          UPDATE orders 
          SET status = 'completed',
              completedAt = NOW()
          WHERE id = ?
        `;
        
        await mysql.query(updateOrderQuery, [order.id]);

        // به‌روزرسانی cache کاربر
        await refreshUserCache(order.userId);
      }

      const redirectUrl = `${FRONTEND_URL}/shop/product/${order.productId}/buy/success?orderNumber=${order.orderNumber}`;
      res.redirect(redirectUrl);
    } else {
      if (transaction.status === 'pending') {
        const updateTransactionQuery = `
          UPDATE transactions 
          SET status = 'failed',
              description = ?
          WHERE trackId = ?
        `;
        
        await mysql.query(updateTransactionQuery, [
          verifyResult.message || 'Payment verification failed',
          trackIdNum
        ]);

        // به‌روزرسانی سفارش
        const updateOrderQuery = `
          UPDATE orders 
          SET status = 'failed'
          WHERE id = ?
        `;
        
        await mysql.query(updateOrderQuery, [order.id]);
      }

      const redirectUrl = `${FRONTEND_URL}/shop/product/${order.productId}/buy/failed?orderNumber=${order.orderNumber}`;
      res.redirect(redirectUrl);
    }
  } catch (error) {
    console.error('Error in order payment callback:', error);
    const trackId = req.query.trackId || '';
    const redirectUrl = `${FRONTEND_URL}/shop?error=${encodeURIComponent(error.message)}`;
    res.redirect(redirectUrl);
  }
});

// دریافت اطلاعات سفارش بر اساس شماره سفارش
router.get('/:orderNumber', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        status: 0,
        message: 'Order number is required'
      });
    }

    // دریافت اطلاعات سفارش
    const orders = await mysql.query(
      `SELECT 
        o.id,
        o.orderNumber,
        o.userId,
        o.productId,
        o.paymentMethod,
        o.orderEmail,
        o.amount,
        o.status,
        o.createdAt,
        o.completedAt,
        p.productName,
        p.category,
        p.accountType,
        p.activationType,
        p.activationTimeMinutes,
        p.duration,
        p.regularPrice,
        p.imagePath
      FROM orders o
      LEFT JOIN products p ON o.productId = p.id
      WHERE o.orderNumber = ? AND o.userId = ?`,
      [orderNumber, userId]
    );

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    res.json({
      status: 1,
      message: 'Order information retrieved successfully',
      data: {
        orderNumber: order.orderNumber,
        productId: order.productId,
        paymentMethod: order.paymentMethod,
        userEmail: order.orderEmail,
        amount: order.amount,
        status: order.status,
        date: order.createdAt,
        completedAt: order.completedAt,
        product: order.productName ? {
          id: order.productId,
          productName: order.productName,
          category: order.category,
          accountType: order.accountType,
          activationType: order.activationType,
          activationTimeMinutes: order.activationTimeMinutes,
          duration: order.duration,
          regularPrice: order.regularPrice,
          imagePath: order.imagePath
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

