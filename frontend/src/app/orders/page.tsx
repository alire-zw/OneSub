"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, getAuthHeaders, API_BASE_URL } from "@/config/api";
import Image from "next/image";
import styles from "./page.module.css";

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

type DeliveryStatus = "received" | "processing" | "delivered" | "all";

export default function OrdersPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DeliveryStatus>("all");

  // بارگذاری سفارشات
  useEffect(() => {
    const fetchOrders = async () => {
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

        if (data.status === 1 && data.data) {
          setAllOrders(data.data);
          setOrders(data.data);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [authLoading]);

  // فیلتر کردن سفارشات بر اساس وضعیت
  useEffect(() => {
    if (activeTab === "all") {
      setOrders(allOrders);
    } else {
      const filtered = allOrders.filter(
        (order) => order.deliveryStatus === activeTab
      );
      setOrders(filtered);
    }
  }, [activeTab, allOrders]);

  const getDeliveryStatusText = (status: string) => {
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

  const formatPrice = (amount: number, isCrypto: boolean = false) => {
    const amountInToman = isCrypto ? Math.floor(amount / 10) : amount;
    return amountInToman.toLocaleString("fa-IR");
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "نامشخص";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "نامشخص";
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch (error) {
      return "نامشخص";
    }
  };

  const isCryptoPayment = (paymentMethod: string) => {
    return paymentMethod === "crypto";
  };

  if (authLoading || isLoading) {
    return (
      <div className={styles.pageWrapper}>
        <PageHeader title="سفارش‌های من" />
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
          </div>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    // اگر از طریق لینک مستقیم آمده باشد یا referrer نباشد، به داشبرد برود
    if (typeof window !== 'undefined') {
      const referrer = document.referrer;
      const isDirectAccess = !referrer || referrer.includes(window.location.host) === false;
      
      if (isDirectAccess || referrer.includes('/orders')) {
        router.push('/dashboard');
      } else {
        router.back();
      }
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <PageHeader title="سفارش‌های من" onBack={handleBack} />
      <div className={styles.container}>

        {/* Tabs */}
        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tab} ${activeTab === "received" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("received")}
          >
            در انتظار تایید
          </button>
          <button
            className={`${styles.tab} ${activeTab === "processing" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("processing")}
          >
            در حال پردازش
          </button>
          <button
            className={`${styles.tab} ${activeTab === "delivered" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("delivered")}
          >
            تحویل شده
          </button>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <p className={styles.emptyText}>
              {activeTab === "all"
                ? "هنوز سفارشی ثبت نشده است"
                : "سفارشی با این وضعیت یافت نشد"}
            </p>
          </div>
        ) : (
          <div className={styles.ordersList}>
            {orders.map((order) => (
              <div
                key={order.id}
                className={styles.orderItem}
                onClick={() => router.push(`/orders/${order.orderNumber}`)}
              >
                <div className={styles.orderImageContainer}>
                  {order.imagePath ? (
                    <Image
                      src={`${API_BASE_URL}${order.imagePath}`}
                      alt={order.productName || "محصول"}
                      fill
                      className={styles.orderImage}
                    />
                  ) : (
                    <div className={styles.orderImagePlaceholder}>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <path d="M21 15l-5-5L5 21"></path>
                      </svg>
                    </div>
                  )}
                </div>

                <div className={styles.orderInfo}>
                  <div className={styles.orderHeader}>
                    <h3 className={styles.orderProductName}>
                      {order.productName || "محصول نامشخص"}
                    </h3>
                    <div
                      className={styles.deliveryStatusBadge}
                      data-status={order.deliveryStatus}
                    >
                      {getDeliveryStatusText(order.deliveryStatus)}
                    </div>
                  </div>

                  <div className={styles.orderDetails}>
                    <span className={styles.orderNumber}>
                      شماره سفارش: {order.orderNumber}
                    </span>
                    <span className={styles.orderSeparator}>•</span>
                    <span className={styles.orderAmount}>
                      {formatPrice(order.amount, isCryptoPayment(order.paymentMethod))}{" "}
                      تومان
                    </span>
                  </div>

                  <div className={styles.orderDate}>
                    {formatDate(order.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

