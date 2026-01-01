const axios = require('axios');

const SMS_API_URL = 'https://api.sms.ir/v1/send/verify';
const SANDBOX_TEMPLATE_ID = 123456;

const sendOTP = async (mobile, code) => {
  try {
    const apiKey = process.env.SMS_API_KEY;
    
    if (!apiKey) {
      throw new Error('SMS API key is not configured');
    }

    console.log(`Sending OTP to ${mobile}, code: ${code}`);
    const response = await axios.post(
      SMS_API_URL,
      {
        mobile: mobile,
        templateId: SANDBOX_TEMPLATE_ID,
        parameters: [
          {
            name: 'Code',
            value: code.toString()
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': apiKey
        }
      }
    );

    if (response.data.status === 1) {
      console.log(`OTP sent successfully to ${mobile}, messageId: ${response.data.data?.messageId}`);
      return {
        success: true,
        messageId: response.data.data?.messageId,
        cost: response.data.data?.cost
      };
    } else {
      return {
        success: false,
        message: response.data.message || 'Failed to send SMS'
      };
    }
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        throw new Error('SMS API authentication failed');
      } else if (status === 429) {
        throw new Error('Too many requests to SMS API');
      } else if (status === 400) {
        throw new Error(data.message || 'Invalid request to SMS API');
      } else {
        throw new Error(data.message || 'SMS API error');
      }
    }
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

const sendMessage = async (mobile, message) => {
  try {
    const apiKey = process.env.SMS_API_KEY;
    
    if (!apiKey) {
      throw new Error('SMS API key is not configured');
    }

    console.log(`Sending message to ${mobile}`);
    // TODO: استفاده از API مناسب برای ارسال پیامک متنی
    // فعلاً فقط لاگ می‌کنیم
    console.log(`Message: ${message}`);
    
    return {
      success: true,
      message: 'Message sent successfully'
    };
  } catch (error) {
    console.error('Error sending message:', error);
    throw new Error(`Failed to send message: ${error.message}`);
  }
};

module.exports = {
  sendOTP,
  sendMessage
};

