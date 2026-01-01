"use client";

import { useEffect, useState } from "react";
import { isTelegramWebApp, getTelegramUser, getTelegramChat } from "@/utils/telegram";
import { useTelegramRegister } from "@/hooks/useTelegramRegister";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export default function TelegramUserInfo() {
  const [isInTelegram, setIsInTelegram] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [chat, setChat] = useState<any>(null);
  const { isRegistering, registerStatus } = useTelegramRegister();

  useEffect(() => {
    const checkTelegram = () => {
      if (isTelegramWebApp()) {
        setIsInTelegram(true);
        const telegramUser = getTelegramUser();
        const telegramChat = getTelegramChat();
        
        // لاگ کردن اطلاعات کامل
        const webApp = window.Telegram?.WebApp;
        if (webApp) {
          console.log("=== اطلاعات مینی‌اپ تلگرام ===");
          console.log("initDataUnsafe:", JSON.stringify(webApp.initDataUnsafe, null, 2));
          console.log("User:", JSON.stringify(telegramUser, null, 2));
          console.log("Chat:", JSON.stringify(telegramChat, null, 2));
          console.log("Color Scheme:", webApp.colorScheme);
          console.log("Theme Params:", JSON.stringify(webApp.themeParams, null, 2));
          console.log("=============================");
        }
        
        if (telegramUser) {
          setUser(telegramUser);
        }
        if (telegramChat) {
          setChat(telegramChat);
        }
      } else {
        setIsInTelegram(false);
        console.log("در مینی‌اپ تلگرام نیستید");
      }
    };

    // بررسی اولیه
    checkTelegram();

    // بررسی مجدد بعد از لود شدن SDK تلگرام
    const interval = setInterval(() => {
      checkTelegram();
    }, 500);

    // پاک کردن interval بعد از 5 ثانیه
    setTimeout(() => {
      clearInterval(interval);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!isInTelegram) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-card border border-border rounded-lg p-6 shadow-md">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              اطلاعات مینی‌اپ تلگرام
            </h3>
            <p className="text-sm text-foreground-muted">
              شما در مینی‌اپ تلگرام هستید
            </p>
          </div>
        </div>

        {user && (
          <div className="space-y-3">
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-foreground-secondary mb-3">
                اطلاعات کاربر:
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground-muted min-w-[100px]">
                    نام:
                  </span>
                  <span className="text-sm text-foreground font-medium">
                    {user.first_name} {user.last_name || ""}
                  </span>
                </div>
                {user.username && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground-muted min-w-[100px]">
                      نام کاربری:
                    </span>
                    <span className="text-sm text-foreground font-medium">
                      @{user.username}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground-muted min-w-[100px]">
                    ID:
                  </span>
                  <span className="text-sm text-foreground font-medium font-mono">
                    {user.id}
                  </span>
                </div>
                {user.language_code && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground-muted min-w-[100px]">
                      زبان:
                    </span>
                    <span className="text-sm text-foreground font-medium">
                      {user.language_code}
                    </span>
                  </div>
                )}
                {user.is_premium && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground-muted min-w-[100px]">
                      وضعیت:
                    </span>
                    <span className="text-sm text-primary font-medium">
                      Premium ✓
                    </span>
                  </div>
                )}
                {user.photo_url && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground-muted min-w-[100px]">
                      عکس:
                    </span>
                    <img
                      src={user.photo_url}
                      alt="User photo"
                      className="w-10 h-10 rounded-full"
                    />
                  </div>
                )}
              </div>
            </div>

            {chat && (
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium text-foreground-secondary mb-3">
                  اطلاعات چت:
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground-muted min-w-[100px]">
                      نوع:
                    </span>
                    <span className="text-sm text-foreground font-medium">
                      {chat.type}
                    </span>
                  </div>
                  {chat.title && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground-muted min-w-[100px]">
                        عنوان:
                      </span>
                      <span className="text-sm text-foreground font-medium">
                        {chat.title}
                      </span>
                    </div>
                  )}
                  {chat.username && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground-muted min-w-[100px]">
                        نام کاربری:
                      </span>
                      <span className="text-sm text-foreground font-medium">
                        @{chat.username}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!user && (
          <div className="text-sm text-foreground-muted text-center py-4">
            اطلاعات کاربر در دسترس نیست
          </div>
        )}

        {/* نمایش وضعیت ثبت‌نام */}
        <div className="border-t border-border pt-4 mt-4">
          {isRegistering && (
            <div className="flex items-center gap-2 text-sm text-foreground-muted">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>در حال ثبت‌نام...</span>
            </div>
          )}
          {registerStatus && (
            <div
              className={`text-sm ${
                registerStatus.success
                  ? "text-success"
                  : "text-error"
              }`}
            >
              {registerStatus.success ? "✅ " : "❌ "}
              {registerStatus.message}
              {registerStatus.userId && (
                <span className="block text-xs text-foreground-muted mt-1">
                  User ID: {registerStatus.userId}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

