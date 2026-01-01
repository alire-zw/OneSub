const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jalaali = require('jalaali-js');

const SAMAN_BASE_URL = 'https://ib.sb24.ir/webbank';
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const SESSION_FILE = path.join(__dirname, 'session.json');

// کوکی‌های ذخیره شده (از فایل یا مقدار پیش‌فرض)
let COOKIES = {};

// Session data
let SESSION = null;

// بارگذاری کوکی‌ها از فایل
function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const data = fs.readFileSync(COOKIES_FILE, 'utf8');
      COOKIES = JSON.parse(data);
      console.log('✅ Cookies loaded from file');
      return true;
    }
  } catch (error) {
    console.log('⚠️  Could not load cookies:', error.message);
  }
  return false;
}

// ذخیره کوکی‌ها در فایل
function saveCookies(cookies) {
  try {
    COOKIES = { ...COOKIES, ...cookies };
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(COOKIES, null, 2), 'utf8');
    console.log('✅ Cookies saved to file');
    return true;
  } catch (error) {
    console.error('❌ Error saving cookies:', error.message);
    return false;
  }
}

// استخراج کوکی‌ها از Set-Cookie headers
function extractCookiesFromHeaders(setCookieHeaders) {
  const cookies = {};
  
  if (Array.isArray(setCookieHeaders)) {
    setCookieHeaders.forEach(cookieHeader => {
      // Parse cookie: name=value; Path=/; Domain=...
      const parts = cookieHeader.split(';');
      const nameValue = parts[0].trim().split('=');
      if (nameValue.length === 2) {
        cookies[nameValue[0]] = nameValue[1];
      }
    });
  } else if (typeof setCookieHeaders === 'string') {
    // Handle single cookie or multiple cookies separated by newline
    const cookieStrings = setCookieHeaders.split('\n');
    cookieStrings.forEach(cookieHeader => {
      const parts = cookieHeader.split(';');
      const nameValue = parts[0].trim().split('=');
      if (nameValue.length === 2) {
        cookies[nameValue[0]] = nameValue[1];
      }
    });
  }
  
  return cookies;
}

/**
 * بارگذاری session از فایل
 * @returns {Object|null} Session data یا null
 */
function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = fs.readFileSync(SESSION_FILE, 'utf8');
      SESSION = JSON.parse(data);
      console.log('✅ Session loaded from file');
      return SESSION;
    }
  } catch (error) {
    console.log('⚠️  Could not load session:', error.message);
  }
  return null;
}

/**
 * ذخیره session در فایل
 * @param {Object} sessionData - داده‌های session
 * @returns {boolean} موفقیت عملیات
 */
function saveSession(sessionData) {
  try {
    SESSION = {
      ...sessionData,
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(SESSION, null, 2), 'utf8');
    console.log('✅ Session saved to file');
    return true;
  } catch (error) {
    console.error('❌ Error saving session:', error.message);
    return false;
  }
}

/**
 * بررسی معتبر بودن session
 * @param {Object} session - Session data (اختیاری - اگر داده نشود از SESSION استفاده می‌کند)
 * @returns {boolean} true اگر session معتبر باشد
 */
function isSessionValid(session = null) {
  const currentSession = session || SESSION;
  
  if (!currentSession) {
    return false;
  }
  
  // بررسی وجود csrfToken
  if (!currentSession.csrfToken && !COOKIES.csrfToken) {
    return false;
  }
  
  // بررسی وجود userInfo
  if (!currentSession.userInfo || !currentSession.userInfo.id) {
    return false;
  }
  
  // بررسی تاریخ انقضای session
  if (currentSession.authExpiration && currentSession.authExpiration.sessionExpirationDate) {
    const expirationTime = currentSession.authExpiration.sessionExpirationDate;
    const now = Date.now();
    
    // Buffer time: 5 دقیقه قبل از انقضای کامل، session را منقضی شده در نظر می‌گیریم
    const bufferTime = 5 * 60 * 1000; // 5 دقیقه به میلی‌ثانیه
    const effectiveExpirationTime = expirationTime - bufferTime;
    
    // اگر session منقضی شده باشد (با buffer time)
    if (now >= effectiveExpirationTime) {
      console.log('⚠️  Session expired (with buffer time)');
      return false;
    }
    
    // بررسی timeToIdle
    const timeToIdle = currentSession.authExpiration.timeToIdle || 300; // 5 دقیقه پیش‌فرض
    const lastActivity = currentSession.lastActivity || currentSession.savedAt;
    
    if (lastActivity) {
      const lastActivityTime = new Date(lastActivity).getTime();
      const idleTime = now - lastActivityTime;
      const idleTimeSeconds = Math.floor(idleTime / 1000);
      
      // اگر بیش از timeToIdle گذشته باشد، session ممکن است منقضی شده باشد
      if (idleTimeSeconds > timeToIdle) {
        console.log(`⚠️  Session idle for ${idleTimeSeconds}s (exceeds ${timeToIdle}s)`);
        return false;
      }
    }
  } else {
    // اگر تاریخ انقضا وجود نداشته باشد، session را معتبر در نظر نمی‌گیریم
    console.log('⚠️  No expiration date in session');
    return false;
  }
  
  return true;
}

