"use client";

import { useEffect, useState } from "react";
import { isTelegramWebApp, getTelegramUser } from "@/utils/telegram";
import { API_ENDPOINTS } from "@/config/api";

interface RegisterResponse {
  status: number;
  message: string;
  data?: {
    userId: number;
  };
}

export const useTelegramRegister = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerStatus, setRegisterStatus] = useState<{
    success: boolean;
    message: string;
    userId?: number;
  } | null>(null);

  useEffect(() => {
    const registerUser = async () => {
      // بررسی اینکه آیا در مینی‌اپ تلگرام هستیم
      if (!isTelegramWebApp()) {
        return;
      }

      const telegramUser = getTelegramUser();
      if (!telegramUser) {
        console.log("اطلاعات کاربر تلگرام در دسترس نیست");
        return;
      }

      // بررسی اینکه آیا قبلاً ثبت‌نام شده است
      const registeredKey = `telegram_registered_${telegramUser.id}`;
      if (localStorage.getItem(registeredKey)) {
        console.log("کاربر قبلاً ثبت‌نام شده است");
        return;
      }

      setIsRegistering(true);

      try {
        console.log("📤 ارسال درخواست ثبت‌نام به:", API_ENDPOINTS.USERS.REGISTER);
        
        const response = await fetch(API_ENDPOINTS.USERS.REGISTER, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            telegramUser: {
              id: telegramUser.id,
              first_name: telegramUser.first_name,
              last_name: telegramUser.last_name || "",
              username: telegramUser.username || null,
              language_code: telegramUser.language_code || null,
              is_premium: telegramUser.is_premium || false,
              photo_url: telegramUser.photo_url || null,
            },
          }),
        });

        if (!response.ok) {
          // اگر response ok نبود، سعی کنیم JSON را بخوانیم
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
          }
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data: RegisterResponse = await response.json();

        if (response.ok && data.status === 1) {
          // ذخیره در localStorage که کاربر ثبت‌نام شده
          localStorage.setItem(registeredKey, "true");
          if (data.data?.userId) {
            localStorage.setItem(`telegram_user_id_${telegramUser.id}`, data.data.userId.toString());
          }

          setRegisterStatus({
            success: true,
            message: data.message,
            userId: data.data?.userId,
          });

          console.log("✅ کاربر با موفقیت ثبت‌نام شد:", data);
        } else {
          // اگر کاربر قبلاً وجود دارد، آن را هم ذخیره می‌کنیم
          if (response.status === 409) {
            localStorage.setItem(registeredKey, "true");
          }

          setRegisterStatus({
            success: false,
            message: data.message || "خطا در ثبت‌نام",
          });

          console.error("❌ خطا در ثبت‌نام:", data);
        }
      } catch (error) {
        console.error("❌ خطا در ارسال درخواست:", error);
        
        let errorMessage = "خطا در ارتباط با سرور";
        if (error instanceof TypeError && error.message === "Failed to fetch") {
          errorMessage = "سرور در دسترس نیست. لطفاً مطمئن شوید که سرور backend در حال اجرا است.";
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        setRegisterStatus({
          success: false,
          message: errorMessage,
        });
      } finally {
        setIsRegistering(false);
      }
    };

    // کمی تاخیر برای اطمینان از لود شدن SDK تلگرام
    const timeoutId = setTimeout(() => {
      registerUser();
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  return {
    isRegistering,
    registerStatus,
  };
};

