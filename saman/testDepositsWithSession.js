const { checkDeposits, getDepositBalance, ensureValidSession, isSessionValid, loadSession, SESSION } = require('./samanDirect');

async function test() {
  try {
    console.log('🧪 Testing Deposit Check with Session Management...\n');

    // بررسی session موجود
    console.log('0️⃣  Checking existing session...');
    const existingSession = loadSession();
    
    if (existingSession) {
      console.log('📋 Found existing session:');
      console.log(`   User: ${existingSession.userInfo?.name || 'N/A'}`);
      console.log(`   User ID: ${existingSession.userInfo?.id || 'N/A'}`);
      if (existingSession.authExpiration?.sessionExpirationDate) {
        const expirationDate = new Date(existingSession.authExpiration.sessionExpirationDate);
        console.log(`   Expires at: ${expirationDate.toLocaleString('fa-IR')}`);
        const now = new Date();
        const timeLeft = expirationDate - now;
        const minutesLeft = Math.floor(timeLeft / 60000);
        console.log(`   Time left: ${minutesLeft} minutes`);
      }
      
      const isValid = isSessionValid();
      console.log(`   Valid: ${isValid ? '✅ Yes' : '❌ No'}`);
    } else {
      console.log('⚠️  No existing session found');
    }
    console.log('');

    // Step 1: اطمینان از معتبر بودن session
    console.log('1️⃣  Ensuring valid session...');
    const username = process.env.SAMAN_USERNAME || 'onebit.ir';
    const password = process.env.SAMAN_PASSWORD || 'Alireza1380#';

    const sessionResult = await ensureValidSession(username, password);

    if (!sessionResult.success) {
      console.log('❌ Failed to ensure valid session:', sessionResult.message);
      return;
    }

    if (sessionResult.isNewLogin) {
      console.log('✅ New login completed');
    } else {
      console.log('✅ Using existing valid session');
    }
    
    if (sessionResult.userInfo) {
      console.log(`   User: ${sessionResult.userInfo.name || 'N/A'}`);
      console.log(`   User ID: ${sessionResult.userInfo.id || 'N/A'}`);
    }
    console.log('');

    // Step 2: Get Deposit Balance to get account info
    console.log('2️⃣  Getting deposit accounts...');
    const { csrfToken, userInfo } = sessionResult;
    const currentUserType = userInfo?.currentUserType || 'OWNER';
    const currentUserId = userInfo?.id || '3671457';

    const balanceResult = await getDepositBalance(csrfToken, currentUserType, currentUserId);

    if (!balanceResult.success) {
      console.log('❌ Failed to get deposit balance:', balanceResult.message);
      return;
    }

    console.log('✅ Deposit accounts retrieved!');
    const accounts = balanceResult.data.DEPOSIT || [];
    
    if (accounts.length === 0) {
      console.log('❌ No accounts found');
      return;
    }

    // نمایش اطلاعات حساب‌ها
    console.log('\n📊 Accounts:');
    accounts.forEach((account, idx) => {
      console.log(`\n   ${idx + 1}. ${account.depositNumber}`);
      console.log(`      IBAN: ${account.ibanNumber}`);
      console.log(`      Balance: ${account.balance?.toLocaleString('fa-IR') || '0'} ${account.currency || 'IRR'}`);
      console.log(`      Kartablable: ${account.kartablable ? 'Yes' : 'No'}`);
    });

    // Step 3: Check deposits - این تابع خودش session را مدیریت می‌کند
    console.log('\n3️⃣  Checking deposits (with automatic session management)...');
    const account = accounts.find(acc => acc.depositNumber === '9451-810-5024276-1');
    
    if (!account) {
      console.log('❌ Account not found');
      return;
    }
    
    // استفاده از تاریخ‌های گسترده برای گرفتن تمام تراکنش‌ها
    const fromDate = '2025-04-20T20:30:00.000Z';
    const toDate = '2025-12-27T20:29:59.999Z';
    
    console.log(`   Account: ${account.depositNumber}`);
    console.log(`   IBAN: ${account.ibanNumber}`);
    console.log(`   From: ${fromDate}`);
    console.log(`   To: ${toDate}`);
    console.log('   Note: Session will be automatically managed (no manual login needed)');
    
    // اولین فراخوانی - از session موجود استفاده می‌کند
    console.log('\n   📞 First call (should use existing session)...');
    const depositsResult1 = await checkDeposits(
      account.depositNumber,
      account.ibanNumber,
      fromDate,
      toDate,
      username,
      password
    );
    
    if (depositsResult1.success) {
      console.log('   ✅ First call successful!');
      console.log(`   Total transactions: ${depositsResult1.summary.totalTransactions}`);
    } else {
      console.log('   ❌ First call failed:', depositsResult1.message);
    }
    
    // دومین فراخوانی - باید از همان session استفاده کند
    console.log('\n   📞 Second call (should reuse same session)...');
    const depositsResult2 = await checkDeposits(
      account.depositNumber,
      account.ibanNumber,
      fromDate,
      toDate,
      username,
      password
    );
    
    if (depositsResult2.success) {
      console.log('   ✅ Second call successful!');
      console.log(`   Total transactions: ${depositsResult2.summary.totalTransactions}`);
      
      // نمایش خلاصه
      console.log('\n📊 Summary:');
      console.log(`   Total Transactions: ${depositsResult2.summary.totalTransactions}`);
      console.log(`   Deposits: ${depositsResult2.summary.totalDeposits}`);
      console.log(`   Withdrawals: ${depositsResult2.summary.totalWithdrawals}`);
      console.log(`   Total Deposit Amount: ${depositsResult2.summary.totalDepositAmount.toLocaleString('fa-IR')} ${depositsResult2.summary.currency}`);
      console.log(`   Total Withdrawal Amount: ${depositsResult2.summary.totalWithdrawalAmount.toLocaleString('fa-IR')} ${depositsResult2.summary.currency}`);
      console.log(`   Net Amount: ${depositsResult2.summary.netAmount.toLocaleString('fa-IR')} ${depositsResult2.summary.currency}`);
      
      // نمایش واریزی‌ها با اطلاعات کامل
      if (depositsResult2.deposits.length > 0) {
        console.log('\n💰 Deposits with Payer Info:');
        depositsResult2.deposits.forEach((deposit, idx) => {
          if (deposit.payer && (deposit.payer.name || deposit.payer.shaba)) {
            console.log(`\n   ${idx + 1}. Deposit #${deposit.serial}`);
            console.log(`      Date: ${deposit.date.jalaliWithMonthName} ${deposit.date.time}`);
            console.log(`      Amount: ${deposit.amount.formatted} ${deposit.amount.currency}`);
            if (deposit.payer.name) console.log(`      Payer: ${deposit.payer.name}`);
            if (deposit.payer.shaba) console.log(`      IBAN: ${deposit.payer.shaba}`);
            if (deposit.payer.accountNumber) console.log(`      Account: ${deposit.payer.accountNumber}`);
          }
        });
      }
    } else {
      console.log('   ❌ Second call failed:', depositsResult2.message);
    }

    console.log('\n✅ Test completed!');
    console.log('\n💡 Note: Session is saved and will be reused in future calls until it expires.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();

