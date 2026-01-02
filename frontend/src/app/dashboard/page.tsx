"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import Image from "next/image";
import ShopIcon from "@/components/icons/ShopIcon";
import OrderIcon from "@/components/icons/OrderIcon";
import ContactIcon from "@/components/icons/ContactIcon";
import styles from './page.module.css';

interface Order {
  id: number;
  userId: number;
  orderNumber: string;
  productId: number;
  productName: string;
  imagePath: string | null;
  duration: number;
  activationTimeMinutes: number | null;
  amount: number;
  paymentMethod: string;
  status: string;
  deliveryStatus: "received" | "processing" | "delivered";
  createdAt: string;
  completedAt: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatestOrder = async () => {
      if (authLoading) return;

      setIsLoading(true);
      try {
        const response = await fetch(API_ENDPOINTS.ORDERS.LIST, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch orders");
        }

        const data = await response.json();
        if (data.status === 1 && data.data && data.data.length > 0) {
          setLatestOrder(data.data[0]);
        }
      } catch (error) {
        console.error("خطا در دریافت سفارشات:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestOrder();
  }, [authLoading]);

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat("fa-IR").format(amount);
  };

  const getDeliveryStatusText = (status: Order["deliveryStatus"]): string => {
    switch (status) {
      case "received":
        return "در انتظار تایید";
      case "processing":
        return "در حال پردازش";
      case "delivered":
        return "تحویل شده";
      default:
        return status;
    }
  };

  const getDeliveryStatusColor = (status: Order["deliveryStatus"]): string => {
    switch (status) {
      case "received":
        return "var(--warning)";
      case "processing":
        return "var(--info)";
      case "delivered":
        return "var(--primary)";
      default:
        return "var(--foreground-muted)";
    }
  };

  const formatDuration = (days: number) => {
    if (days < 30) {
      return `${days} روز`;
    }
    
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      
      if (remainingMonths > 0) {
        return `${years} سال و ${remainingMonths} ماه`;
      }
      return `${years} سال`;
    }
    