/**
 * اطمینان از معتبر بودن session - اگر معتبر نبود، لاگین می‌کند
 * @param {string} username - نام کاربری (در صورت نیاز به لاگین)
 * @param {string} password - رمز عبور (در صورت نیاز به لاگین)
 * @returns {Promise<Object>} Session data
 */
async function ensureValidSession(username = null, password = null) {
  // بارگذاری session از فایل
  if (!SESSION) {
    loadSession();
  }
  
  // بررسی معتبر بودن session
  if (isSessionValid()) {
    console.log('✅ Valid session found, using existing session');
    
    // به‌روزرسانی lastActivity
    if (SESSION) {
      SESSION.lastActivity = new Date().toISOString();
      saveSession(SESSION);
    }
    
    // اطمینان از وجود csrfToken در cookies
    if (SESSION.csrfToken && !COOKIES.csrfToken) {
      saveCookies({ csrfToken: SESSION.csrfToken });
    }
    
    return {
      success: true,
      session: SESSION,
      csrfToken: SESSION.csrfToken || COOKIES.csrfToken,
      userInfo: SESSION.userInfo,
      isNewLogin: false
    };
  }
  
  // اگر session معتبر نبود، لاگین می‌کنیم
  console.log('⚠️  Session invalid or expired, logging in...');
  
  if (!username || !password) {
    // سعی می‌کنیم از environment variables استفاده کنیم
    username = username || process.env.SAMAN_USERNAME || 'onebit.ir';
    password = password || process.env.SAMAN_PASSWORD || 'Alireza1380#';
  }
  
  const loginResult = await login(username, password);
  
  if (!loginResult.success) {
    return {
      success: false,
      message: loginResult.message || 'Login failed',
      error: loginResult
    };
  }
  
  // ذخیره session
  const sessionData = {
    csrfToken: loginResult.csrfToken || COOKIES.csrfToken,
    userInfo: loginResult.userInfo || loginResult.data?.userInfoResponseModel,
    authExpiration: loginResult.data?.authExpiration || loginResult.data?.authExpirationResponseModel,
    passwordExpiration: loginResult.data?.passwordExpiration,
    lastClientAddress: loginResult.data?.lastClientAddress,
    twoPhaseLoginWithTicketRequired: loginResult.data?.twoPhaseLoginWithTicketRequired,
    gender: loginResult.data?.gender,
    lastActivity: new Date().toISOString()
  };
  
  saveSession(sessionData);
  
  return {
    success: true,
    session: SESSION,
    csrfToken: sessionData.csrfToken,
    userInfo: sessionData.userInfo,
    isNewLogin: true
  };
}

// بارگذاری کوکی‌ها و session در شروع
loadCookies();
loadSession();

