const axios = require('axios');

const NOBITEX_API_URL = 'https://apiv2.nobitex.ir/v3';

const getTRXPrice = async () => {
  try {
    const response = await axios.get(`${NOBITEX_API_URL}/orderbook/TRXIRT`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.data && response.data.status === 'ok' && response.data.lastTradePrice) {
      // lastTradePrice is in Rial, convert to Toman
      const priceInRial = parseFloat(response.data.lastTradePrice);
      const priceInToman = priceInRial / 10;
      
      return {
        success: true,
        price: priceInToman,
        priceInRial: priceInRial,
        lastUpdate: response.data.lastUpdate,
        asks: response.data.asks || [],
        bids: response.data.bids || []
      };
    } else {
      return {
        success: false,
        message: 'Invalid response from Nobitex API'
      };
    }
  } catch (error) {
    console.error('Error fetching TRX price from Nobitex:', error);
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Nobitex API error',
        statusCode: error.response.status
      };
    }
    return {
      success: false,
      message: error.message || 'Failed to fetch TRX price'
    };
  }
};

const calculateTrxAmount = (amountToman, trxPrice) => {
  if (!trxPrice || trxPrice <= 0) {
    throw new Error('Invalid TRX price');
  }
  
  const trxAmount = amountToman / trxPrice;
  return parseFloat(trxAmount.toFixed(8));
};

module.exports = {
  getTRXPrice,
  calculateTrxAmount
};

