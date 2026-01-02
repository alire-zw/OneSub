const TelegramBot = require('node-telegram-bot-api');
const jalaali = require('jalaali-js');

let bot = null;

// Initialize Telegram Bot
const initBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.warn('[Telegram Bot] Bot token not configured. Telegram notifications will be disabled.');
    return null;
  }

  try {
    bot = new TelegramBot(token, { polling: false });
    console.log('[Telegram Bot] Bot initialized successfully');
    return bot;
  } catch (error) {
    console.error('[Telegram Bot] Error initializing bot:', error);
    return null;
  }
};

// Send message with web app button
const sendWalletChargeNotification = async (telegramId, amount, shabaNumber = null) => {
  if (!bot) {
    bot = initBot();
    if (!bot) {
      console.warn('[Telegram Bot] Bot not initialized, skipping notification');
      return { success: false, message: 'Bot not initialized' };
    }
  }

  try {
    // Format amount in Latin numbers
    const amountFormatted = amount.toLocaleString('en-US');
    
    // Format SHABA number if provided
    let shabaText = '';
    if (shabaNumber) {
      // Ensure SHABA has IR prefix
      const cleanShaba = shabaNumber.replace(/^IR/i, ''); // Remove IR prefix if exists
      const formattedShaba = `IR${cleanShaba}`;
      shabaText = ` از شماره شبا <code>${formattedShaba}</code>`;
    }

    const message = `❗️ <b>کاربر گرامی وان‌ساب</b>،
💵 مبلغ <code>${amountFormatted}</code> تومان${shabaText} <b>با موفقیت</b> به کیف پول شما افزوده شد.

🛒 <b>همین حالا</b> میتوانید از طریق دکمه زیر به خرید خود ادامه دهید.`;

    const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
    const miniAppUrl = `${frontendUrl}/shop`;

    // Create inline keyboard with web app button
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '🛒 رفتن به فروشگاه',
            web_app: { url: miniAppUrl }
          }
        ]
      ]
    };

    const result = await bot.sendMessage(telegramId, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });

    console.log(`[Telegram Bot] Wallet charge notification sent to user ${telegramId}`);
    return {
      success: true,
      messageId: result.message_id
    };
  } catch (error) {
    console.error(`[Telegram Bot] Error sending notification to ${telegramId}:`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
};

// Send order confirmation notification
const sendOrderConfirmationNotification = async (telegramId, orderNumber, productName, amount) => {
  if (!bot) {
    bot = initBot();
    if (!bot) {
      console.warn('[Telegram Bot] Bot not initialized, skipping order notification');
      return { success: false, message: 'Bot not initialized' };
    }
  }

  try {
    // Format amount in Latin numbers
    const amountFormatted = amount.toLocaleString('en-US');

    const message = `✅ <b>کاربر گرامی وان‌ساب</b>،
📦 سفارش شما با شماره <code>${orderNumber}</code> <b>با موفقیت</b> ثبت شد.

🛍️ <b>محصول</b> : ${productName}
💵 <b>مبلغ</b> : <code>${amountFormatted}</code> تومان

⏳ سفارش شما <b>در انتظار تایید</b> توسط کارشناسان ما می‌باشد و به زودی فعال خواهد شد.

📊 <b>همین حالا</b> میتوانید از طریق دکمه زیر سفارش خود را مشاهده کنید.`;

    const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
    const dashboardUrl = `${frontendUrl}/dashboard`;

    // Create inline keyboard with web app button
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '📊 مشاهده سفارش',
            web_app: { url: dashboardUrl }
          }
        ]
      ]
    };

    const result = await bot.sendMessage(telegramId, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });

    console.log(`[Telegram Bot] Order confirmation notification sent to user ${telegramId}`);
    return {
      success: true,
      messageId: result.message_id
    };
  } catch (error) {
    console.error(`[Telegram Bot] Error sending order notification to ${telegramId}:`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
};

// Send order delivery status update notification to user
const sendOrderDeliveryStatusNotification = async (telegramId, orderNumber, productName, deliveryStatus) => {
  if (!bot) {
    bot = initBot();
    if (!bot) {
      console.warn('[Telegram Bot] Bot not initialized, skipping delivery status notification');
      return { success: false, message: 'Bot not initialized' };
    }
  }

  try {
    let statusText = '';
    let emoji = '';
    let message = '';

    switch (deliveryStatus) {
      case 'processing':
        statusText = 'در حال پردازش';
        emoji = '⏳';
        message = `⏳ <b>کاربر گرامی وان‌ساب</b>،

📦 سفارش شما با شماره <code>${orderNumber}</code> در حال پردازش می‌باشد.

🛍️ <b>محصول</b> : ${productName}

✅ سفارش شما <b>توسط کارشناسان ما در حال بررسی و آماده‌سازی</b> می‌باشد و به زودی برای شما ارسال خواهد شد.

📊 <b>همین حالا</b> میتوانید از طریق دکمه زیر وضعیت سفارش خود را مشاهده کنید.`;
        break;
      case 'delivered':
        statusText = 'تحویل به مشتری شده';
        emoji = '✅';
        message = `✅ <b>کاربر گرامی وان‌ساب</b>،

🎉 سفارش شما با شماره <code>${orderNumber}</code> <b>با موفقیت</b> آماده و تحویل داده شده است.

🛍️ <b>محصول</b> : ${productName}

✨ سفارش شما <b>تکمیل شده</b> و در دسترس شما قرار دارد.

📊 <b>همین حالا</b> میتوانید از طریق دکمه زیر سفارش خود را مشاهده کنید.`;
        break;
      default:
        return { success: false, message: 'Invalid delivery status' };
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
    const orderDetailUrl = `${frontendUrl}/orders/${orderNumber}`;

    // Create inline keyboard with web app button
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '📊 مشاهده سفارش',
            web_app: { url: orderDetailUrl }
          }
        ]
      ]
    };

    const result = await bot.sendMessage(telegramId, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });

    console.log(`[Telegram Bot] Order delivery status notification sent to user ${telegramId}, status: ${deliveryStatus}`);
    return {
      success: true,
      messageId: result.message_id
    };
  } catch (error) {
    console.error(`[Telegram Bot] Error sending delivery status notification to ${telegramId}:`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
};

// Send order completion notification to user
const sendOrderCompletionNotification = async (telegramId, orderNumber, productName, amount) => {
  if (!bot) {
    bot = initBot();
    if (!bot) {
      console.warn('[Telegram Bot] Bot not initialized, skipping order completion notification');
      return { success: false, message: 'Bot not initialized' };
    }
  }

  try {
    // Format amount in Latin numbers
    const amountFormatted = amount.toLocaleString('en-US');

    const message = `✅ <b>خرید شما موفق بود</b>

📦 <b>شماره سفارش</b> : <code>${orderNumber}</code>
🛍️ <b>محصول</b> : ${productName}
💵 <b>مبلغ</b> : <code>${amountFormatted}</code> تومان

🎉 سفارش شما <b>با موفقیت</b> ثبت و پرداخت شد.

✅ پس از تایید توسط کارشناسان ما، <b>وضعیت سفارش شما تغییر خواهد کرد</b> و محصول به شما تحویل داده خواهد شد.

📊 <b>همین حالا</b> میتوانید از طریق دکمه زیر سفارش خود را مشاهده کنید.`;

    const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
    const dashboardUrl = `${frontendUrl}/dashboard`;

    // Create inline keyboard with web app button
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '📊 مشاهده سفارش',
            web_app: { url: dashboardUrl }
          }
        ]
      ]
    };

    const result = await bot.sendMessage(telegramId, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });

    console.log(`[Telegram Bot] Order completion notification sent to user ${telegramId}`);
    return {
      success: true,
      messageId: result.message_id
    };
  } catch (error) {
    console.error(`[Telegram Bot] Error sending order completion notification to ${telegramId}:`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
};

// Send admin order report to channel
const sendAdminOrderReport = async (userId, orderNumber, productName, amount, paymentMethod, walletAddress = null) => {
  if (!bot) {
    bot = initBot();
    if (!bot) {
      console.warn('[Telegram Bot] Bot not initialized, skipping admin order report');
      return { success: false, message: 'Bot not initialized' };
    }
  }

  const channelId = process.env.TELEGRAM_ADMIN_CHANNEL_ID;
  if (!channelId) {
    console.warn('[Telegram Bot] Admin channel ID not configured, skipping admin order report');
    return { success: false, message: 'Channel ID not configured' };
  }

  try {
    const mysql = require('../database/mysql');
    
    // Get user information
    const userQuery = `
      SELECT id, telegramID, phoneNumber, userName, loginInfo 
      FROM users 
      WHERE id = ?
    `;
    const users = await mysql.query(userQuery, [userId]);
    
    if (!users || users.length === 0) {
      return { success: false, message: 'User not found' };
    }
    
    const user = users[0];
    
    // Format user info - Start with UserID
    let userInfo = `👤 <b>UserID</b> : <code>${userId}</code>\n`;
    
    // Check if user is from Telegram or Website
    let isTelegramUser = false;
    let userFirstName = '';
    let userLastName = '';
    let userUsername = '';
    
    if (user.telegramID) {
      try {
        // Try to get user info from Telegram API
        const chat = await bot.getChat(user.telegramID);
        userFirstName = chat.first_name || '';
        userLastName = chat.last_name || '';
        userUsername = chat.username ? `@${chat.username}` : '';
        isTelegramUser = true;
      } catch (error) {
        // If can't get user info, assume it's telegram user anyway
        isTelegramUser = true;
      }
    }
    
    // Display user info based on source
    if (isTelegramUser) {
      // Telegram user: show Telegram ID, name, username, and phone separately
      userInfo += `   🆔 <b>Telegram ID</b> : <code>${user.telegramID}</code>\n`;
      const fullName = `${userFirstName} ${userLastName}`.trim();
      if (fullName) {
        userInfo += `   👤 <b>Name</b> : ${fullName}\n`;
      }
      if (userUsername) {
        userInfo += `   📱 <b>Username</b> : ${userUsername}\n`;
      }
      if (user.phoneNumber) {
        userInfo += `   📞 <b>Phone</b> : <code>${user.phoneNumber}</code>\n`;
      }
    } else {
      // Website user: show only UserID and phone
      if (user.phoneNumber) {
        userInfo += `   📞 <b>Phone</b> : <code>${user.phoneNumber}</code>\n`;
      }
    }
    
    // Display login method (entry point)
    const loginMethod = user.loginInfo === 'telegramMiniApp' ? 'Telegram Mini App' : 'Website';
    userInfo += `   📲 <b>Entry Method</b> : ${loginMethod}\n\n`;
    
    // Format amount
    const amountFormatted = amount.toLocaleString('en-US');
    
    // Format payment method
    let methodText = '';
    switch (paymentMethod.toLowerCase()) {
      case 'online':
      case 'zibal':
      case 'gateway':
      case 'onlinegateway':
        methodText = 'OnlineGateway';
        break;
      case 'cryptocurrency':
      case 'crypto':
      case 'tron':
        methodText = 'Cryptocurrency';
        break;
      case 'wallet':
        methodText = 'Wallet';
        break;
      default:
        methodText = paymentMethod;
    }
    
    // Order information
    userInfo += `📦 <b>Order Number</b> : <code>${orderNumber}</code>\n`;
    userInfo += `💰 <b>Amount</b> : <code>${amountFormatted}</code> Tomans\n`;
    userInfo += `💳 <b>Payment Method</b> : ${methodText}\n`;
    
    // Show wallet address for crypto payments
    if (walletAddress && methodText === 'Cryptocurrency') {
      const formattedWallet = walletAddress.length > 12
        ? `${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 4)}`
        : walletAddress;
      userInfo += `🔗 <b>Wallet Address</b> : <code>${formattedWallet}</code>\n`;
    }
    
    // Format date (Jalaali)
    const now = new Date();
    const jalali = jalaali.toJalaali(now);
    const monthNames = [
      'Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
      'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'
    ];
    const day = jalali.jd;
    const monthName = monthNames[jalali.jm - 1];
    const year = jalali.jy;
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    userInfo += `\n⏰ <code>${day} ${monthName} ${year} - ${hours}:${minutes}</code>`;
    
    const message = `🛒 <b>New Order Pay</b>\n\n${userInfo}`;
    
    // Create inline keyboard with URL button to profile
    const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
    const profileUrl = `${frontendUrl}/profile`;
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '👤 View Profile',
            url: profileUrl
          }
        ]
      ]
    };
    
    const result = await bot.sendMessage(channelId, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
    
    console.log(`[Telegram Bot] Admin order report sent to channel ${channelId}`);
    return {
      success: true,
      messageId: result.message_id
    };
  } catch (error) {
    console.error(`[Telegram Bot] Error sending admin order report:`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
};

// Send admin charge report to channel
const sendAdminChargeReport = async (userId, amount, chargeMethod, shabaNumber = null, walletAddress = null) => {
  if (!bot) {
    bot = initBot();
    if (!bot) {
      console.warn('[Telegram Bot] Bot not initialized, skipping admin report');
      return { success: false, message: 'Bot not initialized' };
    }
  }

  const channelId = process.env.TELEGRAM_ADMIN_CHANNEL_ID;
  if (!channelId) {
    console.warn('[Telegram Bot] Admin channel ID not configured, skipping admin report');
    return { success: false, message: 'Channel ID not configured' };
  }

  try {
    const mysql = require('../database/mysql');
    
    // Get user information
    const userQuery = `
      SELECT id, telegramID, phoneNumber, userName, loginInfo 
      FROM users 
      WHERE id = ?
    `;
    const users = await mysql.query(userQuery, [userId]);
    
    if (!users || users.length === 0) {
      return { success: false, message: 'User not found' };
    }
    
    const user = users[0];
    
    // Format user info - Start with UserID
    let userInfo = `👤 <b>UserID</b> : <code>${userId}</code>\n`;
    
    // Check if user is from Telegram or Website
    let isTelegramUser = false;
    let userFirstName = '';
    let userLastName = '';
    let userUsername = '';
    
    if (user.telegramID) {
      try {
        // Try to get user info from Telegram API
        const chat = await bot.getChat(user.telegramID);
        userFirstName = chat.first_name || '';
        userLastName = chat.last_name || '';
        userUsername = chat.username ? `@${chat.username}` : '';
        isTelegramUser = true;
      } catch (error) {
        // If can't get user info, assume it's telegram user anyway
        isTelegramUser = true;
      }
    }
    
    // Display user info based on source
    if (isTelegramUser) {
      // Telegram user: show Telegram ID, name, username, and phone separately
      userInfo += `   🆔 <b>Telegram ID</b> : <code>${user.telegramID}</code>\n`;
      const fullName = `${userFirstName} ${userLastName}`.trim();
      if (fullName) {
        userInfo += `   👤 <b>Name</b> : ${fullName}\n`;
      }
      if (userUsername) {
        userInfo += `   📱 <b>Username</b> : ${userUsername}\n`;
      }
      if (user.phoneNumber) {
        userInfo += `   📞 <b>Phone</b> : <code>${user.phoneNumber}</code>\n`;
      }
    } else {
      // Website user: show only UserID and phone
      if (user.phoneNumber) {
        userInfo += `   📞 <b>Phone</b> : <code>${user.phoneNumber}</code>\n`;
      }
    }
    
    // Display login method (entry point)
    const loginMethod = user.loginInfo === 'telegramMiniApp' ? 'Telegram Mini App' : 'Website';
    userInfo += `   📲 <b>Entry Method</b> : ${loginMethod}\n\n`;
    
    // Format amount
    const amountFormatted = amount.toLocaleString('en-US');
    userInfo += `💰 <b>Amount</b> : <code>${amountFormatted}</code> Tomans\n`;
    
    // Format charge method
    let methodText = '';
    switch (chargeMethod.toLowerCase()) {
      case 'carttocard':
      case 'cardtocard':
      case 'card_to_card':
      case 'saman':
        methodText = 'CartToCard';
        break;
      case 'online':
      case 'zibal':
      case 'gateway':
      case 'onlinegateway':
        methodText = 'OnlineGateway';
        break;
      case 'cryptocurrency':
      case 'crypto':
      case 'tron':
        methodText = 'Cryptocurrency';
        break;
      default:
        methodText = chargeMethod;
    }
    userInfo += `👨🏻‍💻 <b>Charge Method</b> : ${methodText}\n`;
    
    // Format SHABA or wallet address (only show SHABA for CartToCard, not for OnlineGateway)
    const showShaba = methodText === 'CartToCard' && shabaNumber;
    if (showShaba) {
      const cleanShaba = shabaNumber.replace(/^IR/i, '');
      const formattedShaba = cleanShaba.length > 12 
        ? `IR${cleanShaba.substring(0, 4)}...${cleanShaba.substring(cleanShaba.length - 5)}`
        : `IR${cleanShaba}`;
      userInfo += `💳 <b>From Sheba</b> : <code>${formattedShaba}</code>\n`;
    } else if (walletAddress) {
      const formattedWallet = walletAddress.length > 12
        ? `${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 4)}`
        : walletAddress;
      userInfo += `💳 <b>Wallet Address</b> : <code>${formattedWallet}</code>\n`;
    }
    
    // Format date (Jalaali)
    const now = new Date();
    const jalali = jalaali.toJalaali(now);
    const monthNames = [
      'Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
      'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'
    ];
    const day = jalali.jd;
    const monthName = monthNames[jalali.jm - 1];
    const year = jalali.jy;
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    userInfo += `\n⏰ <code>${day} ${monthName} ${year} - ${hours}:${minutes}</code>`;
    
    const message = `💸 <b>New Add Balance</b>\n\n${userInfo}`;
    
    // Create inline keyboard with URL button to profile
    const frontendUrl = process.env.FRONTEND_URL || 'https://osf.mirall.ir';
    const profileUrl = `${frontendUrl}/profile`;
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '👤 View Profile',
            url: profileUrl
          }
        ]
      ]
    };
    
    const result = await bot.sendMessage(channelId, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
    
    console.log(`[Telegram Bot] Admin charge report sent to channel ${channelId}`);
    return {
      success: true,
      messageId: result.message_id
    };
  } catch (error) {
    console.error(`[Telegram Bot] Error sending admin report:`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
};

// Initialize bot on module load
if (process.env.TELEGRAM_BOT_TOKEN) {
  initBot();
}

module.exports = {
  initBot,
  sendWalletChargeNotification,
  sendOrderConfirmationNotification,
  sendOrderCompletionNotification,
  sendOrderDeliveryStatusNotification,
  sendAdminOrderReport,
  sendAdminChargeReport
};

