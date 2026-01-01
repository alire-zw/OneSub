const { checkDeposits, ensureValidSession, isSessionValid, loadSession, SESSION } = require('./samanDirect');

async function test() {
  try {
    console.log('🧪 Testing Session Reuse (No Login Needed)...\n');

    // بررسی session موجود
    const existingSession = loadSession();
    
    if (existingSession) {
      const isValid = isSessionValid();
      console.log(`📋 Session Status: ${isValid ? '✅ Valid' : '❌ Invalid/Expired'}`);
      if (isValid) {
        console.log(`   User: ${existingSession.userInfo?.name || 'N/A'}`);
        console.log(`   Will reuse this session (no login needed)\n`);
      } else {
        console.log(`   Will login automatically\n`);
      }
    } else {
      console.log('⚠️  No session found, will login automatically\n');
    }

    // فراخوانی checkDeposits - خودش session را مدیریت می‌کند
    console.log('📞 Calling checkDeposits (session managed automatically)...\n');
    
    const username = process.env.SAMAN_USERNAME || 'onebit.ir';
    const password = process.env.SAMAN_PASSWORD || 'Alireza1380#';
    
    const fromDate = '2025-11-26T00:00:00.000Z';
    const toDate = '2025-12-27T23:59:59.999Z';
    
    const result = await checkDeposits(
      '9451-810-5024276-1',
      'IR850560945181005024276001',
      fromDate,
      toDate,
      username,
      password
    );
    
    if (result.success) {
      console.log('✅ Success!');
      console.log(`   Total transactions: ${result.summary.totalTransactions}`);
      console.log(`   Deposits: ${result.summary.totalDeposits}`);
      console.log(`   Withdrawals: ${result.summary.totalWithdrawals}`);
      console.log(`   Total Deposit Amount: ${result.summary.totalDepositAmount.toLocaleString('fa-IR')} ${result.summary.currency}`);
      
      // نمایش واریزی‌های اخیر
      if (result.deposits.length > 0) {
        console.log('\n💰 Recent Deposits:');
        result.deposits.slice(0, 3).forEach((deposit, idx) => {
          console.log(`\n   ${idx + 1}. ${deposit.date.jalaliWithMonthName} ${deposit.date.time}`);
          console.log(`      Amount: ${deposit.amount.formatted} ${deposit.amount.currency}`);
          if (deposit.payer?.name) {
            console.log(`      From: ${deposit.payer.name}`);
            if (deposit.payer.shaba) {
              console.log(`      IBAN: ${deposit.payer.shaba}`);
            }
          }
        });
      }
    } else {
      console.log('❌ Failed:', result.message);
    }

    console.log('\n✅ Test completed!');
    console.log('💡 Next time you run this, it will use the saved session (no login needed)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();

