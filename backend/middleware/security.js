const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const redis = require('../database/redis');

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "https://telegram.org"],
      imgSrc: ["'self'", "data:", "https:", "https://t.me"],
      fontSrc: ["'self'", "data:", "https://osf.mirall.ir"],
      connectSrc: ["'self'", "http://localhost:4536", "http://localhost:8903", "https://api.sms.ir"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  xContentTypeOptions: true,
  xFrameOptions: { action: 'sameorigin' },
  xXssProtection: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    status: 0,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

const getClientIP = (req) => {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
};

const createRedisRateLimiter = (windowMs, max, keyPrefix) => {
  return async (req, res, next) => {
    try {
      const redisClient = await redis.connect();
      const clientIP = getClientIP(req);
      const key = `${keyPrefix}:${clientIP}`;
      const current = await redisClient.get(key);

      if (current && parseInt(current) >= max) {
        return res.status(429).json({
          status: 0,
          message: 'Too many requests, please try again later'
        });
      }

      if (current) {
        await redisClient.incr(key);
      } else {
        await redisClient.setEx(key, Math.ceil(windowMs / 1000), '1');
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next();
    }
  };
};

const smsRateLimiter = createRedisRateLimiter(
  15 * 60 * 1000,
  10,
  'rate_limit:sms'
);

const verifyRateLimiter = createRedisRateLimiter(
  15 * 60 * 1000,
  20,
  'rate_limit:verify'
);

const bodySizeLimiter = (req, res, next) => {
  // Skip size limit for file uploads (multipart/form-data)
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return next();
  }
  
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 10240) {
    return res.status(413).json({
      status: 0,
      message: 'Request body too large'
    });
  }
  next();
};

const suspiciousHeaders = [
  'x-originating-ip',
  'x-remote-ip',
  'x-remote-addr'
];

const headerFilter = (req, res, next) => {
  const requestHeaders = Object.keys(req.headers).map(h => h.toLowerCase());
  const foundSuspicious = requestHeaders.filter(header => 
    suspiciousHeaders.includes(header)
  );

  if (foundSuspicious.length > 0) {
    console.warn(`Suspicious headers detected from ${getClientIP(req)}:`, foundSuspicious);
  }

  const headerSize = JSON.stringify(req.headers).length;
  if (headerSize > 8192) {
    return res.status(400).json({
      status: 0,
      message: 'Request headers too large'
    });
  }

  next();
};

module.exports = {
  securityHeaders,
  generalRateLimiter,
  smsRateLimiter,
  verifyRateLimiter,
  bodySizeLimiter,
  headerFilter
};

