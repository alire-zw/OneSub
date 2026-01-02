const axios = require('axios');

const SMS_API_URL = 'https://api.sms.ir/v1/send/verify';
const SANDBOX_TEMPLATE_ID = 123456;

// SMS Template IDs
const WALLET_CHARGE_TEMPLATE_ID = process.env.SMS_WALLET_CHARGE_TEMPLATE_ID || null;
const ORDER_CONFIRMATION_TEMPLATE_ID = process.env.SMS_ORDER_CONFIRMATION_TEMPLATE_ID || null;
const ORDER_DELIVERED_TEMPLATE_ID = process.env.SMS_ORDER_DELIVERED_TEMPLATE_ID || null;

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

// Send wallet charge SMS using template
const sendWalletChargeSMS = async (mobile, amount) => {
  try {
    const apiKey = process.env.SMS_API_KEY;
    
    if (!apiKey) {
      throw new Error('SMS API key is not configured');
    }

    if (!WALLET_CHARGE_TEMPLATE_ID) {
      console.warn('[SMS Service] Wallet charge template ID not configured, skipping SMS');
      return {
        success: false,
        message: 'Template ID not configured'
      };
    }

    console.log(`Sending wallet charge SMS to ${mobile}, amount: ${amount}`);
    const response = await axios.post(
      SMS_API_URL,
      {
        mobile: mobile,
        templateId: parseInt(WALLET_CHARGE_TEMPLATE_ID),
        parameters: [
          {
            name: 'amount',
            value: amount.toLocaleString('fa-IR')
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
      console.log(`Wallet charge SMS sent successfully to ${mobile}, messageId: ${response.data.data?.messageId}`);
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
    throw new Error(`Failed to send wallet charge SMS: ${error.message}`);
  }
};

// Send order delivered SMS using template
const sendOrderDeliveredSMS = async (mobile, orderNumber, productName) => {
  try {
    const apiKey = process.env.SMS_API_KEY;
    
    if (!apiKey) {
      throw new Error('SMS API key is not configured');
    }

    if (!ORDER_DELIVERED_TEMPLATE_ID) {
      console.warn('[SMS Service] Order delivered template ID not configured, skipping SMS');
      return {
        success: false,
        message: 'Template ID not configured'
      };
    }

    console.log(`Sending order delivered SMS to ${mobile}, orderNumber: ${orderNumber}`);
    const response = await axios.post(
      SMS_API_URL,
      {
        mobile: mobile,
        templateId: parseInt(ORDER_DELIVERED_TEMPLATE_ID),
        parameters: [
          {
            name: 'orderNumber',
            value: orderNumber
          },
          {
            name: 'productName',
            value: productName
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
      console.log(`Order delivered SMS sent successfully to ${mobile}, messageId: ${response.data.data?.messageId}`);
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
    throw new Error(`Failed to send order delivered SMS: ${error.message}`);
  }
};

// Send templated SMS (generic function)
const sendTemplatedSMS = async (mobile, templateId, parameters) => {
  try {
    const apiKey = process.env.SMS_API_KEY;
    
    if (!apiKey) {
      throw new Error('SMS API key is not configured');
    }

    if (!templateId) {
      console.warn('[SMS Service] Template ID not provided, skipping SMS');
      return {
        success: false,
        message: 'Template ID not provided'
      };
    }

    console.log(`Sending templated SMS to ${mobile}, templateId: ${templateId}`);
    const response = await axios.post(
      SMS_API_URL,
      {
        mobile: mobile,
        templateId: parseInt(templateId),
        parameters: parameters || []
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
      console.log(`Templated SMS sent successfully to ${mobile}, messageId: ${response.data.data?.messageId}`);
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
    throw new Error(`Failed to send templated SMS: ${error.message}`);
  }
};

module.exports = {
  sendOTP,
  sendMessage,
  sendWalletChargeSMS,
  sendOrderDeliveredSMS,
  sendTemplatedSMS
};

