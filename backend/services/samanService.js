const path = require('path');
const mysql = require('../database/mysql');
const { refreshUserCache } = require('../utils/userCache');

// Import samanDirect from the saman directory
const samanDirectPath = path.join(__dirname, '../../saman/samanDirect');
const { checkDeposits } = require(samanDirectPath);

let monitoringInterval = null;
let isRunning = false;

// تنظیمات حساب
const DEPOSIT_NUMBER = '9451-810-5024276-1';
const IBAN = 'IR850560945181005024276001';
const INTERVAL_MINUTES = 10; // هر 10 دقیقه

/**
 * پیدا کردن کاربر بر اساس شماره شبا
 * @param {string} iban - شماره شبا (ممکن است با IR شروع شود)
 * @returns {Promise<Object|null>} اطلاعات کاربر یا null
 */
const findUserByIBAN = async (iban) => {
  try {
    if (!iban) {
      return null;
    }
    
    // حذف "IR" از ابتدای شبا اگر وجود داشته باشد
    let cleanIban = iban.trim().toUpperCase();
    if (cleanIban.startsWith('IR')) {
      cleanIban = cleanIban.substring(2);
    }
    
    // حذف فاصله‌ها و کاراکترهای غیر عددی
    cleanIban = cleanIban.replace(/\s+/g, '').replace(/[^\d]/g, '');
    
    if (!cleanIban || cleanIban.length < 10) {
      console.log(`[Saman Service] Invalid IBAN format: ${iban}`);
      return null;
    }
    
    // جستجو در جدول cards بر اساس shebaNumber (بدون IR)
    // در دیتابیس شباها بدون IR ذخیره می‌شوند
    const query = `
      SELECT c.userId, c.id as cardId, c.cardName, c.shebaNumber, c.bankName, u.id, u.userName, u.phoneNumber
      FROM cards c
      INNER JOIN users u ON c.userId = u.id
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.shebaNumber, 'IR', ''), ' ', ''), '-', ''), '_', '') = ?
      LIMIT 1
    `;
    
    const results = await mysql.query(query, [cleanIban]);
    
    if (results && results.length > 0) {
      console.log(`[Saman Service] ✅ User found for IBAN: ${iban} -> ${cleanIban}`);
      return results[0];
    }
    
    console.log(`[Saman Service] ⚠️  No user found for IBAN: ${iban} (searched as: ${cleanIban})`);
    return null;
  } catch (error) {
    console.error('[Saman Service] Error finding user by IBAN:', error);
    return null;
  }
};

/**
 * بررسی اینکه آیا این تراکنش قبلاً پردازش شده است
 * @param {string} samanSerial - شماره سریال تراکنش سامان
 * @returns {Promise<boolean>} true اگر قبلاً پردازش شده باشد
 */
const isTransactionProcessed = async (samanSerial) => {
  try {
    if (!samanSerial) {
      return false;
    }
    
    const query = `
      SELECT id FROM transactions 
      WHERE samanSerial = ? AND status = 'completed'
      LIMIT 1
    `;
    
    const results = await mysql.query(query, [samanSerial]);
    
    return results && results.length > 0;
  } catch (error) {
    console.error('[Saman Service] Error checking if transaction processed:', error);
    return false;
  }
};

/**
 * پردازش واریزی و شارژ کیف پول کاربر
 * @param {Object} deposit - اطلاعات واریزی
 * @param {Object} user - اطلاعات کاربر
 * @returns {Promise<Object>} نتیجه پردازش
 */