// تبدیل کوکی‌ها به string
function getCookieString() {
  return Object.entries(COOKIES)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

// تولید x-request-id
function generateRequestId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'NW-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Headers مشترک
function getCommonHeaders(csrfToken = null) {
  return {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Cookie': getCookieString(),
    'Host': 'ib.sb24.ir',
    'Origin': 'https://ib.sb24.ir',
    'Referer': 'https://ib.sb24.ir/webbank/home/page/billStatements',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
    'X-Request-ID': generateRequestId(),
    'X-Timezone': 'Asia/Tehran',
    ...(csrfToken && { 'csrfToken': csrfToken })
  };
}

/**
 * لاگین به سیستم بانک سامان
 * @param {string} username - نام کاربری
 * @param {string} password - رمز عبور
 * @returns {Promise<Object>} نتیجه لاگین
 */
async function login(username, password) {
  try {
    console.log('🔐 Logging in...');

    // ابتدا صفحه اصلی را باز می‌کنیم تا کوکی‌های اولیه را بگیریم
    const initialHeaders = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
      'Host': 'ib.sb24.ir',
      'Referer': 'https://ib.sb24.ir/webbank/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0'
    };

    // Get initial cookies
    const initialResponse = await axios.get(`${SAMAN_BASE_URL}/index`, {
      headers: initialHeaders,
      maxRedirects: 5
    });

    // Extract initial cookies
    if (initialResponse.headers['set-cookie']) {
      const initialCookies = extractCookiesFromHeaders(initialResponse.headers['set-cookie']);
      saveCookies(initialCookies);
    }

    // Build cookie string for login
    const cookieString = getCookieString();

    // Headers for login
    const loginHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
      'Content-Type': 'application/json',
      'Cookie': cookieString,
      'Host': 'ib.sb24.ir',
      'Origin': 'https://ib.sb24.ir',
      'Referer': 'https://ib.sb24.ir/webbank/index',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
      'X-Request-ID': generateRequestId(),
      'X-Timezone': 'Asia/Tehran'
    };

    const requestBody = {
      data: {
        loginType: "STATIC_PASSWORD",
        username: username,
        password: password
      },
      context: {
        data: [
          { key: "language", value: "fa" }
        ]
      }
    };

    const response = await axios.post(
      `${SAMAN_BASE_URL}/api/auth/login`,
      requestBody,
      { headers: loginHeaders }
    );

    // Extract cookies from login response
    if (response.headers['set-cookie']) {
      const loginCookies = extractCookiesFromHeaders(response.headers['set-cookie']);
      saveCookies(loginCookies);
    }

    // Extract csrfToken from header
    const csrfToken = response.headers['csrftoken'] || response.headers['csrf-token'];

    if (response.status === 200 && response.data) {
      console.log('✅ Login successful!');
      
      // Save csrfToken to cookies
      if (csrfToken) {
        saveCookies({ csrfToken: csrfToken });
      }

      // ذخیره session
      const sessionData = {
        csrfToken: csrfToken,
        userInfo: response.data.userInfoResponseModel,
        authExpiration: response.data.authExpiration || response.data.authExpirationResponseModel,
        passwordExpiration: response.data.passwordExpiration,
        lastClientAddress: response.data.lastClientAddress,
        twoPhaseLoginWithTicketRequired: response.data.twoPhaseLoginWithTicketRequired,
        gender: response.data.gender,
        lastActivity: new Date().toISOString()
      };
      saveSession(sessionData);

      return {
        success: true,
        data: response.data,
        csrfToken: csrfToken,
        userInfo: response.data.userInfoResponseModel,
        authExpiration: response.data.authExpiration || response.data.authExpirationResponseModel
      };
    } else {
      return {
        success: false,
        message: 'Invalid response from server',
        statusCode: response.status
      };
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Login failed',
        statusCode: error.response.status,
        data: error.response.data
      };
    }

    return {
      success: false,
      message: error.message || 'Failed to login'
    };
  }
}

/**
 * دریافت موجودی حساب‌ها (DEPOSIT)
 * @param {string} csrfToken - CSRF Token (اختیاری - از cookies گرفته می‌شود)
 * @param {string} currentUserType - نوع کاربر (OWNER)
 * @param {string} currentUserId - ID کاربر
 * @returns {Promise<Object>} نتیجه استعلام
 */
