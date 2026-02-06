const express = require('express');
const router = express.Router();
const mysql = require('../database/mysql');
const { generalRateLimiter } = require('../middleware/security');
const { authenticate, requireAdmin } = require('../middleware/auth');
const zibalService = require('../services/zibalService');
const { getUserData, refreshUserCache } = require('../utils/userCache');
const nobitexService = require('../services/nobitexService');
const tronService = require('../services/tronService');
const telegramBot = require('../services/telegramBot');
const notificationService = require('../services/notificationService');
const smsService = require('../services/smsService');

const ZIBAL_MERCHANT = process.env.ZIBAL_MERCHANT || 'zibal';
const BASE_URL = process.env.BASE_URL || process.env.BACKEND_URL || 'http://localhost:4536';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8903';
const SMS_ORDER_CONFIRMATION_TEMPLATE_ID = process.env.SMS_ORDER_CONFIRMATION_TEMPLATE_ID;

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

    // ارسال نوتیفیکیشن‌ها (فقط برای خرید با کیف پول که مستقیماً completed می‌شود)
    try {
      // استفاده از user که قبلاً دریافت شده
      
      // ارسال نوتیفیکیشن تلگرام
      if (user.telegramID) {
        try {
          await telegramBot.sendOrderCompletionNotification(
            user.telegramID,
            orderNumber,
            product.productName,
            price
          );
        } catch (telegramError) {
          console.error('[Order Routes] Error sending Telegram notification:', telegramError);
        }
      }

      // ارسال پیامک
      if (user.phoneNumber && SMS_ORDER_CONFIRMATION_TEMPLATE_ID) {
        try {
          await smsService.sendTemplatedSMS(user.phoneNumber, SMS_ORDER_CONFIRMATION_TEMPLATE_ID, [
            { name: 'orderNumber', value: orderNumber },
            { name: 'productName', value: product.productName }
          ]);
        } catch (smsError) {
          console.error('[Order Routes] Error sending SMS:', smsError);
        }
      }

      // ایجاد نوتیفیکیشن درون اپ
      try {
        const notificationResult = await notificationService.createNotification(
          userId,
          'order',
          'خرید شما موفق بود',
          `سفارش شما با شماره ${orderNumber} با موفقیت ثبت و پرداخت شد.\n\n🛍️ محصول: ${product.productName}\n💵 مبلغ: ${price.toLocaleString('fa-IR')} تومان\n\n✅ پس از تایید توسط کارشناسان ما، وضعیت سفارش شما تغییر خواهد کرد و محصول به شما تحویل داده خواهد شد.`,
          `${FRONTEND_URL}/dashboard`
        );
        console.log('[Order Routes] Notification created successfully:', notificationResult);
      } catch (notificationError) {
        console.error('[Order Routes] Error creating notification:', notificationError);
      }

      // گزارش ادمین برای خرید با کیف پول
      try {
        await telegramBot.sendAdminOrderReport(
          userId,
          orderNumber,
          product.productName,
          price,
          'Wallet',
          null
        );
      } catch (adminReportError) {
        console.error('[Order Routes] Error sending admin order report:', adminReportError);
      }

      // گزارش کانال دوم (گزارش خرید کاربران)
      try {
        await telegramBot.sendSecondChannelOrderReport(userId, orderNumber);
      } catch (secondChannelError) {
        console.error('[Order Routes] Error sending second channel order report:', secondChannelError);
      }
    } catch (error) {
      console.error('[Order Routes] Error sending order notifications:', error);
    }

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
      // اگر از موجودی استفاده شده بود، برگردانیم
      if (paidFromWallet > 0) {
        const priceInRial = paidFromWallet * 10;
        const restoreWalletQuery = `
          UPDATE users 
          SET walletBalance = walletBalance + ? 
          WHERE id = ?
        `;
        await mysql.query(restoreWalletQuery, [priceInRial, userId]);
        await refreshUserCache(userId);
      }
      
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
    
    // ایجاد سفارش با وضعیت pending (فقط پس از موفقیت در درخواست پرداخت)
    const insertOrderQuery = `
      INSERT INTO orders (userId, orderNumber, productId, paymentMethod, orderEmail, amount, paidAmount, status, transactionId)
      VALUES (?, ?, ?, 'online', ?, ?, ?, 'pending', ?)
    `;
    
    const orderResult = await mysql.query(insertOrderQuery, [
      userId,
      orderNumber,
      productId,
      orderEmail || null,
      price,
      paidFromWallet,
      transactionResult && transactionResult.length > 0 ? transactionResult[0].id : null
    ]);

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
    console.log(`[Order Callback] Looking for order - Transaction ID: ${transaction.id}, Order Number: ${orderNumber}, Track ID: ${trackIdNum}`);
    
    let orderQuery = 'SELECT * FROM orders WHERE transactionId = ?';
    let orderParams = [transaction.id];
    
    if (orderNumber) {
      orderQuery = 'SELECT * FROM orders WHERE orderNumber = ? OR transactionId = ?';
      orderParams = [orderNumber, transaction.id];
    }

    console.log(`[Order Callback] Query: ${orderQuery}, Params: ${JSON.stringify(orderParams)}`);
    const orders = await mysql.query(orderQuery, orderParams);
    console.log(`[Order Callback] Found ${orders.length} orders`);
    
    if (orders.length === 0) {
      console.log(`[Order Callback] Order not found for Transaction ID: ${transaction.id}, Order Number: ${orderNumber}`);
      return res.status(404).send('Order not found');
    }

    const order = orders[0];
    console.log(`[Order Callback] Found order: ${JSON.stringify({id: order.id, orderNumber: order.orderNumber, status: order.status, paymentMethod: order.paymentMethod})}`);

    if (verifyResult.success) {
      console.log(`[Order Callback] Payment successful - Transaction status: ${transaction.status}, Order status: ${order.status}`);
      if (order.status === 'pending') {
        console.log(`[Order Callback] Updating order ${order.id} to completed status`);
        
        // به‌روزرسانی transaction (فقط اگر وضعیت هنوز pending بود)
        if (transaction.status === 'pending') {
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
          console.log(`[Order Callback] Transaction ${transaction.id} updated to completed`);
        } else {
          console.log(`[Order Callback] Transaction ${transaction.id} already processed with status: ${transaction.status}, skipping transaction update`);
        }

        // به‌روزرسانی سفارش
        const updateOrderQuery = `
          UPDATE orders 
          SET status = 'completed',
              completedAt = NOW()
          WHERE id = ?
        `;
        
        await mysql.query(updateOrderQuery, [order.id]);
        console.log(`[Order Callback] Order ${order.orderNumber} updated to completed successfully`);

        // به‌روزرسانی cache کاربر
        await refreshUserCache(order.userId);

        // ارسال نوتیفیکیشن‌ها و گزارش ادمین
        try {
          // دریافت اطلاعات محصول
          const productQuery = 'SELECT productName FROM products WHERE id = ?';
          const products = await mysql.query(productQuery, [order.productId]);
          const productName = products && products.length > 0 ? products[0].productName : 'نامشخص';
          
          // دریافت اطلاعات کاربر
          const userQuery = 'SELECT telegramID, phoneNumber FROM users WHERE id = ?';
          const users = await mysql.query(userQuery, [order.userId]);
          
          if (users && users.length > 0) {
            const user = users[0];
            // amount در دیتابیس: برای purchase-direct و purchase-with-wallet به صورت تومان، برای purchase-with-crypto به صورت ریال
            let amountInToman;
            if (order.paymentMethod === 'crypto') {
              amountInToman = Math.floor(order.amount / 10); // تبدیل از ریال به تومان
            } else {
              amountInToman = order.amount; // به صورت تومان ذخیره شده
            }

            // ارسال نوتیفیکیشن تلگرام
            if (user.telegramID) {
              await telegramBot.sendOrderCompletionNotification(
                user.telegramID,
                order.orderNumber,
                productName,
                amountInToman
              );
            }

            // ایجاد نوتیفیکیشن درون اپ
            await notificationService.createNotification(
              order.userId,
              'order',
              'خرید شما موفق بود',
              `سفارش شما با شماره ${order.orderNumber} با موفقیت ثبت و پرداخت شد.\n\n🛍️ محصول: ${productName}\n💵 مبلغ: ${amountInToman.toLocaleString('fa-IR')} تومان\n\n✅ پس از تایید توسط کارشناسان ما، وضعیت سفارش شما تغییر خواهد کرد و محصول به شما تحویل داده خواهد شد.`,
              `${FRONTEND_URL}/dashboard`
            );

            // ارسال گزارش ادمین
            await telegramBot.sendAdminOrderReport(
              order.userId,
              order.orderNumber,
              productName,
              amountInToman,
              'OnlineGateway',
              null
            );

            // گزارش کانال دوم (گزارش خرید کاربران)
            try {
              await telegramBot.sendSecondChannelOrderReport(order.userId, order.orderNumber);
            } catch (secondChannelError) {
              console.error('[Order Callback] Error sending second channel order report:', secondChannelError);
            }
          }
        } catch (error) {
          console.error('[Order Callback] Error sending completion notifications:', error);
        }
      }

      const redirectUrl = `${FRONTEND_URL}/shop/product/${order.productId}/buy/success?orderNumber=${order.orderNumber}`;
      res.redirect(redirectUrl);
    } else {
      console.log(`[Order Callback] Payment failed - Transaction status: ${transaction.status}, Order status: ${order.status}`);
      if (order.status === 'pending') {
        console.log(`[Order Callback] Updating order ${order.id} to failed status`);
        
        // به‌روزرسانی transaction (فقط اگر وضعیت هنوز pending بود)
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
          console.log(`[Order Callback] Transaction ${transaction.id} updated to failed`);
        } else {
          console.log(`[Order Callback] Transaction ${transaction.id} already processed with status: ${transaction.status}, skipping transaction update`);
        }

        // به‌روزرسانی سفارش
        const updateOrderQuery = `
          UPDATE orders 
          SET status = 'failed'
          WHERE id = ?
        `;
        
        await mysql.query(updateOrderQuery, [order.id]);
        console.log(`[Order Callback] Order ${order.orderNumber} updated to failed successfully`);

        // اگر از موجودی کیف پول استفاده شده بود، آن را برگردانیم
        if (order.paidAmount > 0) {
          console.log(`[Order Callback] Restoring wallet balance - Paid amount: ${order.paidAmount}, User ID: ${order.userId}`);
          
          const restoreWalletQuery = `
            UPDATE users 
            SET walletBalance = walletBalance + ? 
            WHERE id = ?
          `;
          
          const amountInRial = order.paidAmount * 10;
          await mysql.query(restoreWalletQuery, [amountInRial, order.userId]);
          
          // به‌روزرسانی cache کاربر
          await refreshUserCache(order.userId);
          
          console.log(`[Order Callback] Restored ${order.paidAmount} Tomans to user ${order.userId} wallet due to failed payment`);
        } else {
          console.log(`[Order Callback] No wallet amount to restore for order ${order.orderNumber}`);
        }
      } else {
        console.log(`[Order Callback] Order ${order.orderNumber} already processed, skipping update`);
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
// دریافت لیست سفارشات کاربر
router.get('/', authenticate, generalRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    const query = `
      SELECT
        o.id,
        o.userId,
        o.orderNumber,
        o.productId,
        p.productName,
        p.imagePath,
        p.duration,
        p.activationTimeMinutes,
        o.amount,
        o.paymentMethod,
        o.status,
        o.deliveryStatus,
        o.createdAt,
        o.completedAt
      FROM orders o
      LEFT JOIN products p ON o.productId = p.id
      WHERE o.userId = ?
      AND o.status IN ('completed', 'processing', 'delivered')
      ORDER BY o.createdAt DESC
    `;

    const orders = await mysql.query(query, [userId]);

    res.json({
      status: 1,
      message: 'Orders retrieved successfully',
      data: orders || []
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

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
        o.deliveryStatus,
        o.adminMessage,
        o.transactionId,
        o.walletAddress,
        o.createdAt,
        o.updatedAt,
        o.completedAt,
        p.productName,
        p.category,
        p.accountType,
        p.activationType,
        p.activationTimeMinutes,
        p.duration,
        p.regularPrice,
        p.merchantPrice,
        p.imagePath,
        p.additionalInfo,
        t.refNumber,
        t.cardNumber,
        t.trackId,
        t.status as transactionStatus,
        t.paidAt as transactionPaidAt
      FROM orders o
      LEFT JOIN products p ON o.productId = p.id
      LEFT JOIN transactions t ON o.transactionId = t.id
      WHERE (o.orderNumber = ? OR o.id = ?) AND o.userId = ? AND o.status = 'completed'`,
      [orderNumber, orderNumber, userId]
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
        id: order.id,
        orderNumber: order.orderNumber,
        productId: order.productId,
        paymentMethod: order.paymentMethod,
        orderEmail: order.orderEmail,
        amount: order.amount,
        status: order.status,
        deliveryStatus: order.deliveryStatus,
        adminMessage: order.adminMessage,
        transactionId: order.transactionId,
        walletAddress: order.walletAddress,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        completedAt: order.completedAt,
        date: order.createdAt, // برای سازگاری با کد قبلی
        refNumber: order.refNumber,
        cardNumber: order.cardNumber,
        trackId: order.trackId,
        transactionStatus: order.transactionStatus,
        transactionPaidAt: order.transactionPaidAt,
        productName: order.productName,
        category: order.category,
        accountType: order.accountType,
        activationType: order.activationType,
        activationTimeMinutes: order.activationTimeMinutes,
        duration: order.duration,
        regularPrice: order.regularPrice,
        merchantPrice: order.merchantPrice,
        imagePath: order.imagePath,
        additionalInfo: order.additionalInfo
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

// ============= ADMIN ROUTES =============

// دریافت آمار سفارشات امروز (برای داشبورد ادمین)
router.get('/admin/stats/today', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    // 1. Pending (Received) Orders Today - سفارشات در انتظار تایید امروز
    // deliveryStatus = 'received' AND createdAt = today
    const pendingQuery = `
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE deliveryStatus = 'received' 
      AND DATE(createdAt) = CURDATE()
      AND status = 'completed'
    `;

    // 2. Processing Orders Today - سفارشات در حال انجام امروز
    // deliveryStatus = 'processing' AND createdAt = today
    // Note: We use createdAt because usually "today's processing orders" refers to orders that came in today and are being processed.
    const processingQuery = `
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE deliveryStatus = 'processing' 
      AND DATE(createdAt) = CURDATE()
      AND status = 'completed'
    `;

    // 3. Completed Orders Today - سفارشات تکمیل شده امروز
    // deliveryStatus = 'delivered' AND completedAt = today
    const completedQuery = `
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE deliveryStatus = 'delivered' 
      AND DATE(completedAt) = CURDATE()
      AND status = 'completed'
    `;

    const pendingResult = await mysql.query(pendingQuery);
    const processingResult = await mysql.query(processingQuery);
    const completedResult = await mysql.query(completedQuery);

    res.json({
      status: 1,
      message: 'Stats retrieved successfully',
      data: {
        pendingOrders: pendingResult && pendingResult[0]?.count ? Number(pendingResult[0].count) : 0,
        processingOrders: processingResult && processingResult[0]?.count ? Number(processingResult[0].count) : 0,
        completedOrders: completedResult && completedResult[0]?.count ? Number(completedResult[0].count) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ status: 0, message: 'Internal server error' });
  }
});

// دریافت لیست تمام سفارشات (فقط برای ادمین)
router.get('/admin/all', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const { deliveryStatus } = req.query;
    
    let query = `
      SELECT 
        o.id,
        o.userId,
        o.orderNumber,
        o.productId,
        o.paymentMethod,
        o.orderEmail,
        o.amount,
        o.paidAmount,
        o.status,
        o.deliveryStatus,
        o.adminMessage,
        o.transactionId,
        o.walletAddress,
        o.createdAt,
        o.updatedAt,
        o.completedAt,
        u.userName,
        u.phoneNumber,
        u.telegramID,
        u.userEmail as userEmail,
        u.loginInfo,
        p.productName,
        p.category,
        p.accountType,
        p.activationType,
        p.imagePath,
        t.refNumber,
        t.cardNumber,
        t.trackId,
        t.paidAt as transactionPaidAt
      FROM orders o
      LEFT JOIN users u ON o.userId = u.id
      LEFT JOIN products p ON o.productId = p.id
      LEFT JOIN transactions t ON o.transactionId = t.id
    `;
    
    const params = [];
    
    if (deliveryStatus) {
      query += ' WHERE o.deliveryStatus = ? AND o.status != \'pending\'';
      params.push(deliveryStatus);
    } else {
      query += ' WHERE o.status != \'pending\'';
    }
    
    query += ' ORDER BY o.createdAt DESC';
    
    const orders = await mysql.query(query, params);
    
    res.json({
      status: 1,
      message: 'Orders retrieved successfully',
      data: orders || []
    });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// دریافت جزئیات یک سفارش خاص (فقط برای ادمین)
router.get('/admin/:id', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const orderId = req.params.id;
    
    const query = `
      SELECT 
        o.id,
        o.userId,
        o.orderNumber,
        o.productId,
        o.paymentMethod,
        o.orderEmail,
        o.amount,
        o.paidAmount,
        o.status,
        o.deliveryStatus,
        o.adminMessage,
        o.transactionId,
        o.walletAddress,
        o.createdAt,
        o.updatedAt,
        o.completedAt,
        u.userName,
        u.phoneNumber,
        u.telegramID,
        u.userEmail as userEmail,
        u.loginInfo,
        u.role,
        p.productName,
        p.category,
        p.accountType,
        p.activationType,
        p.activationTimeMinutes,
        p.duration,
        p.regularPrice,
        p.merchantPrice,
        p.imagePath,
        p.additionalInfo,
        t.refNumber,
        t.cardNumber,
        t.trackId,
        t.status as transactionStatus,
        t.paidAt as transactionPaidAt,
        t.createdAt as transactionCreatedAt
      FROM orders o
      LEFT JOIN users u ON o.userId = u.id
      LEFT JOIN products p ON o.productId = p.id
      LEFT JOIN transactions t ON o.transactionId = t.id
      WHERE o.id = ? OR o.orderNumber = ?
    `;
    
    const orders = await mysql.query(query, [orderId, orderId]);
    
    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Order not found'
      });
    }
    
    res.json({
      status: 1,
      message: 'Order details retrieved successfully',
      data: orders[0]
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

// به‌روزرسانی وضعیت تحویل سفارش (فقط برای ادمین)
router.put('/admin/:id/delivery-status', authenticate, requireAdmin, generalRateLimiter, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { deliveryStatus, adminMessage } = req.body;
    
    // اعتبارسنجی وضعیت تحویل
    const validStatuses = ['received', 'processing', 'delivered'];
    if (!deliveryStatus || !validStatuses.includes(deliveryStatus)) {
      return res.status(400).json({
        status: 0,
        message: 'Invalid delivery status. Valid values: received, processing, delivered'
      });
    }
    
    // دریافت اطلاعات سفارش قبل از به‌روزرسانی
    const orderQuery = `
      SELECT 
        o.*,
        u.telegramID,
        u.phoneNumber,
        p.productName
      FROM orders o
      LEFT JOIN users u ON o.userId = u.id
      LEFT JOIN products p ON o.productId = p.id
      WHERE o.id = ? OR o.orderNumber = ?
    `;
    
    const orders = await mysql.query(orderQuery, [orderId, orderId]);
    
    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: 0,
        message: 'Order not found'
      });
    }
    
    const order = orders[0];
    const oldStatus = order.deliveryStatus;
    
    // فقط اگر وضعیت تغییر کرده باشد، پیام ارسال می‌کنیم
    if (oldStatus === deliveryStatus) {
      // وضعیت تغییر نکرده، فقط به‌روزرسانی می‌کنیم (با یا بدون adminMessage)
      const updateQuery = adminMessage !== undefined
        ? `UPDATE orders SET deliveryStatus = ?, adminMessage = ?, updatedAt = NOW() WHERE id = ? OR orderNumber = ?`
        : `UPDATE orders SET deliveryStatus = ?, updatedAt = NOW() WHERE id = ? OR orderNumber = ?`;
      
      const updateParams = adminMessage !== undefined 
        ? [deliveryStatus, adminMessage || null, orderId, orderId]
        : [deliveryStatus, orderId, orderId];
      
      await mysql.query(updateQuery, updateParams);
      
      return res.json({
        status: 1,
        message: 'Delivery status updated successfully'
      });
    }
    
    // به‌روزرسانی وضعیت (با یا بدون adminMessage)
    const updateQuery = adminMessage !== undefined
      ? `UPDATE orders SET deliveryStatus = ?, adminMessage = ?, updatedAt = NOW() WHERE id = ? OR orderNumber = ?`
      : `UPDATE orders SET deliveryStatus = ?, updatedAt = NOW() WHERE id = ? OR orderNumber = ?`;
    
    const updateParams = adminMessage !== undefined 
      ? [deliveryStatus, adminMessage || null, orderId, orderId]
      : [deliveryStatus, orderId, orderId];
    
    await mysql.query(updateQuery, updateParams);
    
    // ارسال پیام‌ها برای وضعیت‌های processing و delivered
    if (deliveryStatus === 'processing' || deliveryStatus === 'delivered') {
      try {
        // ارسال پیام تلگرام
        if (order.telegramID) {
          try {
            await telegramBot.sendOrderDeliveryStatusNotification(
              order.telegramID,
              order.orderNumber,
              order.productName || 'نامشخص',
              deliveryStatus
            );
          } catch (telegramError) {
            console.error('[Order Routes] Error sending Telegram delivery status notification:', telegramError);
          }
        }
        
        // ارسال SMS فقط برای وضعیت delivered
        if (deliveryStatus === 'delivered' && order.phoneNumber) {
          try {
            const smsService = require('../services/smsService');
            await smsService.sendOrderDeliveredSMS(
              order.phoneNumber,
              order.orderNumber,
              order.productName || 'نامشخص'
            );
          } catch (smsError) {
            console.error('[Order Routes] Error sending SMS delivery notification:', smsError);
          }
        }
        
        // ایجاد نوتیفیکیشن درون اپ
        try {
          const FRONTEND_URL = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
          let notificationTitle = '';
          let notificationMessage = '';
          
          if (deliveryStatus === 'processing') {
            notificationTitle = 'در حال پردازش';
            notificationMessage = `سفارش شما با شماره ${order.orderNumber} در حال پردازش می‌باشد و به زودی برای شما ارسال خواهد شد.`;
          } else if (deliveryStatus === 'delivered') {
            notificationTitle = 'تحویل شده';
            notificationMessage = `سفارش شما با شماره ${order.orderNumber} با موفقیت آماده و تحویل داده شده است.`;
          }
          
          await notificationService.createNotification(
            order.userId,
            'order',
            notificationTitle,
            notificationMessage,
            `${FRONTEND_URL}/dashboard`
          );
        } catch (notificationError) {
          console.error('[Order Routes] Error creating delivery status notification:', notificationError);
        }
      } catch (error) {
        console.error('[Order Routes] Error sending delivery status notifications:', error);
        // خطا را لاگ می‌کنیم ولی پاسخ موفقیت‌آمیز برمی‌گردانیم چون وضعیت به‌روزرسانی شده
      }
    }
    
    res.json({
      status: 1,
      message: 'Delivery status updated successfully'
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    res.status(500).json({
      status: 0,
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

