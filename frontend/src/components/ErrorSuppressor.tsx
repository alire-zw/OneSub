"use client";

import { useEffect } from "react";

/**
 * کامپوننت برای سرکوب خطاهای NetworkError که معمولاً در Next.js رخ می‌دهند
 * این خطاها معمولاً به دلیل abort شدن درخواست‌ها در طول navigation هستند
 * و نیازی به نمایش در کنسول ندارند
 */
export default function ErrorSuppressor() {
  useEffect(() => {
    // سرکوب خطاهای NetworkError در console.error
    const originalError = console.error;
    console.error = (...args: any[]) => {
      // بررسی اینکه آیا این خطای NetworkError است
      const firstArg = args[0];
      let shouldSuppress = false;

      if (firstArg) {
        // بررسی خطاهای TypeError با پیام NetworkError
        if (
          firstArg instanceof TypeError &&
          (firstArg.message?.includes("NetworkError") ||
            firstArg.message?.includes("Failed to fetch") ||
            firstArg.message?.includes("fetch failed") ||
            firstArg.message?.includes("Load failed"))
        ) {
          shouldSuppress = true;
        }
        // بررسی خطاهای AbortError
        else if (
          firstArg instanceof Error &&
          (firstArg.name === "AbortError" || firstArg.name === "NetworkError")
        ) {
          shouldSuppress = true;
        }
        // بررسی پیام‌های متنی
        else if (
          typeof firstArg === "string" &&
          (firstArg.includes("NetworkError") ||
            firstArg.includes("Failed to fetch") ||
            firstArg.includes("fetch failed") ||
            firstArg.includes("Load failed"))
        ) {
          shouldSuppress = true;
        }
        // بررسی object با name یا message
        else if (
          typeof firstArg === "object" &&
          firstArg !== null &&
          ("name" in firstArg || "message" in firstArg)
        ) {
          const obj = firstArg as { name?: string; message?: string };
          if (
            obj.name === "NetworkError" ||
            obj.name === "AbortError" ||
            obj.message?.includes("NetworkError") ||
            obj.message?.includes("Failed to fetch") ||
            obj.message?.includes("fetch failed")
          ) {
            shouldSuppress = true;
          }
        }
      }

      if (shouldSuppress) {
        // این خطاها را suppress می‌کنیم
        return;
      }

      // سایر خطاها را به صورت عادی نمایش می‌دهیم
      originalError.apply(console, args);
    };

    // سرکوب خطاهای unhandled rejection که مربوط به fetch هستند
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      if (!error) return;

      const errorName = error?.name;
      const errorMessage = error?.message || error?.toString() || "";

      // بررسی اینکه آیا این خطای NetworkError یا AbortError است
      if (
        errorName === "NetworkError" ||
        errorName === "AbortError" ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("fetch failed") ||
        errorMessage.includes("Load failed")
      ) {
        // جلوگیری از نمایش خطا در کنسول
        event.preventDefault();
        return;
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      // بازگرداندن console.error به حالت اولیه
      console.error = originalError;
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}

