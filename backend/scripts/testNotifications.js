require('dotenv').config();
const mysql = require('../database/mysql');
const telegramBot = require('../services/telegramBot');
const notificationService = require('../services/notificationService');

const testNotifications = async () => {
  try {
    // Initialize bot
    telegramBot.initBot();

    // Get user with ID 1
    const query = `SELECT id, telegramID, phoneNumber FROM users WHERE id = 1`;
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

    // Send Telegram notification if user has telegramID
    if (user.telegramID) {
      console.log(`\nSending Telegram notification to user ${user.id} (telegramID: ${user.telegramID})...`);
      try {
        const telegramResult = await telegramBot.sendWalletChargeNotification(user.telegramID, testAmount, userShabaNumber);
        console.log('Telegram notification result:', telegramResult);
      } catch (error) {
        console.error('Error sending Telegram notification:', error.message);
      }
    } else {
      console.log('\n⚠️  User does not have telegramID, skipping Telegram notification');
    }

    // Create in-app notification
    console.log(`\nCreating in-app notification for user ${user.id}...`);
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
      const notificationResult = await notificationService.createNotification(
        user.id,
        'wallet_charge',
        'شارژ موفق کیف پول (تستی)',
        `مبلغ ${testAmount.toLocaleString('fa-IR')} تومان با موفقیت به کیف پول شما افزوده شد. (این یک پیام تستی است)`,
        `${frontendUrl}/shop`
      );
      console.log('In-app notification created:', notificationResult);
    } catch (error) {
      console.error('Error creating in-app notification:', error.message);
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
  await testNotifications();
})();

