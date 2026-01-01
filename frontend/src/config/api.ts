// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4536";

export const API_ENDPOINTS = {
  USERS: {
    REGISTER: `${API_BASE_URL}/api/users/register`,
    OTP_LOGIN: `${API_BASE_URL}/api/users/otp-login`,
    TELEGRAM_LOGIN: `${API_BASE_URL}/api/users/telegram-login`,
    ME: `${API_BASE_URL}/api/users/me`,
    UPDATE_PROFILE: `${API_BASE_URL}/api/users/profile`,
  },
  SMS: {
    SEND_OTP: `${API_BASE_URL}/api/sms/send-otp`,
    VERIFY_OTP: `${API_BASE_URL}/api/sms/verify-otp`,
  },
  CARDS: {
    LIST: `${API_BASE_URL}/api/cards`,
    ADD: `${API_BASE_URL}/api/cards`,
    DELETE: `${API_BASE_URL}/api/cards`,
    CARD_TO_IBAN: `${API_BASE_URL}/api/cards/card-to-iban`,
  },
  TRANSACTIONS: {
    LIST: `${API_BASE_URL}/api/transactions`,
    LIST_ALL: `${API_BASE_URL}/api/transactions/all`,
    TODAY_STATS: `${API_BASE_URL}/api/transactions/today-stats`,
  },
  MERCHANTS: {
    REQUEST: `${API_BASE_URL}/api/merchants/request`,
    STATUS: `${API_BASE_URL}/api/merchants/status`,
    ALL: `${API_BASE_URL}/api/merchants/all`,
    APPROVE: (id: string) => `${API_BASE_URL}/api/merchants/${id}/approve`,
    REJECT: (id: string) => `${API_BASE_URL}/api/merchants/${id}/reject`,
  },
  WALLET: {
    BALANCE: `${API_BASE_URL}/api/wallet/balance`,
    CHARGE: `${API_BASE_URL}/api/wallet/charge`,
    TRANSACTIONS: `${API_BASE_URL}/api/wallet/transactions`,
  },
  PRODUCTS: {
    LIST: `${API_BASE_URL}/api/products`,
    GET: (id: string | number) => `${API_BASE_URL}/api/products/${id}`,
  },
  BANNERS: {
    LIST: `${API_BASE_URL}/api/banners`,
    GET: (id: string) => `${API_BASE_URL}/api/banners/${id}`,
    CREATE: `${API_BASE_URL}/api/banners`,
    UPDATE: (id: string) => `${API_BASE_URL}/api/banners/${id}`,
    DELETE: (id: string) => `${API_BASE_URL}/api/banners/${id}`,
    UPLOAD_IMAGE: `${API_BASE_URL}/api/banners/upload-image`,
  },
  ORDERS: {
    PURCHASE_WITH_WALLET: `${API_BASE_URL}/api/orders/purchase-with-wallet`,
    PURCHASE_DIRECT: `${API_BASE_URL}/api/orders/purchase-direct`,
    PURCHASE_WITH_CRYPTO: `${API_BASE_URL}/api/orders/purchase-with-crypto`,
    GET: (orderNumber: string) => `${API_BASE_URL}/api/orders/${orderNumber}`,
  },
  CRYPTO: {
    TRON_CHARGE: `${API_BASE_URL}/api/crypto/tron/charge`,
    TRON_PAYMENT: (trackId: string | number) => `${API_BASE_URL}/api/crypto/tron/payment/${trackId}`,
    TRON_WALLET: (walletAddress: string) => `${API_BASE_URL}/api/crypto/tron/wallet/${walletAddress}`,
  },
};

/**
 * دریافت token از localStorage
 */
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
};

/**
 * ساخت header برای درخواست‌های authenticated
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