async function getDepositBalance(csrfToken = null, currentUserType = 'OWNER', currentUserId = '3671457') {
  // اگر csrfToken داده نشده، از cookies بگیر
  if (!csrfToken) {
    csrfToken = COOKIES.csrfToken || null;
  }
  try {
    console.log('📊 Getting deposit balance...');

    const headers = getCommonHeaders(csrfToken);
    headers['Content-Type'] = 'application/json';

    const requestBody = {
      data: {
        DEPOSIT: {
          "@type": "DEPOSIT",
          depositGroup: "ALL"
        }
      },
      context: {
        data: [
          { key: "CurrentUserType", value: currentUserType },
          { key: "CurrentUserId", value: currentUserId },
          { key: "language", value: "fa" }
        ]
      }
    };

    const response = await axios.post(
      `${SAMAN_BASE_URL}/api/transactionResources`,
      requestBody,
      { headers }
    );

    if (response.status === 200 && response.data) {
      console.log('✅ Deposit balance retrieved successfully');
      return {
        success: true,
        data: response.data
      };
    } else {
      return {
        success: false,
        message: 'Invalid response from server',
        statusCode: response.status
      };
    }
  } catch (error) {
    console.error('❌ Error getting deposit balance:', error.message);
    
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Failed to get deposit balance',
        statusCode: error.response.status,
        data: error.response.data
      };
    }

    return {
      success: false,
      message: error.message || 'Failed to get deposit balance'
    };
  }
}

/**
 * دریافت صورتحساب سپرده
 * @param {string} depositNumber - شماره سپرده (مثال: 9451-810-5024276-1)
 * @param {string} fromDate - تاریخ شروع (ISO format)
 * @param {string} toDate - تاریخ پایان (ISO format)
 * @param {string} order - ترتیب (ASC یا DESC)
 * @param {number} length - تعداد رکوردها
 * @param {number} offset - آفست
 * @param {string} csrfToken - CSRF Token (اختیاری - از cookies گرفته می‌شود)
 * @param {string} currentUserType - نوع کاربر (OWNER)
 * @param {string} currentUserId - ID کاربر
 * @returns {Promise<Object>} نتیجه استعلام
 */
async function getDepositBillStatement(depositNumber, fromDate, toDate, order = 'DESC', length = 10, offset = 0, csrfToken = null, currentUserType = 'OWNER', currentUserId = '3671457') {
  // اگر csrfToken داده نشده، از cookies بگیر
  if (!csrfToken) {
    csrfToken = COOKIES.csrfToken || null;
  }
  try {
    console.log('📋 Getting deposit bill statement...');

    const headers = getCommonHeaders(csrfToken);

    // Build query parameters
    const params = new URLSearchParams({
      depositNumber: depositNumber,
      fromDate: fromDate,
      toDate: toDate,
      order: order,
      length: length.toString(),
      offset: offset.toString(),
      'data[0].key': 'CurrentUserType',
      'data[0].value': currentUserType,
      'data[1].key': 'CurrentUserId',
      'data[1].value': currentUserId,
      'data[2].key': 'language',
      'data[2].value': 'fa'
    });

    const response = await axios.get(
      `${SAMAN_BASE_URL}/api/billStatement/depositBill?${params.toString()}`,
      { headers }
    );

    // Check if response is HTML
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      return {
        success: false,
        message: 'Server returned HTML instead of JSON',
        htmlResponse: response.data.substring(0, 500)
      };
    }

    if (response.status === 200 && response.data) {
      console.log('✅ Bill statement retrieved successfully');
      return {
        success: true,
        data: response.data
      };
    } else {
      return {
        success: false,
        message: 'Invalid response from server',
        statusCode: response.status
      };
    }
  } catch (error) {
    console.error('❌ Error getting bill statement:', error.message);
    
    if (error.response) {
      const statusCode = error.response.status;
      
      // خطای 401 (Unauthorized) به معنای منقضی شدن session است
      if (statusCode === 401) {
        return {
          success: false,
          message: 'Session expired or unauthorized (401)',
          statusCode: 401,
          isSessionError: true,
          data: error.response.data
        };
      }
      
      // Check if response is HTML
      if (typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
        return {
          success: false,
          message: 'Server returned HTML instead of JSON',
          statusCode: statusCode,
          isSessionError: true,
          htmlResponse: error.response.data.substring(0, 500)
        };
      }

      return {
        success: false,
        message: error.response.data?.message || 'Failed to get bill statement',
        statusCode: statusCode,
        data: error.response.data
      };
    }

    return {
      success: false,
      message: error.message || 'Failed to get bill statement'
    };
  }
}

