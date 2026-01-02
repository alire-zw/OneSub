"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import styles from "./page.module.css";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

function NotificationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const fetchNotifications = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.NOTIFICATIONS.LIST, {
          headers: getAuthHeaders(),
        });

        const result = await response.json();

        if (result.status === 1 && result.data) {
          setNotifications(result.data);
        } else {
          setError(result.message || "خطا در دریافت اعلان‌ها");
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setError("خطا در دریافت اعلان‌ها");
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [isAuthenticated, router, searchParams]);

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      const response = await fetch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId), {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId
              ? { ...notif, isRead: true, readAt: new Date().toISOString() }
              : notif
          )
        );
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => ({
            ...notif,
            isRead: true,
            readAt: notif.readAt || new Date().toISOString(),
          }))
        );
      }
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <PageHeader title="اعلان‌ها" />
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <PageHeader title="اعلان‌ها" />
      <div className={styles.container}>
        {notifications.length > 0 && (
          <div className={styles.headerActions}>
            <button
              onClick={handleMarkAllAsRead}
              className={styles.markAllReadButton}
            >
              خوانده شده همه
            </button>
          </div>
        )}

        {error ? (
          <div className={styles.errorBox}>
            <p>{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>اعلانی وجود ندارد</p>
          </div>
        ) : (
          <div className={styles.notificationsList}>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`${styles.notificationItem} ${
                  !notification.isRead ? styles.unread : ""
                }`}
                onClick={() => {
                  router.push(`/notifications/${notification.id}`);
                }}
              >
                <div className={styles.notificationContent}>
                  <h3 className={styles.notificationTitle}>{notification.title}</h3>
                  <p className={styles.notificationMessage}>{notification.message}</p>
                  <span className={styles.notificationDate}>
                    {formatDate(notification.createdAt)}
                  </span>
                </div>
                {!notification.isRead && (
                  <div className={styles.unreadIndicator} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className={styles.pageWrapper}>
        <PageHeader title="اعلان‌ها" />
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
          </div>
        </div>
      </div>
    }>
      <NotificationsPageContent />
    </Suspense>
  );
}

