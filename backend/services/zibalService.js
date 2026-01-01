const axios = require('axios');

const ZIBAL_API_URL = 'https://gateway.zibal.ir/v1';
const ZIBAL_START_URL = 'https://gateway.zibal.ir/start';

const requestPayment = async (options) => {
  try {
    const {
      merchant = 'zibal',
      amount,
      callbackUrl,
      description = '',
      orderId = null,
      mobile = null,
      allowedCards = null,
      nationalCode = null,
      checkMobileWithCard = null
    } = options;

    const requestBody = {
      merchant,
      amount,
      callbackUrl
    };

    if (description) requestBody.description = description;
    if (orderId) requestBody.orderId = orderId;
    if (mobile) requestBody.mobile = mobile;
    if (allowedCards && Array.isArray(allowedCards)) requestBody.allowedCards = allowedCards;
    if (nationalCode) requestBody.nationalCode = nationalCode;
    if (checkMobileWithCard !== null) requestBody.checkMobileWithCard = checkMobileWithCard;

    const response = await axios.post(
      `${ZIBAL_API_URL}/request`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (response.data.result === 100) {
      return {
        success: true,
        trackId: response.data.trackId,
        message: response.data.message
      };
    } else {
      return {
        success: false,
        resultCode: response.data.result,
        message: response.data.message || 'Failed to create payment request'
      };
    }
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        resultCode: error.response.data?.result,
        message: error.response.data?.message || 'Zibal API error'
      };
    }
    throw new Error(`Failed to request payment: ${error.message}`);
  }
};

const verifyPayment = async (trackId, merchant = 'zibal') => {
  try {
    const response = await axios.post(
      `${ZIBAL_API_URL}/verify`,
      {
        merchant: merchant,
        trackId: trackId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (response.data.result === 100) {
      return {
        success: true,
        paidAt: response.data.paidAt,
        amount: response.data.amount,
        cardNumber: response.data.cardNumber,
        refNumber: response.data.refNumber,
        description: response.data.description,
        orderId: response.data.orderId,
        status: response.data.status
      };
    } else {
      return {
        success: false,
        resultCode: response.data.result,
        message: response.data.message || 'Payment verification failed'
      };
    }
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        resultCode: error.response.data?.result,
        message: error.response.data?.message || 'Zibal API error'
      };
    }
    throw new Error(`Failed to verify payment: ${error.message}`);
  }
};

const inquiryPayment = async (trackId, merchant = 'zibal') => {
  try {
    const response = await axios.post(
      `${ZIBAL_API_URL}/inquiry`,
      {
        merchant: merchant,
        trackId: trackId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    return {
      success: response.data.result === 100,
      resultCode: response.data.result,
      message: response.data.message,
      paidAt: response.data.paidAt,
      amount: response.data.amount,
      status: response.data.status
    };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        resultCode: error.response.data?.result,
        message: error.response.data?.message || 'Zibal API error'
      };
    }
    throw new Error(`Failed to inquiry payment: ${error.message}`);
  }
};

const getPaymentUrl = (trackId) => {
  return `${ZIBAL_START_URL}/${trackId}`;
};

/**
 * تبدیل شماره کارت به شماره شبا
 * @param {string} cardNumber - شماره کارت (16 رقم)
 * @param {string} apiKey - کلید API زیبال برای سرویس facility
 * @returns {Promise<Object>} اطلاعات شبا شامل IBAN، نام صاحب حساب و نام بانک
 */
const cardToIban = async (cardNumber, apiKey) => {
  try {
    if (!cardNumber || !apiKey) {
      return {
        success: false,
        message: 'شماره کارت و کلید API الزامی است'
      };
    }

    // حذف کاراکترهای غیر عددی از شماره کارت
    const cleanCardNumber = cardNumber.replace(/[^\d]/g, '');

    if (cleanCardNumber.length !== 16) {
      return {
        success: false,
        message: 'شماره کارت باید 16 رقم باشد'
      };
    }

    const response = await axios.post(
      'https://api.zibal.ir/v1/facility/cardToIban/',
      {
        cardNumber: cleanCardNumber
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (response.data.result === 1) {
      return {
        success: true,
        data: {
          name: response.data.data?.name || null,
          IBAN: response.data.data?.IBAN || null,
          bankName: response.data.data?.bankName || null
        },
        message: response.data.message || 'موفق'
      };
    } else {
      return {
        success: false,
        resultCode: response.data.result,
        message: response.data.message || 'خطا در تبدیل کارت به شبا'
      };
    }
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        resultCode: error.response.data?.result,
        message: error.response.data?.message || 'خطا در ارتباط با API زیبال'
      };
    }
    throw new Error(`Failed to convert card to IBAN: ${error.message}`);
  }
};

module.exports = {
  requestPayment,
  verifyPayment,
  inquiryPayment,
  getPaymentUrl,
  cardToIban
};