const processDeposit = async (deposit, user) => {
  try {
    // بررسی duplicate
    const alreadyProcessed = await isTransactionProcessed(deposit.serial);
    if (alreadyProcessed) {
      console.log(`[Saman Service] ⚠️  Deposit ${deposit.serial} already processed, skipping...`);
      return {
        success: false,
        message: 'Transaction already processed',
        duplicate: true
      };
    }
    
    // تبدیل مبلغ از ریال به تومان (مبلغ در ریال است)
    const amountInRial = deposit.amount.value;
    const amountInToman = Math.floor(amountInRial / 10);
    
    // ایجاد trackId یکتا برای تراکنش (باید BIGINT باشد)
    // استفاده از timestamp + 6 رقم آخر serial برای یکتا بودن
    const serialSuffix = deposit.serial.slice(-6).padStart(6, '0');
    const trackId = parseInt(`${Date.now()}${serialSuffix}`);
    const orderId = `SAMAN-${user.userId}-${deposit.serial}-${Date.now()}`;
    
    // ایجاد تراکنش در دیتابیس
    const insertTransactionQuery = `
      INSERT INTO transactions (
        userId, trackId, orderId, amount, status, paymentType, 
        refNumber, description, paidAt, samanSerial
      )
      VALUES (?, ?, ?, ?, 'completed', 'saman', ?, ?, ?, ?)
    `;
    
    const description = `واریز از بانک سامان - ${deposit.payer?.name || 'نامشخص'} - شبا: ${deposit.payer?.shaba || 'نامشخص'}`;
    const paidAt = new Date(deposit.date.timestamp);
    
    await mysql.query(insertTransactionQuery, [
      user.userId,
      trackId,
      orderId,
      amountInRial, // مبلغ به ریال در دیتابیس ذخیره می‌شود
      deposit.serial, // refNumber
      description,
      paidAt,
      deposit.serial // samanSerial برای جلوگیری از duplicate
    ]);
    
    // شارژ کیف پول کاربر
    const updateWalletQuery = `
      UPDATE users 
      SET walletBalance = walletBalance + ? 
      WHERE id = ?
    `;
    
    await mysql.query(updateWalletQuery, [amountInRial, user.userId]);
    
    // به‌روزرسانی cache کاربر
    await refreshUserCache(user.userId);
    
    console.log(`[Saman Service] ✅ Deposit processed successfully:`);
    console.log(`[Saman Service]    User: ${user.userName || user.phoneNumber || user.userId}`);
    console.log(`[Saman Service]    Amount: ${amountInToman.toLocaleString('fa-IR')} Toman (${amountInRial.toLocaleString('fa-IR')} Rial)`);
    console.log(`[Saman Service]    Serial: ${deposit.serial}`);
    console.log(`[Saman Service]    Date: ${deposit.date.jalaliWithMonthName} ${deposit.date.time}`);
    
    return {
      success: true,
      transactionId: trackId,
      amount: amountInRial,
      amountToman: amountInToman,
      userId: user.userId
    };
    
  } catch (error) {
    console.error('[Saman Service] ❌ Error processing deposit:', error);
    return {
      success: false,
      message: error.message || 'Failed to process deposit',
      error: error
    };
  }
};

/**
 * دریافت صورتحساب از حساب سامان
 */
