require('dotenv').config();
const mysql = require('../database/mysql');
const telegramBot = require('../services/telegramBot');

const testAdminReport = async () => {
  try {
    // Initialize bot
    telegramBot.initBot();

    // Get user with ID 1
    const query = `SELECT id, telegramID, phoneNumber, userName FROM users WHERE id = 1`;
    const users = await mysql.query(query);

    if (!users || users.length === 0) {
      console.error('User with ID 1 not found');
      process.exit(1);
    }

    const user = users[0];
    console.log('User found:', { id: user.id, telegramID: user.telegramID, phoneNumber: user.phoneNumber });

    const testAmount = 50000; // 50000 Toman

    // Get user's SHABA number from cards (first card with SHABA)
    let userShabaNumber = null;
    try {
      const shabaQuery = `SELECT shebaNumber FROM cards WHERE userId = ? AND shebaNumber IS NOT NULL AND shebaNumber != '' LIMIT 1`;
      const shabaResult = await mysql.query(shabaQuery, [user.id]);
      if (shabaResult && shabaResult.length > 0) {
        userShabaNumber = shabaResult[0].shebaNumber;
        console.log('User SHABA number found:', userShabaNumber);
      } else {
        console.log('No SHABA number found for user');
      }
    } catch (error) {
      console.error('Error fetching user SHABA:', error.message);
    }

    console.log('\n--- Testing Admin Report for CartToCard ---');
    try {
      const result1 = await telegramBot.sendAdminChargeReport(
        user.id,
        testAmount,
        'CartToCard',
        userShabaNumber,
        null
      );
      console.log('CartToCard result:', result1);
    } catch (error) {
      console.error('Error sending CartToCard report:', error.message);
    }

    console.log('\n--- Testing Admin Report for OnlineGateway ---');
    try {
      const result2 = await telegramBot.sendAdminChargeReport(
        user.id,
        testAmount,
        'OnlineGateway',
        userShabaNumber,
        null
      );
      console.log('OnlineGateway result:', result2);
    } catch (error) {
      console.error('Error sending OnlineGateway report:', error.message);
    }

    console.log('\n--- Testing Admin Report for Cryptocurrency ---');
    try {
      const result3 = await telegramBot.sendAdminChargeReport(
        user.id,
        testAmount,
        'Cryptocurrency',
        null,
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
      );
      console.log('Cryptocurrency result:', result3);
    } catch (error) {
      console.error('Error sending Cryptocurrency report:', error.message);
    }

    console.log('\n✅ Test completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error in test:', error);
    process.exit(1);
  }
};

// Run the test
(async () => {
  await mysql.createPool();
  await testAdminReport();
})();

