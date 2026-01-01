"use client";

import { useEffect } from "react";
import { initTelegramWebApp, isTelegramWebApp, getTelegramWebApp } from "@/utils/telegram";

export default function TelegramInit() {
  useEffect(() => {
    // بررسی و مقداردهی اولیه مینی‌اپ تلگرام
    if (isTelegramWebApp()) {
      initTelegramWebApp();
      
      // اضافه کردن کلاس به body برای تشخیص مینی‌اپ
      document.body.classList.add("telegram-webapp");
      
      // تنظیم رنگ‌های هدر و بکگراند از CSS variables
      const setTelegramColors = () => {
        const webApp = getTelegramWebApp();
        if (!webApp) return;
        
        // دریافت رنگ‌ها از CSS variables
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        
        // تابع تبدیل rgb/rgba به hex
        const rgbToHex = (color: string): string => {
          // اگر قبلاً hex است، برگردان
          if (color.startsWith("#")) {
            return color;
          }
          
          // تبدیل rgb/rgba به hex
          const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
          if (match) {
            const r = parseInt(match[1], 10).toString(16).padStart(2, "0");
            const g = parseInt(match[2], 10).toString(16).padStart(2, "0");
            const b = parseInt(match[3], 10).toString(16).padStart(2, "0");
            return `#${r}${g}${b}`;
          }
          
          return color;
        };
        
        // دریافت رنگ بکگراند اصلی از CSS variable
        let backgroundColor = computedStyle.getPropertyValue("--background").trim();
        if (!backgroundColor || backgroundColor === "") {
          // اگر CSS variable موجود نبود، از computed style استفاده کن
          backgroundColor = computedStyle.backgroundColor;
        }
        backgroundColor = rgbToHex(backgroundColor);
        
        // دریافت رنگ هدر از CSS variable (از card background استفاده می‌کنیم)
        let headerColor = computedStyle.getPropertyValue("--card-background").trim();
        if (!headerColor || headerColor === "") {
          // اگر card-background موجود نبود، از background استفاده کن
          headerColor = computedStyle.getPropertyValue("--background").trim();
          if (!headerColor || headerColor === "") {
            headerColor = computedStyle.backgroundColor;
          }
        }
        headerColor = rgbToHex(headerColor);
        
        // اعمال رنگ‌ها به مینی‌اپ
        try {
          webApp.setHeaderColor(headerColor);
          webApp.setBackgroundColor(backgroundColor);
        } catch (error) {
          console.error("Error setting Telegram colors:", error);
        }
      };
      
      // تنظیم رنگ‌ها بعد از لود شدن
      const timeoutId = setTimeout(setTelegramColors, 200);
      
      // تنظیم مجدد رنگ‌ها در صورت تغییر تم
      const observer = new MutationObserver(() => {
        setTimeout(setTelegramColors, 100);
      });
      
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      
      // تنظیم مجدد رنگ‌ها در صورت تغییر localStorage theme
      const handleStorageChange = () => {
        setTimeout(setTelegramColors, 100);
      };
      
      window.addEventListener("storage", handleStorageChange);
      
      return () => {
        clearTimeout(timeoutId);
        observer.disconnect();
        window.removeEventListener("storage", handleStorageChange);
      };
    } else {
      // حذف کلاس در صورت عدم وجود مینی‌اپ
      document.body.classList.remove("telegram-webapp");
    }
  }, []);

  return null;
}

