"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, getAuthHeaders } from "@/config/api";

/**
 * Hook برای mark کردن نوتیفیکیشن به عنوان خوانده شده وقتی از لینک نوتیف وارد می‌شود
 * این hook باید در layout اصلی یا صفحاتی که می‌خواهند این قابلیت را داشته باشند استفاده شود
 */
export const useNotificationRead = () => {
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const notificationId = searchParams?.get('notif');
    if (!notificationId) return;

    const notifId = parseInt(notificationId);
    if (isNaN(notifId)) return;

    // Mark notification as read
    const markAsRead = async () => {
      try {
        await fetch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notifId), {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        // Remove the query parameter from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('notif');
        window.history.replaceState({}, '', url.toString());
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    };

    markAsRead();
  }, [searchParams, isAuthenticated]);
};