/**
 * تبدیل timestamp به تاریخ شمسی
 * @param {number} timestamp - timestamp به میلی‌ثانیه
 * @returns {Object} تاریخ شمسی با فرمت {year, month, day, dateString, timeString}
 */
function timestampToJalali(timestamp) {
  const date = new Date(timestamp);
  const jalaliDate = jalaali.toJalaali(date);
  
  const year = jalaliDate.jy;
  const month = String(jalaliDate.jm).padStart(2, '0');
  const day = String(jalaliDate.jd).padStart(2, '0');
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  const monthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];
  
  return {
    year,
    month: jalaliDate.jm,
    day: jalaliDate.jd,
    monthName: monthNames[jalaliDate.jm - 1],
    dateString: `${year}/${month}/${day}`,
    dateStringWithMonthName: `${day} ${monthNames[jalaliDate.jm - 1]} ${year}`,
    timeString: `${hours}:${minutes}:${seconds}`,
    fullDateTime: `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`,
    timestamp: timestamp
  };
}

/**
 * استخراج شماره شبا از description
 * @param {string} description - توضیحات تراکنش
 * @returns {string|null} شماره شبا
 */
function extractIBAN(description) {
  // الگوهای مختلف برای استخراج شبا
  const ibanPatterns = [
    /IR\d{24}/g,  // IR + 24 رقم
    /شبا\s*:?\s*(IR\d{24})/gi,
    /IBAN\s*:?\s*(IR\d{24})/gi,
    /شماره\s*شبا\s*:?\s*(IR\d{24})/gi
  ];
  
  for (const pattern of ibanPatterns) {
    const match = description.match(pattern);
    if (match) {
      // اگر IR در match باشد، آن را برگردان
      const iban = match.find(m => m.startsWith('IR'));
      if (iban) return iban;
      // اگر IR در match نباشد، از match بعدی استفاده کن
      const ibanMatch = description.match(/IR\d{24}/);
      if (ibanMatch) return ibanMatch[0];
    }
  }
  
  return null;
}

/**
 * استخراج اطلاعات واریز کننده از description
 * @param {string} description - توضیحات تراکنش
 * @returns {Object} اطلاعات واریز کننده
 */
