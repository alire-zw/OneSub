require('dotenv').config();
const express = require('express');
const mysql = require('./database/mysql');
const redis = require('./database/redis');
const { 
  securityHeaders, 
  generalRateLimiter, 
  bodySizeLimiter,
  headerFilter 
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 4536;

app.set('trust proxy', 1);

// CORS middleware - باید قبل از security headers باشد
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // در development همه origin ها را قبول می‌کنیم
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  } else {
    const allowedOrigins = [
      'http://localhost:8903',
      'http://localhost:3000',
      'https://web.telegram.org',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // اجازه دسترسی به تمام subdomain های telegram
    const isTelegramOrigin = origin && origin.match(/^https:\/\/.*\.telegram\.org$/);
    
    if (origin && (allowedOrigins.includes(origin) || isTelegramOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use(securityHeaders);
app.use(generalRateLimiter);
app.use(bodySizeLimiter);
app.use(headerFilter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Serve static files from uploads directory
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const smsRoutes = require('./routes/smsRoutes');
const userRoutes = require('./routes/userRoutes');
const walletRoutes = require('./routes/walletRoutes');
const cryptoRoutes = require('./routes/cryptoRoutes');
const samanRoutes = require('./routes/samanRoutes');
const cardRoutes = require('./routes/cardRoutes');
const productRoutes = require('./routes/productRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
app.use('/api/sms', smsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/saman', samanRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tickets', ticketRoutes);

// Initialize Telegram Bot
const telegramBot = require('./services/telegramBot');
telegramBot.initBot();

app.get('/health', async (req, res) => {
  try {
    const dbStatus = await mysql.query('SELECT 1');
    const redisClient = await redis.connect();
    await redisClient.ping();
    
    res.json({
      status: 'ok',
      database: 'connected',
      redis: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

const startServer = async () => {
  try {
    await mysql.createPool();
    console.log('MySQL connection pool created');

    const { runMigrations } = require('./database/migrations');
    await runMigrations();

    await redis.connect();
    console.log('Redis client connected');

    // Start crypto payment monitoring (every 30 seconds)
    const { startMonitoring: startCryptoMonitoring } = require('./services/cryptoMonitor');
    startCryptoMonitoring();

    // Start bank payment monitoring (random intervals 10-59 seconds)
    const { startMonitoring: startBankMonitoring } = require('./services/bankPaymentMonitor');
    startBankMonitoring();

    // Start Saman Bank bill statement monitoring
    const { startMonitoring: startSamanMonitoring } = require('./services/samanService');
    startSamanMonitoring();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = async () => {
  console.log('Shutting down server...');
  
  // Stop crypto monitoring
  const { stopMonitoring: stopCryptoMonitoring } = require('./services/cryptoMonitor');
  stopCryptoMonitoring();
  
  // Stop Saman monitoring
  const { stopMonitoring: stopSamanMonitoring } = require('./services/samanService');
  stopSamanMonitoring();
  
  await mysql.closePool();
  await redis.closeConnection();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();

module.exports = app;

