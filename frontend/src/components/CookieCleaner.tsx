"use client";

import { useEffect } from "react";

/**
 * کامپوننت برای حذف کوکی‌های غیرضروری
 */
export default function CookieCleaner() {
  useEffect(() => {
    // لیست کوکی‌های غیرضروری که باید حذف شوند
    const cookiesToRemove = [
      "__next_hmr_refresh_hash__",
      "phpmyadmin",
      "pma",
      "land",
      "refresh_token",
      // فقط "token" نگه داشته می‌شود (اگر نیاز دارید)
    ];

    // حذف کوکی‌ها
    cookiesToRemove.forEach((cookieName) => {
      // حذف از تمام مسیرها
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
    });

    // همچنین می‌توانیم یک interval تنظیم کنیم تا کوکی‌های جدید را هم حذف کنیم
    const interval = setInterval(() => {
      cookiesToRemove.forEach((cookieName) => {
        if (document.cookie.includes(cookieName)) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        }
      });
    }, 1000); // هر 1 ثانیه بررسی می‌کند

    return () => {
      clearInterval(interval);
    };
  }, []);

  return null; // این کامپوننت چیزی رندر نمی‌کند
}