function extractPayerInfo(description) {
  const info = {
    name: null,
    shaba: null,
    accountNumber: null,
    nationalId: null,
    description: description
  };
  
  // استخراج شبا
  info.shaba = extractIBAN(description);
  
  // استخراج شماره حساب (ش.پ)
  const accountPatterns = [
    /ش\.پ\s*(\d+)/gi,
    /شماره\s*پرداخت\s*:?\s*(\d+)/gi,
    /شماره\s*حساب\s*:?\s*(\d+)/gi
  ];
  
  for (const pattern of accountPatterns) {
    const accountMatch = description.match(pattern);
    if (accountMatch) {
      const accountNumber = accountMatch[0].match(/\d+/);
      if (accountNumber) {
        info.accountNumber = accountNumber[0];
        break;
      }
    }
  }
  
  // استخراج کد ملی
  const nationalIdPatterns = [
    /کد\s*ملی\s*:?\s*(\d{10})/gi,
    /کد\s*ملی\s*(\d{10})/gi,
    /ملی\s*:?\s*(\d{10})/gi
  ];
  
  for (const pattern of nationalIdPatterns) {
    const nationalIdMatch = description.match(pattern);
    if (nationalIdMatch) {
      const nationalId = nationalIdMatch[0].match(/\d{10}/);
      if (nationalId) {
        info.nationalId = nationalId[0];
        break;
      }
    }
  }
  
  // استخراج نام - الگوهای مختلف
  // الگو 1: "از شبا IR... ش.پ ... - نام شخص"
  const pattern1 = /از\s+شبا\s+[^-]+?\s+ش\.پ\s+\d+\s*-\s*([^-]+?)(?:\s*-\s*|$)/;
  let match = description.match(pattern1);
  if (match && match[1]) {
    const name = match[1].trim();
    if (name.length > 2 && !/^\d+$/.test(name) && !name.match(/^\d{4}\/\d{2}\/\d{2}/)) {
      info.name = name;
    }
  }
  
  // الگو 2: "از شبا IR... - نام شخص"
  if (!info.name) {
    const pattern2 = /از\s+شبا\s+[^-]+?\s*-\s*([^-]+?)(?:\s*-\s*|$)/;
    match = description.match(pattern2);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 2 && !/^\d+$/.test(name) && !name.match(/^\d{4}\/\d{2}\/\d{2}/)) {
        info.name = name;
      }
    }
  }
  
  // الگو 3: "بلو بانک از شبا ... - نام شخص"
  if (!info.name) {
    const pattern3 = /بلو\s+بانک\s+از\s+شبا[^-]+?-\s*([^-]+?)(?:\s*-\s*|$)/;
    match = description.match(pattern3);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 2 && !/^\d+$/.test(name)) {
        info.name = name;
      }
    }
  }
  
  // الگو 4: "انتقال وجه ... از ... - نام شخص"
  if (!info.name) {
    const pattern4 = /انتقال\s+وجه[^-]+?-\s*([^-]+?)(?:\s*-\s*|$)/;
    match = description.match(pattern4);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 2 && !/^\d+$/.test(name) && !name.match(/^\d{4}\/\d{2}\/\d{2}/)) {
        info.name = name;
      }
    }
  }
  
  // الگو 5: اگر نام پیدا نشد، سعی کن از انتهای description بگیر (بعد از آخرین -)
  if (!info.name) {
    const parts = description.split('-');
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].trim();
      // بررسی کن که آیا این یک نام معتبر است
      if (lastPart.length > 2 && 
          !/^\d+$/.test(lastPart) && 
          !lastPart.match(/^\d{4}\/\d{2}\/\d{2}/) &&
          !lastPart.match(/^\d{4}[.-]\d{3}[.-]\d{7}/) &&
          !lastPart.includes('از') &&
          !lastPart.includes('تا')) {
        info.name = lastPart;
      }
    }
  }
  
  // الگو 6: اگر هنوز نام پیدا نشد، سعی کن از قبل از آخرین - بگیر
  if (!info.name && description.includes('-')) {
    const parts = description.split('-');
    if (parts.length > 2) {
      const secondLastPart = parts[parts.length - 2].trim();
      if (secondLastPart.length > 2 && 
          !/^\d+$/.test(secondLastPart) && 
          !secondLastPart.match(/^\d{4}\/\d{2}\/\d{2}/) &&
          !secondLastPart.match(/^\d{4}[.-]\d{3}[.-]\d{7}/)) {
        // بررسی کن که آیا شامل نام است
        const nameMatch = secondLastPart.match(/([آ-ی\s]+)/);
        if (nameMatch && nameMatch[1].trim().length > 2) {
          info.name = nameMatch[1].trim();
        }
      }
    }
  }
  
  return info;
}

/**
 * پردازش صورتحساب و استخراج اطلاعات واریزی‌ها
 * @param {Object} billStatementData - داده‌های صورتحساب از API
 * @param {string} depositNumber - شماره سپرده
 * @param {string} iban - شماره شبا سپرده
 * @returns {Object} اطلاعات پردازش شده واریزی‌ها
 */
