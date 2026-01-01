const { login, getDepositBalance, getDepositBillStatement, loadCookies, COOKIES } = require('./samanDirect');

async function test() {
  try {
    console.log('🧪 Testing Direct Saman Bank API...\n');

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

    // Test 1: Get Deposit Balance
    console.log('1️⃣  Testing Deposit Balance...');
    const balanceResult = await getDepositBalance(csrfToken, currentUserType, currentUserId);

    if (balanceResult.success) {
      console.log('✅ Deposit balance retrieved!');
      console.log('📊 Accounts:');
      if (balanceResult.data.DEPOSIT && Array.isArray(balanceResult.data.DEPOSIT)) {
        balanceResult.data.DEPOSIT.forEach((account, index) => {
          console.log(`\n   ${index + 1}. ${account.depositNumber}`);
          console.log(`      IBAN: ${account.ibanNumber}`);
          console.log(`      Balance: ${account.balance?.toLocaleString('fa-IR') || '0'} ${account.currency || 'IRR'}`);
          console.log(`      Kartablable: ${account.kartablable ? 'Yes' : 'No'}`);
        });
      }
    } else {
      console.log('❌ Failed:', balanceResult.message);
      if (balanceResult.data) {
        console.log('   Details:', JSON.stringify(balanceResult.data, null, 2));
      }
    }
    console.log('');

    // Test 2: Get Bill Statement
    console.log('2️⃣  Testing Bill Statement...');
    const depositNumber = '9451-810-5024276-1';
    const fromDate = '2025-04-20T20:30:00.000Z';
    const toDate = '2025-12-27T20:29:59.999Z';

    const billResult = await getDepositBillStatement(
      depositNumber,
      fromDate,
      toDate,
      'DESC',
      10,
      0,
      csrfToken,
      currentUserType,
      currentUserId
    );

    if (billResult.success) {
      console.log('✅ Bill statement retrieved!');
      console.log('📋 Statement Data:', JSON.stringify(billResult.data, null, 2));
      
      if (billResult.data.billStatements && billResult.data.billStatements.length > 0) {
        console.log(`\n   Total statements: ${billResult.data.billStatements.length}`);
        console.log(`   Currency: ${billResult.data.currency || 'N/A'}`);
        console.log(`   Has more: ${billResult.data.hasMoreItem || false}`);
      }
    } else {
      console.log('❌ Failed:', billResult.message);
      if (billResult.htmlResponse) {
        console.log('   HTML Response (first 200 chars):', billResult.htmlResponse.substring(0, 200));
      }
      if (billResult.data) {
        console.log('   Details:', JSON.stringify(billResult.data, null, 2));
      }
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();

