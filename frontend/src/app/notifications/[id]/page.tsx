"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
  linkText: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export default function NotificationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notificationId = params?.id ? parseInt(params.id as string) : null;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!notificationId) {
      setError("شناسه اعلان نامعتبر است");
      setLoading(false);
      return;
    }

    const fetchNotification = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.NOTIFICATIONS.LIST, {
          headers: getAuthHeaders(),
        });

        const result = await response.json();

        if (result.status === 1 && result.data) {
          const foundNotification = result.data.find(
            (n: Notification) => n.id === notificationId
          );

          if (foundNotification) {
            setNotification(foundNotification);

            // Mark as read if not already read
            if (!foundNotification.isRead) {
              try {
                await fetch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId), {
                  method: 'POST',
                  headers: getAuthHeaders(),
                });
                setNotification(prev => prev ? { ...prev, isRead: true } : null);
              } catch (error) {
                console.error('Error marking notification as read:', error);
              }
            }
          } else {
            setError("اعلان یافت نشد");
          }
        } else {
          setError(result.message || "خطا در دریافت اعلان");
        }
      } catch (err) {
        console.error("Error fetching notification:", err);
        setError("خطا در دریافت اعلان");
      } finally {
        setLoading(false);
      }
    };

    fetchNotification();
  }, [isAuthenticated, router, notificationId]);

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
        <PageHeader title="جزئیات اعلان" />
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className={styles.pageWrapper}>
        <PageHeader title="جزئیات اعلان" />
        <div className={styles.container}>
        <div className={styles.errorBox}>
          <p>{error || "اعلان یافت نشد"}</p>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <PageHeader title="جزئیات اعلان" />
      <div className={styles.container}>
        {/* Title */}
        <h1 className={styles.notificationTitle}>{notification.title}</h1>
        
        <div className={styles.notificationDetail}>
          {/* Date */}
          <div className={styles.dateSection}>
            <span className={styles.dateLabel}>تاریخ:</span>
            <span className={styles.dateValue}>{formatDate(notification.createdAt)}</span>
          </div>

          {/* Message */}
          <div className={styles.messageSection}>
            <p className={styles.messageText}>{notification.message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