function processDepositTransactions(billStatementData, depositNumber = null, iban = null) {
  if (!billStatementData || !billStatementData.billStatements) {
    return {
      success: false,
      message: 'Invalid bill statement data',
      transactions: []
    };
  }
  
  const transactions = billStatementData.billStatements.map((statement, index) => {
    const jalaliDate = timestampToJalali(statement.date);
    const payerInfo = extractPayerInfo(statement.description);
    
    // تشخیص نوع تراکنش
    const transactionType = statement.transferAmount > 0 ? 'deposit' : 'withdrawal';
    const isDeposit = transactionType === 'deposit';
    
    // استخراج اطلاعات بیشتر از description
    let sourceAccount = null;
    let destinationAccount = null;
    
    // اگر transferAmount مثبت باشد، واریز است
    if (isDeposit) {
      // سعی کن شماره حساب مبدا را پیدا کن
      const accountMatch = statement.description.match(/(\d{4}[.-]\d{3}[.-]\d{7}[.-]\d)/);
      if (accountMatch) {
        sourceAccount = accountMatch[1];
      }
    } else {
      // اگر منفی باشد، برداشت است
      const accountMatch = statement.description.match(/(\d{4}[.-]\d{3}[.-]\d{7}[.-]\d)/);
      if (accountMatch) {
        destinationAccount = accountMatch[1];
      }
    }
    
    return {
      id: statement.id,
      serial: statement.serial,
      date: {
        timestamp: statement.date,
        jalali: jalaliDate.dateString,
        jalaliWithMonthName: jalaliDate.dateStringWithMonthName,
        time: jalaliDate.timeString,
        fullDateTime: jalaliDate.fullDateTime,
        gregorian: new Date(statement.date).toISOString()
      },
      amount: {
        value: statement.transferAmount,
        absoluteValue: Math.abs(statement.transferAmount),
        formatted: Math.abs(statement.transferAmount).toLocaleString('fa-IR'),
        currency: billStatementData.currency || 'IRR',
        type: transactionType, // 'deposit' or 'withdrawal'
        isDeposit: isDeposit
      },
      balance: {
        value: statement.balance,
        formatted: statement.balance.toLocaleString('fa-IR')
      },
      description: statement.description,
      transactionCode: statement.transactionCode,
      transactionDescription: statement.transactionDescription,
      payer: isDeposit ? payerInfo : null,
      receiver: !isDeposit ? payerInfo : null,
      sourceAccount: sourceAccount,
      destinationAccount: destinationAccount,
      branch: {
        name: statement.branch?.name || null,
        code: statement.branch?.code || null
      },
      agentBranch: {
        name: statement.agentBranch?.name || null,
        code: statement.agentBranch?.code || null
      },
      referenceNumber: statement.referenceNumber,
      note: statement.note,
      serialNumber: statement.serialNumber,
      paymentId: statement.paymentId,
      depositNumber: depositNumber,
      iban: iban || payerInfo.shaba
    };
  });
  
  // فیلتر کردن فقط واریزی‌ها
  const deposits = transactions.filter(t => t.amount.isDeposit);
  
  // محاسبه مجموع واریزی‌ها
  const totalDeposits = deposits.reduce((sum, t) => sum + t.amount.value, 0);
  
  // محاسبه مجموع برداشت‌ها
  const withdrawals = transactions.filter(t => !t.amount.isDeposit);
  const totalWithdrawals = Math.abs(withdrawals.reduce((sum, t) => sum + t.amount.value, 0));
  
  return {
    success: true,
    depositNumber: depositNumber,
    iban: iban,
    summary: {
      totalTransactions: transactions.length,
      totalDeposits: deposits.length,
      totalWithdrawals: withdrawals.length,
      totalDepositAmount: totalDeposits,
      totalWithdrawalAmount: totalWithdrawals,
      netAmount: totalDeposits - totalWithdrawals,
      currency: billStatementData.currency || 'IRR'
    },
    transactions: transactions,
    deposits: deposits,
    withdrawals: withdrawals,
    hasMore: billStatementData.hasMoreItem || false
  };
}

/**
 * بررسی واریزی‌های جدید
 * @param {string} depositNumber - شماره سپرده
 * @param {string} iban - شماره شبا سپرده
 * @param {string} fromDate - تاریخ شروع (ISO format)
 * @param {string} toDate - تاریخ پایان (ISO format)
 * @param {string} username - نام کاربری (در صورت نیاز به لاگین)
 * @param {string} password - رمز عبور (در صورت نیاز به لاگین)
 * @returns {Promise<Object>} اطلاعات واریزی‌های پردازش شده
 */
