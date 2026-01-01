const { login, getDepositBalance, checkDeposits, loadCookies, COOKIES } = require('./samanDirect');

async function test() {
  try {
    console.log('🧪 Testing Deposit Check Service...\n');

    // Step 1: Login
    console.log('0️⃣  Logging in...');
    const username = process.env.SAMAN_USERNAME || 'onebit.ir';
    const password = process.env.SAMAN_PASSWORD || 'Alireza1380#';

    const loginResult = await login(username, password);

    if (!loginResult.success) {
      console.log('❌ Login failed:', loginResult.message);
      return;
    }

    console.log('✅ Login successful!');
    if (loginResult.userInfo) {
      console.log(`   User: ${loginResult.userInfo.name || 'N/A'}`);
      console.log(`   User ID: ${loginResult.userInfo.id || 'N/A'}`);
    }
    console.log('');

    // Get csrfToken from login result or cookies
    const csrfToken = loginResult.csrfToken || COOKIES.csrfToken;
    const currentUserType = loginResult.userInfo?.currentUserType || 'OWNER';
    const currentUserId = loginResult.userInfo?.id || '3671457';

    // Step 2: Get Deposit Balance to get account info
    console.log('1️⃣  Getting deposit accounts...');
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

    // Step 3: Check deposits for each account
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      console.log(`\n${i + 1}️⃣  Checking deposits for account: ${account.depositNumber}`);
      console.log(`   IBAN: ${account.ibanNumber}`);
      console.log(`   Balance: ${account.balance?.toLocaleString('fa-IR') || '0'} ${account.currency || 'IRR'}`);
      
      // تاریخ 30 روز گذشته تا الان
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromDate = thirtyDaysAgo.toISOString();
      const toDate = now.toISOString();
      
      const depositsResult = await checkDeposits(
        account.depositNumber,
        account.ibanNumber,
        fromDate,
        toDate,
        csrfToken,
        currentUserType,
        currentUserId
      );
      
      if (depositsResult.success) {
        console.log('\n📊 Summary:');
        console.log(`   Total Transactions: ${depositsResult.summary.totalTransactions}`);
        console.log(`   Deposits: ${depositsResult.summary.totalDeposits}`);
        console.log(`   Withdrawals: ${depositsResult.summary.totalWithdrawals}`);
        console.log(`   Total Deposit Amount: ${depositsResult.summary.totalDepositAmount.toLocaleString('fa-IR')} ${depositsResult.summary.currency}`);
        console.log(`   Total Withdrawal Amount: ${depositsResult.summary.totalWithdrawalAmount.toLocaleString('fa-IR')} ${depositsResult.summary.currency}`);
        console.log(`   Net Amount: ${depositsResult.summary.netAmount.toLocaleString('fa-IR')} ${depositsResult.summary.currency}`);
        
        // نمایش واریزی‌ها
        if (depositsResult.deposits.length > 0) {
          console.log('\n💰 Deposits:');
          depositsResult.deposits.forEach((deposit, idx) => {
            console.log(`\n   ${idx + 1}. Deposit #${deposit.serial}`);
            console.log(`      Date: ${deposit.date.jalaliWithMonthName} ${deposit.date.time}`);
            console.log(`      Amount: ${deposit.amount.formatted} ${deposit.amount.currency}`);
            console.log(`      Balance: ${deposit.balance.formatted} ${depositsResult.summary.currency}`);
            console.log(`      Description: ${deposit.description}`);
            if (deposit.payer) {
              if (deposit.payer.name) console.log(`      Payer Name: ${deposit.payer.name}`);
              if (deposit.payer.shaba) console.log(`      Payer IBAN: ${deposit.payer.shaba}`);
              if (deposit.payer.accountNumber) console.log(`      Payer Account: ${deposit.payer.accountNumber}`);
              if (deposit.payer.nationalId) console.log(`      Payer National ID: ${deposit.payer.nationalId}`);
            }
            if (deposit.sourceAccount) {
              console.log(`      Source Account: ${deposit.sourceAccount}`);
            }
            console.log(`      Transaction: ${deposit.transactionDescription}`);
            if (deposit.referenceNumber) {
              console.log(`      Reference: ${deposit.referenceNumber}`);
            }
          });
        }
        
        // نمایش برداشت‌ها
        if (depositsResult.withdrawals.length > 0) {
          console.log('\n💸 Withdrawals:');
          depositsResult.withdrawals.forEach((withdrawal, idx) => {
            console.log(`\n   ${idx + 1}. Withdrawal #${withdrawal.serial}`);
            console.log(`      Date: ${withdrawal.date.jalaliWithMonthName} ${withdrawal.date.time}`);
            console.log(`      Amount: ${withdrawal.amount.formatted} ${withdrawal.amount.currency}`);
            console.log(`      Balance: ${withdrawal.balance.formatted} ${depositsResult.summary.currency}`);
            console.log(`      Description: ${withdrawal.description}`);
            console.log(`      Transaction: ${withdrawal.transactionDescription}`);
          });
        }
        
        // نمایش JSON کامل برای استفاده
        console.log('\n📋 Full JSON Data:');
        console.log(JSON.stringify(depositsResult, null, 2));
      } else {
        console.log('❌ Failed to check deposits:', depositsResult.message);
      }
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();

