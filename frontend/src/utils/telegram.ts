"use client";

// تعریف تایپ برای Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
          chat?: {
            id: number;
            type: string;
            title?: string;
            username?: string;
            photo_url?: string;
          };
          auth_date: number;
          hash: string;
        };
        version: string;
        platform: string;
        colorScheme: "light" | "dark";
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        BackButton: {
          isVisible: boolean;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          setParams: (params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred: (type: "error" | "success" | "warning") => void;
          selectionChanged: () => void;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        sendData: (data: string) => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink: (url: string) => void;
        openInvoice: (url: string, callback?: (status: string) => void) => void;
        showPopup: (params: {
          title?: string;
          message: string;
          buttons?: Array<{
            id?: string;
            type?: "default" | "ok" | "close" | "cancel" | "destructive";
            text: string;
          }>;
        }, callback?: (id: string) => void) => void;
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
        showScanQrPopup: (params: {
          text?: string;
        }, callback?: (text: string) => void) => void;
        closeScanQrPopup: () => void;
        readTextFromClipboard: (callback?: (text: string) => void) => void;
        requestWriteAccess: (callback?: (granted: boolean) => void) => void;
        requestContact: (callback?: (granted: boolean) => void) => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        enableVerticalSwipes: () => void;
        disableVerticalSwipes: () => void;
      };
    };
  }
}

/**
 * بررسی می‌کند که آیا در مینی‌اپ تلگرام هستیم یا نه
 */
export const isTelegramWebApp = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!window.Telegram?.WebApp;
};

/**
 * دریافت نمونه WebApp تلگرام
 */
export const getTelegramWebApp = () => {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp || null;
};

/**
 * دریافت اطلاعات کاربر از تلگرام
 */
export const getTelegramUser = () => {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user || null;
};

/**
 * دریافت اطلاعات چت از تلگرام
 */
export const getTelegramChat = () => {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.chat || null;
};

/**
 * مقداردهی اولیه مینی‌اپ تلگرام
 */
export const initTelegramWebApp = () => {
  if (typeof window === "undefined") return;
  
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    // آماده‌سازی مینی‌اپ
    webApp.ready();
    
    // گسترش صفحه به اندازه کامل
    webApp.expand();
    
    // جلوگیری از بسته شدن مینی اپ با swipe
    if (typeof webApp.enableClosingConfirmation === "function") {
      webApp.enableClosingConfirmation();
    }
    
    // فعال کردن vertical swipes برای bounce effect
    if (typeof webApp.enableVerticalSwipes === "function") {
      webApp.enableVerticalSwipes();
    }
    
    // تنظیم رنگ‌های تم
    if (webApp.colorScheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    return webApp;
  }
  
  return null;
};

