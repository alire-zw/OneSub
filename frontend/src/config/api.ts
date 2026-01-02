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
    TEST_NOTIFICATION: `${API_BASE_URL}/api/wallet/test-notification`,
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
    LIST: `${API_BASE_URL}/api/orders`,
    PURCHASE_WITH_WALLET: `${API_BASE_URL}/api/orders/purchase-with-wallet`,
    PURCHASE_DIRECT: `${API_BASE_URL}/api/orders/purchase-direct`,
    PURCHASE_WITH_CRYPTO: `${API_BASE_URL}/api/orders/purchase-with-crypto`,
    GET: (orderNumber: string) => `${API_BASE_URL}/api/orders/${orderNumber}`,
    ADMIN: {
      ALL: `${API_BASE_URL}/api/orders/admin/all`,
      GET: (id: string | number) => `${API_BASE_URL}/api/orders/admin/${id}`,
      UPDATE_DELIVERY_STATUS: (id: string | number) => `${API_BASE_URL}/api/orders/admin/${id}/delivery-status`,
    },
  },
  NOTIFICATIONS: {
    LIST: `${API_BASE_URL}/api/notifications`,
    UNREAD_COUNT: `${API_BASE_URL}/api/notifications/unread-count`,
    MARK_READ: (id: number) => `${API_BASE_URL}/api/notifications/${id}/read`,
    MARK_ALL_READ: `${API_BASE_URL}/api/notifications/read-all`,
  },
  CRYPTO: {
    TRON_CHARGE: `${API_BASE_URL}/api/crypto/tron/charge`,
    TRON_PAYMENT: (trackId: string | number) => `${API_BASE_URL}/api/crypto/tron/payment/${trackId}`,
    TRON_WALLET: (walletAddress: string) => `${API_BASE_URL}/api/crypto/tron/wallet/${walletAddress}`,
  },
  TICKETS: {
    LIST: `${API_BASE_URL}/api/tickets`,
    GET: (id: string | number) => `${API_BASE_URL}/api/tickets/${id}`,
    CREATE: `${API_BASE_URL}/api/tickets`,
    SEND_MESSAGE: (id: string | number) => `${API_BASE_URL}/api/tickets/${id}/messages`,
    CLOSE: (id: string | number) => `${API_BASE_URL}/api/tickets/${id}/close`,
    MY_ORDERS: `${API_BASE_URL}/api/tickets/orders/my-orders`,
    ADMIN: {
      ALL: `${API_BASE_URL}/api/tickets/admin/all`,
      GET: (id: string | number) => `${API_BASE_URL}/api/tickets/admin/${id}`,
      SEND_MESSAGE: (id: string | number) => `${API_BASE_URL}/api/tickets/admin/${id}/messages`,
      UPDATE_STATUS: (id: string | number) => `${API_BASE_URL}/api/tickets/admin/${id}/status`,
    },
  },
};

/**
 * بررسی اینکه آیا در محیط مرورگر هستیم
 */
export const isBrowser = (): boolean => {
  return typeof window !== "undefined";
};

/**
 * دریافت token از localStorage
 */
export const getAuthToken = (): string | null => {
  if (!isBrowser()) return null;
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

/**
 * تابع fetch ایمن که خطاهای شبکه را به درستی مدیریت می‌کند
 * این تابع خطاهای NetworkError که معمولاً در Next.js رخ می‌دهند را suppress می‌کند
 */
export const safeFetch = async (
  url: string | URL,
  options?: RequestInit
): Promise<Response | null> => {
  // اگر در محیط مرورگر نیستیم، null برگردان
  if (!isBrowser()) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    // خطاهای NetworkError که معمولاً در Next.js رخ می‌دهند را suppress می‌کنیم
    // این خطاها معمولاً به دلیل abort شدن درخواست‌ها در طول navigation هستند
    if (
      error?.name === "AbortError" ||
      error?.name === "NetworkError" ||
      error?.message?.includes("fetch") ||
      error?.message?.includes("network") ||
      error?.message?.includes("Failed to fetch")
    ) {
      // این خطاها را suppress می‌کنیم چون معمولاً به دلیل navigation یا abort شدن هستند
      // و نیازی به لاگ کردن ندارند
      return null;
    }

    // خطاهای دیگر را دوباره throw می‌کنیم
    throw error;
  }
};

/**
 * تابع fetch با مدیریت خطا برای درخواست‌های JSON
 */
export const fetchJSON = async <T = any>(
  url: string | URL,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> => {
  try {
    const response = await safeFetch(url, options);

    if (!response) {
      return { data: null, error: null }; // خطای شبکه suppress شده
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errorData.message || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error: any) {
    // فقط خطاهای غیر NetworkError را لاگ می‌کنیم
    if (
      error?.name !== "AbortError" &&
      error?.name !== "NetworkError" &&
      !error?.message?.includes("fetch") &&
      !error?.message?.includes("network")
    ) {
      console.error("Fetch error:", error);
    }
    return {
      data: null,
      error: error?.message || "خطا در ارتباط با سرور",
    };
  }
};

