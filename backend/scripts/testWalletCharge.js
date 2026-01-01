require('dotenv').config();
const axios = require('axios');
const mysql = require('../database/mysql');
const redis = require('../database/redis');

const BASE_URL = process.env.BASE_URL || process.env.BACKEND_URL || 'http://localhost:4536';
const TEST_USER_ID = 1;
const CHARGE_AMOUNT = 23234;

const getOTPFromRedis = async (phoneNumber) => {
  try {
    const redisClient = await redis.connect();
    const otpKey = `otp:${phoneNumber}`;
    const otp = await redisClient.get(otpKey);
    return otp;
  } catch (error) {
    console.error('Error getting OTP from Redis:', error);
    return null;
  }
};

const getTestUserToken = async () => {
  try {
    await mysql.createPool();
    
    const userQuery = `SELECT id, phoneNumber FROM users WHERE id = ?`;
    const users = await mysql.query(userQuery, [TEST_USER_ID]);
    
    if (users.length === 0) {
      console.error(`❌ User with ID ${TEST_USER_ID} not found`);
      process.exit(1);
    }
    
    const user = users[0];
    console.log(`✅ Found user: ID=${user.id}, Phone=${user.phoneNumber || 'N/A'}`);
    
    if (!user.phoneNumber) {
      console.error(`❌ User ${TEST_USER_ID} doesn't have a phone number.`);
      console.log('💡 Please add a phone number to the user first.');
      process.exit(1);
    }
    
    console.log(`\n📤 Sending OTP to ${user.phoneNumber}...`);
    
    const otpResponse = await axios.post(`${BASE_URL}/api/sms/send-otp`, {
      mobile: user.phoneNumber
    });
    
    if (otpResponse.data.status !== 1) {
      console.error('❌ Failed to send OTP:', otpResponse.data.message);
      process.exit(1);
    }
    
    console.log('✅ OTP sent successfully');
    console.log('🔍 Getting OTP from Redis...');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const otp = await getOTPFromRedis(user.phoneNumber);
    
    if (!otp) {
      console.error('❌ OTP not found in Redis. Please check the OTP manually.');
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      return new Promise((resolve) => {
        readline.question('Enter OTP manually: ', async (manualOtp) => {
          readline.close();
          try {
            const loginResponse = await axios.post(`${BASE_URL}/api/users/otp-login`, {
              phoneNumber: user.phoneNumber,
              otp: manualOtp.trim()
            });
            
            if (loginResponse.data.status === 1 && loginResponse.data.data?.token) {
              console.log('✅ Login successful');
              resolve(loginResponse.data.data.token);
            } else {
              console.error('❌ Login failed:', loginResponse.data.message);
              process.exit(1);
            }
          } catch (error) {
            console.error('❌ Login error:', error.response?.data || error.message);
            process.exit(1);
          }
        });
      });
    }
    
    console.log(`✅ OTP found: ${otp}`);
    console.log('🔐 Logging in...');
    
    const loginResponse = await axios.post(`${BASE_URL}/api/users/otp-login`, {
      phoneNumber: user.phoneNumber,
      otp: otp
    });
    
    if (loginResponse.data.status === 1 && loginResponse.data.data?.token) {
      console.log('✅ Login successful');
      return loginResponse.data.data.token;
    } else {
      console.error('❌ Login failed:', loginResponse.data.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error getting token:', error.response?.data || error.message);
    process.exit(1);
  }
};

const chargeWallet = async (token) => {
  try {
    console.log(`\n💰 Charging wallet for user ${TEST_USER_ID}...`);
    console.log(`Amount: ${CHARGE_AMOUNT} Toman`);
    
    const response = await axios.post(
      `${BASE_URL}/api/wallet/charge`,
      {
        amount: CHARGE_AMOUNT
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.status === 1) {
      console.log('\n✅ Charge request created successfully!');
      console.log('\n📋 Payment Details:');
      console.log(`   Track ID: ${response.data.data.trackId}`);
      console.log(`   Order ID: ${response.data.data.orderId}`);
      console.log(`   Amount: ${response.data.data.amount} Toman`);
      console.log(`\n🔗 Payment URL: ${response.data.data.paymentUrl}`);
      console.log('\n💡 Open the payment URL in your browser to complete the payment.');
      console.log(`   Or copy this URL: ${response.data.data.paymentUrl}`);
    } else {
      console.error('❌ Failed to create charge request:', response.data.message);
      if (response.data.resultCode) {
        console.error(`   Result Code: ${response.data.resultCode}`);
      }
    }
  } catch (error) {
    console.error('❌ Error charging wallet:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('   Authentication failed. Please check your token.');
    }
  }
};

const main = async () => {
  console.log('🚀 Wallet Charge Test Script');
  console.log('='.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test User ID: ${TEST_USER_ID}`);
  console.log(`Charge Amount: ${CHARGE_AMOUNT} Toman`);
  console.log('='.repeat(50));
  
  try {
    const token = await getTestUserToken();
    await chargeWallet(token);
    
    console.log('\n✅ Test completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await mysql.closePool();
    await redis.closeConnection();
  }
};

if (require.main === module) {
  main();
}

module.exports = { chargeWallet, getTestUserToken };
