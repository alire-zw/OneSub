"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "./OrderDetail.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, getAuthHeaders, API_BASE_URL } from "@/config/api";
import Image from "next/image";
import ClockIcon from "@/components/icons/ClockIcon";
import CopyIcon from "@/components/icons/CopyIcon";

interface OrderDetail {
  id: number;
  orderNumber: string;
  productId: number;
  paymentMethod: string;
  orderEmail: string | null;
  amount: number;
  status: string;
  deliveryStatus: 'received' | 'processing' | 'delivered';
  adminMessage: string | null;
  transactionId: number | null;
  walletAddress: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  productName: string | null;
  category: string | null;
  accountType: string | null;
  activationType: string | null;
  activationTimeMinutes: number | null;
  duration: number | null;
  regularPrice: number | null;
  merchantPrice: number | null;
  imagePath: string | null;
  additionalInfo: string | null;
  refNumber: string | null;
  cardNumber: string | null;
  trackId: number | null;
  transactionStatus: string | null;
  transactionPaidAt: string | null;
}

export default function UserOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const orderId = params?.id as string;

  const copyEmailToClipboard = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        setCopiedEmail(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      if (authLoading || !orderId) return;

      setIsLoading(true);
      try {
        const response = await fetch(API_ENDPOINTS.ORDERS.GET(orderId), {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch order");
        }

        const data = await response.json();

        if (data.status === 1 && data.data) {
          setOrder(data.data);
        }
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [authLoading, orderId]);

  const formatPrice = (price: number, isCrypto: boolean = false): string => {
    const toman = isCrypto ? Math.floor(price / 10) : price;
    return new Intl.NumberFormat("fa-IR").format(toman);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'نامشخص';
    const date = new Date(dateString);
    
    // بررسی معتبر بودن تاریخ
    if (isNaN(date.getTime()) || !isFinite(date.getTime())) {
      return 'نامشخص';
    }
    
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatDuration = (days: number | null): string => {
    if (!days) return 'نامشخص';
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

  const getPaymentMethodText = (method: string): string => {
    switch (method) {
      case 'wallet':
        return 'کیف پول';
      case 'online':
        return 'درگاه آنلاین';
      case 'crypto':
        return 'ارز دیجیتال';
      case 'card':
        return 'کارت به کارت';
      default:
        return method;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'در انتظار';
      case 'completed':
        return 'تکمیل شده';
      case 'failed':
        return 'ناموفق';
      case 'cancelled':
        return 'لغو شده';
      default:
        return status;
    }
  };

  const getDeliveryStatusText = (status: string): string => {
    switch (status) {
      case 'received':
        return 'دریافت شده';
      case 'processing':
        return 'در حال پردازش';
      case 'delivered':
        return 'تحویل شده';
      default:
        return status;
    }
  };

  // محاسبه زمان حدودی تحویل
  const calculateDeliveryTime = (order: OrderDetail): string | null => {
    // برای سفارشات در وضعیت "دریافت شده" و "در حال پردازش" نمایش داده می‌شود
    if (order.deliveryStatus !== "received" && order.deliveryStatus !== "processing") {
      return null;
    }

    // بررسی activationTimeMinutes
    const activationMinutes = order.activationTimeMinutes;
    if (!activationMinutes || activationMinutes === 0 || activationMinutes === null) {
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
      return "گذشته است";
    }
    
    if (diffMinutes < 60) {
      return `${diffMinutes} دقیقه`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      if (minutes > 0) {
        return `${hours} ساعت و ${minutes} دقیقه`;
      }
      return `${hours} ساعت`;
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="جزئیات سفارش" onBack={() => router.push("/orders")} />
        <div className={styles.content}>
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={styles.container}>
        <PageHeader title="جزئیات سفارش" onBack={() => router.push("/orders")} />
        <div className={styles.content}>
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>سفارش یافت نشد</p>
          </div>
        </div>
      </div>
    );
  }

  const isCrypto = order.paymentMethod === 'crypto';

  return (
    <div className={styles.container}>
      {showToast && (
        <div className={styles.toast}>
          <span>ایمیل کپی شد</span>
        </div>
      )}
      <PageHeader title="جزئیات سفارش" onBack={() => router.push("/orders")} />

      <div className={styles.content}>
        {/* باکس محصول */}
        {order.productName && (
          <div className={styles.productBox}>
            {order.imagePath ? (
              <div className={styles.productImageContainer}>
                <Image
                  src={`${API_BASE_URL}${order.imagePath}`}
                  alt={order.productName}
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
                  <h3 className={styles.productName}>{order.productName}</h3>
                  {order.duration && (
                    <>
                      <span className={styles.productSeparator}>|</span>
                      <span className={styles.productDuration}>{formatDuration(order.duration)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.productDetails}>
                <div className={styles.productInfoRow}>
                  <span>{order.orderNumber}</span>
                  <span className={styles.infoSeparator}>•</span>
                  <span>{formatPrice(order.amount, isCrypto)} تومان</span>
                </div>
                <div className={styles.productInfoRow}>
                  <div className={styles.deliveryStatusBadgeInline} data-status={order.deliveryStatus}>
                    {getDeliveryStatusText(order.deliveryStatus)}
                  </div>
                </div>
                {calculateDeliveryTime(order) && (
                  <div className={styles.deliveryTimeRow}>
                    <ClockIcon width={10} height={10} className={styles.clockIcon} />
                    <span className={styles.deliveryTimeText}>
                      زمان حدودی تحویل: {calculateDeliveryTime(order)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* اطلاعات سفارش */}
        <div className={styles.infoSection}>
          {/* روش پرداخت */}
          <div className={styles.fieldGroup}>
            <div className={styles.fieldContainer}>
              <div className={styles.fieldWrapper}>
                <label className={styles.fieldLabel}>روش پرداخت:</label>
                <div className={styles.fieldItem}>
                  <span className={styles.fieldItemValue}>{getPaymentMethodText(order.paymentMethod)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* نوع حساب و فعالسازی */}
          {order.accountType && (
            <div className={styles.fieldGroup}>
              <div className={styles.fieldContainer}>
                {order.accountType && (
                  <div className={styles.fieldWrapper}>
                    <label className={styles.fieldLabel}>نوع حساب:</label>
                    <div className={styles.fieldItem}>
                      <span className={styles.fieldItemValue}>{order.accountType}</span>
                    </div>
                  </div>
                )}
                {order.activationType && (
                  <div className={styles.fieldWrapper}>
                    <label className={styles.fieldLabel}>نوع فعالسازی:</label>
                    <div className={styles.fieldItem}>
                      <span className={styles.fieldItemValue}>{order.activationType}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ایمیل سفارش */}
          {order.orderEmail && (
            <div className={styles.fieldGroup}>
              <div className={styles.fieldContainer}>
                <div className={styles.fieldWrapper}>
                  <label className={styles.fieldLabel}>ایمیل سفارش:</label>
                  <div className={styles.fieldItemWithCopy}>
                    <span className={styles.fieldItemValue}>{order.orderEmail}</span>
                    <button
                      type="button"
                      onClick={() => copyEmailToClipboard(order.orderEmail!)}
                      className={styles.copyButton}
                      title="کپی"
                    >
                      <CopyIcon width={16} height={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* اطلاعات پرداخت */}
          {(order.trackId || order.refNumber || order.cardNumber || order.walletAddress) && (
            <div className={styles.fieldGroup}>
              <div className={styles.fieldContainer}>
                {order.trackId && (
                  <div className={styles.fieldWrapper}>
                    <label className={styles.fieldLabel}>کد پیگیری:</label>
                    <div className={styles.fieldItem}>
                      <span className={styles.fieldItemValue}>{order.trackId}</span>
                    </div>
                  </div>
                )}
                {order.refNumber && (
                  <div className={styles.fieldWrapper}>
                    <label className={styles.fieldLabel}>شماره مرجع:</label>
                    <div className={styles.fieldItem}>
                      <span className={styles.fieldItemValue}>{order.refNumber}</span>
                    </div>
                  </div>
                )}
                {order.cardNumber && (
                  <div className={styles.fieldWrapper}>
                    <label className={styles.fieldLabel}>شماره کارت:</label>
                    <div className={styles.fieldItem}>
                      <span className={styles.fieldItemValue}>****{order.cardNumber.slice(-4)}</span>
                    </div>
                  </div>
                )}
                {order.walletAddress && (
                  <div className={styles.fieldWrapper}>
                    <label className={styles.fieldLabel}>آدرس کیف پول:</label>
                    <div className={styles.fieldItem}>
                      <span className={styles.fieldItemValue}>{order.walletAddress}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* تاریخ‌ها */}
          <div className={styles.fieldGroup}>
            <div className={styles.fieldContainer}>
              <div className={styles.fieldWrapper}>
                <label className={styles.fieldLabel}>تاریخ ثبت:</label>
                <div className={styles.fieldItem}>
                  <span className={styles.fieldItemValue}>{formatDate(order.createdAt)}</span>
                </div>
              </div>
              {order.completedAt && (
                <div className={styles.fieldWrapper}>
                  <label className={styles.fieldLabel}>تاریخ تکمیل:</label>
                  <div className={styles.fieldItem}>
                    <span className={styles.fieldItemValue}>{formatDate(order.completedAt)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* اطلاعات تکمیلی سفارش (پیام ادمین) */}
          {order.adminMessage && (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>اطلاعات تکمیلی سفارش:</label>
              <div className={styles.adminMessageBox}>
                <p className={styles.adminMessageText}>{order.adminMessage}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