async function checkDeposits(depositNumber, iban = null, fromDate = null, toDate = null, username = null, password = null) {
  try {
    // اطمینان از معتبر بودن session
    const sessionResult = await ensureValidSession(username, password);
    
    if (!sessionResult.success) {
      return {
        success: false,
        message: sessionResult.message || 'Failed to ensure valid session',
        error: sessionResult.error
      };
    }
    
    const { csrfToken, userInfo, isNewLogin } = sessionResult;
    
    if (isNewLogin) {
      console.log('✅ New login completed, using fresh session');
    }
    
    const currentUserType = userInfo?.currentUserType || 'OWNER';
    const currentUserId = userInfo?.id || '3671457';
    
    // اگر تاریخ داده نشده، از 30 روز گذشته تا الان
    if (!fromDate || !toDate) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      fromDate = fromDate || thirtyDaysAgo.toISOString();
      toDate = toDate || now.toISOString();
    }
    
    console.log('🔍 Checking deposits...');
    console.log(`   Deposit: ${depositNumber}`);
    if (iban) console.log(`   IBAN: ${iban}`);
    console.log(`   From: ${fromDate}`);
    console.log(`   To: ${toDate}`);
    
    // دریافت صورتحساب
    const billResult = await getDepositBillStatement(
      depositNumber,
      fromDate,
      toDate,
      'DESC',
      100, // تعداد بیشتر برای بررسی کامل
      0,
      csrfToken,
      currentUserType,
      currentUserId
    );
    
    if (!billResult.success) {
      // اگر خطا مربوط به session باشد (401 یا HTML یا session expired)، سعی می‌کنیم دوباره لاگین کنیم
      const isSessionError = billResult.statusCode === 401 || 
                            billResult.isSessionError || 
                            (billResult.message && (billResult.message.includes('HTML') || 
                                                     billResult.message.includes('session') || 
                                                     billResult.message.includes('401') ||
                                                     billResult.message.includes('Unauthorized')));
      
      if (isSessionError) {
        console.log('⚠️  Session error detected (401/expired), trying to re-login...');
        
        // پاک کردن session و cookies فعلی
        SESSION = null;
        if (fs.existsSync(SESSION_FILE)) {
          fs.unlinkSync(SESSION_FILE);
        }
        
        // پاک کردن cookies
        COOKIES = {};
        if (fs.existsSync(COOKIES_FILE)) {
          fs.unlinkSync(COOKIES_FILE);
        }
        
        // لاگین مجدد
        const retrySession = await ensureValidSession(username, password);
        if (retrySession.success) {
          console.log('✅ Re-login successful, retrying bill statement...');
          
          // تلاش مجدد برای دریافت صورتحساب
          const retryBillResult = await getDepositBillStatement(
            depositNumber,
            fromDate,
            toDate,
            'DESC',
            100,
            0,
            retrySession.csrfToken,
            retrySession.userInfo?.currentUserType || 'OWNER',
            retrySession.userInfo?.id || '3671457'
          );
          
          if (retryBillResult.success) {
            const processedData = processDepositTransactions(retryBillResult.data, depositNumber, iban);
            console.log('✅ Deposits checked successfully (after re-login)');
            return {
              success: true,
              ...processedData
            };
          } else {
            console.error('❌ Failed to get bill statement even after re-login:', retryBillResult.message);
          }
        } else {
          console.error('❌ Failed to re-login:', retrySession.message);
        }
      }
      
      return {
        success: false,
        message: billResult.message || 'Failed to get bill statement',
        statusCode: billResult.statusCode,
        data: billResult
      };
    }
    
    // پردازش تراکنش‌ها
    const processedData = processDepositTransactions(billResult.data, depositNumber, iban);
    
    console.log('✅ Deposits checked successfully');
    console.log(`   Total transactions: ${processedData.summary.totalTransactions}`);
    console.log(`   Deposits: ${processedData.summary.totalDeposits}`);
    console.log(`   Withdrawals: ${processedData.summary.totalWithdrawals}`);
    
    return {
      success: true,
      ...processedData
    };
    
  } catch (error) {
    console.error('❌ Error checking deposits:', error.message);
    return {
      success: false,
      message: error.message || 'Failed to check deposits'
    };
  }
}

module.exports = {
  login,
  getDepositBalance,
  getDepositBillStatement,
  checkDeposits,
  processDepositTransactions,
  timestampToJalali,
  extractIBAN,
  extractPayerInfo,
  ensureValidSession,
  isSessionValid,
  loadSession,
  saveSession,
  getCookieString,
  generateRequestId,
  loadCookies,
  saveCookies,
  COOKIES,
  SESSION
};