const fetchBillStatement = async () => {
  if (isRunning) {
    console.log('[Saman Service] Previous fetch still running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = new Date();

  try {
    console.log(`[Saman Service] Fetching bill statement at ${startTime.toLocaleString('fa-IR')}...`);

    // دریافت username و password از environment variables
    const username = process.env.SAMAN_USERNAME;
    const password = process.env.SAMAN_PASSWORD;

    if (!username || !password) {
      console.error('[Saman Service] SAMAN_USERNAME or SAMAN_PASSWORD not set in environment variables');
      return;
    }

    // محاسبه تاریخ‌ها: از 24 ساعت گذشته تا الان
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fromDate = twentyFourHoursAgo.toISOString();
    const toDate = now.toISOString();

    // دریافت صورتحساب (session management خودکار است)
    const result = await checkDeposits(
      DEPOSIT_NUMBER,
      IBAN,
      fromDate,
      toDate,
      username,
      password
    );

    if (result.success) {
      const endTime = new Date();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`[Saman Service] ✅ Bill statement fetched successfully in ${duration}s`);
      console.log(`[Saman Service]    Total transactions: ${result.summary.totalTransactions}`);
      console.log(`[Saman Service]    Deposits: ${result.summary.totalDeposits}`);
      console.log(`[Saman Service]    Withdrawals: ${result.summary.totalWithdrawals}`);
      console.log(`[Saman Service]    Total Deposit Amount: ${result.summary.totalDepositAmount.toLocaleString('fa-IR')} ${result.summary.currency}`);
      console.log(`[Saman Service]    Total Withdrawal Amount: ${result.summary.totalWithdrawalAmount.toLocaleString('fa-IR')} ${result.summary.currency}`);
      console.log(`[Saman Service]    Net Amount: ${result.summary.netAmount.toLocaleString('fa-IR')} ${result.summary.currency}`);

      // پردازش واریزی‌ها
      if (result.deposits && result.deposits.length > 0) {
        console.log(`[Saman Service]    Processing ${result.deposits.length} deposit(s)...`);
        
        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        for (const deposit of result.deposits) {
          // بررسی اینکه آیا شبا فرستنده وجود دارد
          if (!deposit.payer || !deposit.payer.shaba) {
            console.log(`[Saman Service] ⚠️  Deposit ${deposit.serial} has no payer IBAN, skipping...`);
            skippedCount++;
            continue;
          }
          
          // پیدا کردن کاربر بر اساس شبا
          const user = await findUserByIBAN(deposit.payer.shaba);
          
          if (!user) {
            console.log(`[Saman Service] ⚠️  No user found for IBAN: ${deposit.payer.shaba}, skipping deposit ${deposit.serial}`);
            skippedCount++;
            continue;
          }
          
          // پردازش واریزی
          const processResult = await processDeposit(deposit, user);
          
          if (processResult.success) {
            processedCount++;
          } else if (processResult.duplicate) {
            skippedCount++;
          } else {
            errorCount++;
            console.error(`[Saman Service] ❌ Failed to process deposit ${deposit.serial}:`, processResult.message);
          }
        }
        
        console.log(`[Saman Service]    Processing summary:`);
        console.log(`[Saman Service]      Processed: ${processedCount}`);
        console.log(`[Saman Service]      Skipped: ${skippedCount}`);
        console.log(`[Saman Service]      Errors: ${errorCount}`);
      } else {
        console.log(`[Saman Service]    No deposits found in the last 24 hours`);
      }

    } else {
      console.error(`[Saman Service] ❌ Failed to fetch bill statement: ${result.message}`);
      if (result.error) {
        console.error(`[Saman Service]    Error details:`, result.error);
      }
    }

  } catch (error) {
    console.error('[Saman Service] ❌ Error in fetchBillStatement:', error.message);
    console.error('[Saman Service]    Stack:', error.stack);
  } finally {
    isRunning = false;
  }
};

/**
 * شروع سرویس دریافت صورتحساب
 */
const startMonitoring = () => {
  if (monitoringInterval) {
    console.log('[Saman Service] Monitoring already started');
    return;
  }

  console.log(`[Saman Service] Starting bill statement monitoring...`);
  console.log(`[Saman Service]    Deposit: ${DEPOSIT_NUMBER}`);
  console.log(`[Saman Service]    IBAN: ${IBAN}`);
  console.log(`[Saman Service]    Interval: Every ${INTERVAL_MINUTES} minutes`);

  // بررسی اولیه environment variables
  const username = process.env.SAMAN_USERNAME;
  const password = process.env.SAMAN_PASSWORD;

  if (!username || !password) {
    console.error('[Saman Service] ⚠️  SAMAN_USERNAME or SAMAN_PASSWORD not set in environment variables');
    console.error('[Saman Service]    Monitoring will not work without credentials');
    return;
  }

  // دریافت فوری در شروع
  fetchBillStatement();

  // سپس هر 10 دقیقه یکبار
  const intervalMs = INTERVAL_MINUTES * 60 * 1000;
  monitoringInterval = setInterval(fetchBillStatement, intervalMs);

  console.log(`[Saman Service] ✅ Monitoring started (checking every ${INTERVAL_MINUTES} minutes)`);
};

/**
 * توقف سرویس دریافت صورتحساب
 */
const stopMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[Saman Service] Stopped monitoring');
  }
};

/**
 * دریافت دستی صورتحساب (برای تست)
 */
const fetchManually = async () => {
  console.log('[Saman Service] Manual fetch requested...');
  await fetchBillStatement();
};

module.exports = {
  startMonitoring,
  stopMonitoring,
  fetchBillStatement,
  fetchManually
};

