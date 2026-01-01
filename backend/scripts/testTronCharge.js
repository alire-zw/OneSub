require('dotenv').config();
const axios = require('axios');
const readline = require('readline');
const mysql = require('../database/mysql');
const { signToken } = require('../utils/jwt');

const API_BASE_URL = process.env.BASE_URL || 'http://localhost:4536';
const AMOUNT_TO_CHARGE = 150000; // Toman

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function runTest() {
  try {
    await mysql.createPool();

    console.log('--- Starting TRON Wallet Charge Test Script ---');
    console.log(`Network: ${process.env.TRON_NETWORK || 'shasta'}`);
    console.log(`Amount: ${AMOUNT_TO_CHARGE} Toman\n`);

    const userIdToTest = 1;

    // 1. Find user by ID
    console.log(`1. Fetching user ${userIdToTest} from database...`);
    const users = await mysql.query('SELECT id FROM users WHERE id = ?', [userIdToTest]);
    if (!users || users.length === 0) {
      console.error(`User with ID ${userIdToTest} not found.`);
      return;
    }
    const user = users[0];
    console.log(`User found: ID=${user.id}\n`);

    // 2. Generate JWT token directly (no phone number/OTP needed for TRON testing)
    console.log(`2. Generating JWT token for user ${userIdToTest}...`);
    const token = signToken({ userId: user.id });
    console.log('JWT Token generated.\n');

    // 3. Request TRON wallet charge
    console.log(`3. Requesting TRON wallet charge for user ${userIdToTest}, amount ${AMOUNT_TO_CHARGE} Toman...`);
    console.log(`   API URL: ${API_BASE_URL}/api/crypto/tron/charge`);
    console.log(`   Token: ${token.substring(0, 20)}...`);
    
    try {
      const chargeResponse = await axios.post(`${API_BASE_URL}/api/crypto/tron/charge`, {
        amount: AMOUNT_TO_CHARGE
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('   ✅ Charge Request Response:', JSON.stringify(chargeResponse.data, null, 2));

      if (chargeResponse.data.status === 1) {
        const data = chargeResponse.data.data;
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8903';
        const paymentUrl = `${FRONTEND_URL}/payment/tron?trackId=${data.trackId}`;
        
        console.log(`\n--- TRON Payment Request Successful ---`);
        console.log(`Wallet Address: ${data.walletAddress}`);
        console.log(`Amount (Toman): ${data.amountToman}`);
        console.log(`Amount (TRX): ${data.amountTrx}`);
        console.log(`TRX Price: ${data.trxPrice} Toman`);
        console.log(`Expires At: ${data.expiresAt}`);
        console.log(`Track ID: ${data.trackId}`);
        console.log(`Order ID: ${data.orderId}`);
        console.log(`\n📱 Payment Page URL:`);
        console.log(`   ${paymentUrl}`);
        console.log(`\nPlease send ${data.amountTrx} TRX to the wallet address above.`);
        console.log(`You have 15 minutes to complete the payment.`);
        console.log(`\nTo check payment status, use:`);
        console.log(`GET ${API_BASE_URL}/api/crypto/tron/status/${data.trackId}`);
        
        // Ask if user wants to monitor payment
        const monitor = await question('\nDo you want to monitor the payment status? (y/n): ');
        if (monitor.toLowerCase() === 'y') {
          console.log('\nMonitoring payment status (checking every 10 seconds)...');
          console.log('Press Ctrl+C to stop monitoring.\n');
          
          const statusInterval = setInterval(async () => {
            try {
              const statusResponse = await axios.get(`${API_BASE_URL}/api/crypto/tron/status/${data.trackId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              const statusData = statusResponse.data.data;
              const now = new Date();
              const expiresAt = new Date(statusData.expiresAt);
              const timeLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
              
              console.log(`[${now.toLocaleTimeString()}] Status: ${statusData.status} | Crypto Status: ${statusData.cryptoStatus} | Time Left: ${timeLeft}s`);
              
              if (statusData.status === 'completed') {
                console.log('\n✅ Payment completed successfully!');
                clearInterval(statusInterval);
                rl.close();
              } else if (statusData.cryptoStatus === 'expired') {
                console.log('\n❌ Payment expired!');
                clearInterval(statusInterval);
                rl.close();
              }
            } catch (error) {
              console.error('Error checking status:', error.response?.data || error.message);
            }
          }, 10000);
        }
      } else {
        console.error('❌ Failed to create TRON charge request:', chargeResponse.data.message);
        console.error('   Response:', JSON.stringify(chargeResponse.data, null, 2));
      }
    } catch (axiosError) {
      console.error('❌ Axios Error Details:');
      console.error('   Message:', axiosError.message);
      if (axiosError.response) {
        console.error('   Status:', axiosError.response.status);
        console.error('   Status Text:', axiosError.response.statusText);
        console.error('   Response Data:', JSON.stringify(axiosError.response.data, null, 2));
        console.error('   Response Headers:', JSON.stringify(axiosError.response.headers, null, 2));
      } else if (axiosError.request) {
        console.error('   Request made but no response received');
        console.error('   Request:', axiosError.request);
      }
      throw axiosError;
    }

  } catch (error) {
    console.error('\n❌ An error occurred during the test:');
    console.error('   Error Type:', error.constructor.name);
    console.error('   Error Message:', error.message);
    console.error('   Error Stack:', error.stack);
    
    if (error.response) {
      console.error('\n   HTTP Response Details:');
      console.error('   Status:', error.response.status);
      console.error('   Status Text:', error.response.statusText);
      console.error('   Response Data:', JSON.stringify(error.response.data, null, 2));
      console.error('   Response Headers:', JSON.stringify(error.response.headers, null, 2));
    } else if (error.request) {
      console.error('\n   Request Details:');
      console.error('   Request made but no response received');
      console.error('   Request:', error.request);
    } else {
      console.error('\n   Error Config:', JSON.stringify(error.config, null, 2));
    }
  } finally {
    // Don't close rl here if monitoring is active
    if (!rl.closed) {
      rl.close();
    }
    await mysql.closePool();
    console.log('\n--- Test Script Finished ---');
  }
}

runTest();

