const TronWeb = require('tronweb').TronWeb;

const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY;
const TRON_MASTER_WALLET = process.env.TRON_MASTER_WALLET;
const TRON_NETWORK = process.env.TRON_NETWORK || 'shasta'; // 'mainnet' or 'shasta'

// Initialize TronWeb
const getTronWeb = () => {
  const isMainnet = TRON_NETWORK === 'mainnet';
  const fullHost = isMainnet 
    ? 'https://api.trongrid.io' 
    : 'https://api.shasta.trongrid.io';
  
  const headers = {};
  if (TRONGRID_API_KEY) {
    headers['TRON-PRO-API-KEY'] = TRONGRID_API_KEY;
  }
  
  return new TronWeb({
    fullHost: fullHost,
    headers: headers
  });
};

const createWallet = async () => {
  try {
    const tronWeb = getTronWeb();
    const account = await tronWeb.createAccount();
    
    return {
      success: true,
      address: account.address.base58,
      privateKey: account.privateKey,
      publicKey: account.publicKey
    };
  } catch (error) {
    console.error('Error creating TRON wallet:', error);
    return {
      success: false,
      message: error.message || 'Failed to create TRON wallet'
    };
  }
};

const getBalance = async (address) => {
  try {
    const tronWeb = getTronWeb();
    const balance = await tronWeb.trx.getBalance(address);
    // Convert from SUN to TRX (1 TRX = 1,000,000 SUN)
    const balanceInTrx = balance / 1000000;
    
    return {
      success: true,
      balance: balance,
      balanceInTrx: balanceInTrx
    };
  } catch (error) {
    console.error(`Error getting balance for address ${address}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to get balance'
    };
  }
};

const sendTrx = async (fromPrivateKey, toAddress, amountInTrx) => {
  try {
    const tronWeb = getTronWeb();
    
    // Set private key to TronWeb instance
    tronWeb.setPrivateKey(fromPrivateKey);
    const fromAddress = tronWeb.defaultAddress.base58;
    
    // Convert TRX to SUN
    const amountInSun = tronWeb.toSun(amountInTrx);
    
    // Send transaction
    const transaction = await tronWeb.transactionBuilder.sendTrx(
      toAddress,
      amountInSun,
      fromAddress
    );
    
    const signedTransaction = await tronWeb.trx.sign(transaction);
    const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
    
    return {
      success: true,
      txid: result.txid,
      result: result
    };
  } catch (error) {
    console.error('Error sending TRX:', error);
    return {
      success: false,
      message: error.message || 'Failed to send TRX'
    };
  }
};

const sendToMaster = async (fromPrivateKey) => {
  try {
    if (!TRON_MASTER_WALLET) {
      return {
        success: false,
        message: 'Master wallet address not configured'
      };
    }
    
    // Get address from private key
    const tronWeb = getTronWeb();
    tronWeb.setPrivateKey(fromPrivateKey);
    const fromAddress = tronWeb.defaultAddress.base58;
    
    // Get balance first
    const balanceResult = await getBalance(fromAddress);
    
    if (!balanceResult.success || balanceResult.balanceInTrx <= 0) {
      return {
        success: false,
        message: 'No balance to transfer'
      };
    }
    
    // Send all balance to master wallet
    const sendResult = await sendTrx(
      fromPrivateKey,
      TRON_MASTER_WALLET,
      balanceResult.balanceInTrx
    );
    
    return sendResult;
  } catch (error) {
    console.error('Error sending to master wallet:', error);
    return {
      success: false,
      message: error.message || 'Failed to send to master wallet'
    };
  }
};

module.exports = {
  createWallet,
  getBalance,
  sendTrx,
  sendToMaster,
  getTronWeb
};

