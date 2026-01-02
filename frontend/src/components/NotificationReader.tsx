"use client";

import { useNotificationRead } from "@/hooks/useNotificationRead";

/**
 * Component برای mark کردن نوتیفیکیشن به عنوان خوانده شده
 * وقتی کاربر از لینک نوتیف وارد می‌شود
 */
export default function NotificationReader() {
  useNotificationRead();
  return null;
}