    if (remainingDays > 0) {
      return `${months} ماه و ${remainingDays} روز`;
    }
    return `${months} ماه`;
  };

  // محاسبه زمان حدودی تحویل
  const calculateDeliveryTime = (order: Order): string | null => {
    // برای سفارشات در وضعیت "در انتظار تایید" و "در حال پردازش" نمایش داده می‌شود
    if (order.deliveryStatus !== "received" && order.deliveryStatus !== "processing") {
      return null;
    }

    // بررسی activationTimeMinutes - می‌تواند null باشد یا 0
    const activationMinutes = order.activationTimeMinutes;
    if (activationMinutes === null || activationMinutes === undefined || activationMinutes === 0) {
      return null;
    }

    // استفاده از completedAt اگر وجود دارد، در غیر این صورت از createdAt
    const startDate = order.completedAt ? new Date(order.completedAt) : new Date(order.createdAt);
    if (isNaN(startDate.getTime())) {
      return null;
    }

    const deliveryDate = new Date(startDate.getTime() + activationMinutes * 60 * 1000);
    const now = new Date();
    
    const diffMs = deliveryDate.getTime() - now.getTime();
    const diffMinutes = Math.ceil(diffMs / (60 * 1000));
    
    // اگر زمان گذشته است، پیام مناسب نمایش می‌دهیم
    if (diffMinutes <= 0) {
      return `زمان تحویل: گذشته است`;
    }
    
    if (diffMinutes < 60) {
      return `زمان حدودی تحویل: ${diffMinutes} دقیقه`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      if (minutes > 0) {
        return `زمان حدودی تحویل: ${hours} ساعت و ${minutes} دقیقه`;
      }
      return `زمان حدودی تحویل: ${hours} ساعت`;
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>وضعیت آخرین سفارش شما</h3>
            <div className={styles.orderBox}>
              <div className={styles.productBoxSkeleton}>
                <div className={styles.productImageSkeleton} />
                <div className={styles.productContentSkeleton}>
                  <div className={styles.skeletonLine} style={{ width: '60%', marginBottom: '4px' }} />
                  <div className={styles.skeletonLine} style={{ width: '40%', marginBottom: '4px' }} />
                  <div className={styles.skeletonLine} style={{ width: '50%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>وضعیت آخرین سفارش شما</h3>
          <div className={styles.orderBox}>
            {latestOrder ? (
              <div 
                className={styles.listItem}
                onClick={() => router.push(`/orders/${latestOrder.orderNumber}`)}
              >
                <div className={styles.listItemStart}>
                  {latestOrder.imagePath ? (
                    <div className={styles.productImageContainer}>
                      <Image
                        src={`${API_BASE_URL}${latestOrder.imagePath}`}
                        alt={latestOrder.productName}
                        width={56}
                        height={56}
                        className={styles.productImage}
                      />
                    </div>
                  ) : (
                    <div className={styles.productImagePlaceholder}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-foreground-muted"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </div>
                  )}

                  <div className={styles.productContent}>
                    <div className={styles.productHeader}>
                      <div className={styles.productNameRow}>
                        <h3 className={styles.productName}>{latestOrder.productName}</h3>
                        <span className={styles.productSeparator}>|</span>
                        <span className={styles.productDuration}>{formatDuration(latestOrder.duration)}</span>
                      </div>
                    </div>

                    <div className={styles.productDetails}>
                      <div className={styles.productInfoRow}>
                        <span>{latestOrder.orderNumber}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={styles.listItemEnd}>
                  <div className={styles.statusContainer}>
                    <div 
                      className={styles.deliveryStatusBadge} 
                      data-status={latestOrder.deliveryStatus}
                    >
                      {getDeliveryStatusText(latestOrder.deliveryStatus)}
                    </div>
                    {(() => {
                      const deliveryTime = (latestOrder.deliveryStatus === "received" || latestOrder.deliveryStatus === "processing") 
                        ? calculateDeliveryTime(latestOrder) 
                        : null;
                      return deliveryTime ? (
                        <div className={styles.deliveryTimeBadge}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          <span>{deliveryTime}</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 64 41"
                  xmlns="http://www.w3.org/2000/svg"
                >
                    <title>No data</title>
                    <g transform="translate(0 1)" fill="none" fillRule="evenodd">
                      <ellipse
                        fill="var(--background-secondary)"
                        cx="32"
                        cy="33"
                        rx="32"
                        ry="7"
                      ></ellipse>
                      <g fillRule="nonzero" stroke="var(--border)">
                        <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z"></path>
                        <path
                          d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z"
                          fill="var(--background-secondary)"
                        ></path>
                      </g>
                    </g>
                  </svg>
                </div>
                <p className={styles.emptyText}>هنوز سفارشی ثبت نشده است</p>
              </div>
            )}
          </div>
        </div>

        {/* دکمه‌های دسترسی سریع */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>دکمه‌های اقدام سریع</h3>
          <div className={styles.actionButtons}>
            <button
              className={styles.actionButton}
              onClick={() => router.push("/shop/all")}
            >
              <ShopIcon width={18} height={18} />
              خرید اشتراک جدید
            </button>
            <div className={styles.actionButtonRow}>
              <button
                className={styles.actionButton}
                onClick={() => router.push("/orders")}
              >
                <OrderIcon width={18} height={18} />
                اشتراک‌های من
              </button>
              <button
                className={styles.actionButton}
                onClick={() => router.push("/contact")}
              >
                <ContactIcon width={18} height={18} />
                ثبت تیکت پشتیبانی
              </button>
            </div>
          </div>
        </div>

        {/* بخش دعوت از دوستان و اشتراک رایگان */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>دعوت از دوستان و اشتراک رایگان</h3>
          <div className={styles.referralBox}>
            <div className={styles.referralContent}>
              <div className={styles.referralIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <path d="M20 8v6"></path>
                  <path d="M23 11h-6"></path>
                </svg>
              </div>
              <div className={styles.referralText}>
                <h4 className={styles.referralTitle}>دعوت از دوستان</h4>
                <p className={styles.referralDescription}>
                  دوستان خود را دعوت کنید و برای هر دعوت موفق، اشتراک رایگان دریافت کنید
                </p>
              </div>
            </div>
            <button className={styles.referralButton}>
              دعوت از دوستان
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
