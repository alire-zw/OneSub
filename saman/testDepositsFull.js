const { login, getDepositBalance, checkDeposits, loadCookies, COOKIES } = require('./samanDirect');

async function test() {
  try {
    console.log('🧪 Testing Full Deposit Check with All Transactions...\n');

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

    // نمایش اطلاعات حساب‌ها
    console.log('\n📊 Accounts:');
    accounts.forEach((account, idx) => {
      console.log(`\n   ${idx + 1}. ${account.depositNumber}`);
      console.log(`      IBAN: ${account.ibanNumber}`);
      console.log(`      Balance: ${account.balance?.toLocaleString('fa-IR') || '0'} ${account.currency || 'IRR'}`);
      console.log(`      Kartablable: ${account.kartablable ? 'Yes' : 'No'}`);
    });

    // Step 3: Check deposits for account 9451-810-5024276-1 with full date range
    console.log('\n2️⃣  Checking deposits for account: 9451-810-5024276-1');
    const account = accounts.find(acc => acc.depositNumber === '9451-810-5024276-1');
    
    if (!account) {
      console.log('❌ Account not found');
      return;
    }
    
    // استفاده از تاریخ‌های گسترده برای گرفتن تمام تراکنش‌ها
    const fromDate = '2025-04-20T20:30:00.000Z';
    const toDate = '2025-12-27T20:29:59.999Z';
    
    console.log(`   IBAN: ${account.ibanNumber}`);
    console.log(`   From: ${fromDate}`);
    console.log(`   To: ${toDate}`);
    
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
      
      // نمایش تمام تراکنش‌ها
      if (depositsResult.transactions.length > 0) {
        console.log('\n📋 All Transactions:');
        depositsResult.transactions.forEach((transaction, idx) => {
          console.log(`\n   ${idx + 1}. Transaction #${transaction.serial}`);
          console.log(`      Date: ${transaction.date.jalaliWithMonthName} ${transaction.date.time}`);
          console.log(`      Type: ${transaction.amount.isDeposit ? '💰 Deposit' : '💸 Withdrawal'}`);
          console.log(`      Amount: ${transaction.amount.formatted} ${transaction.amount.currency}`);
          console.log(`      Balance: ${transaction.balance.formatted} ${depositsResult.summary.currency}`);
          console.log(`      Description: ${transaction.description}`);
          console.log(`      Transaction: ${transaction.transactionDescription}`);
          
          if (transaction.amount.isDeposit && transaction.payer) {
            console.log(`      Payer Info:`);
            if (transaction.payer.name) console.log(`         Name: ${transaction.payer.name}`);
            if (transaction.payer.shaba) console.log(`         IBAN: ${transaction.payer.shaba}`);
            if (transaction.payer.accountNumber) console.log(`         Account: ${transaction.payer.accountNumber}`);
            if (transaction.payer.nationalId) console.log(`         National ID: ${transaction.payer.nationalId}`);
          }
          
          if (transaction.sourceAccount) {
            console.log(`      Source Account: ${transaction.sourceAccount}`);
          }
          if (transaction.destinationAccount) {
            console.log(`      Destination Account: ${transaction.destinationAccount}`);
          }
          if (transaction.referenceNumber) {
            console.log(`      Reference: ${transaction.referenceNumber}`);
          }
        });
      }
      
      // نمایش JSON کامل
      console.log('\n📋 Full JSON Data:');
      console.log(JSON.stringify(depositsResult, null, 2));
    } else {
      console.log('❌ Failed to check deposits:', depositsResult.message);
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();

