"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import PaymentFailedIcon from "@/components/icons/PaymentFailedIcon";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import buyPageStyles from "../page.module.css";
import walletStyles from "@/app/wallet/Wallet.module.css";

interface OrderData {
  orderNumber: string;
  productId: number;
  paymentMethod: string;
  userEmail?: string;
  amount: number;
  status: string;
  date: string;
  completedAt?: string;
  product: {
    id: number;
    productName: string;
    category: string;
    accountType: string;
    activationType: string;
    activationTimeMinutes: number;
    duration: number;
    regularPrice: number;
    imagePath?: string;
  } | null;
}

// تابع formatDuration از صفحه خرید
const formatDuration = (days: number): string => {
  if (days < 30) {
    return `${days} روزه`;
  } else if (days === 30) {
    return "1 ماهه";
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} ماهه`;
  } else {
    const years = Math.floor(days / 365);
    const remainingMonths = Math.floor((days % 365) / 30);
    if (remainingMonths > 0) {
      return `${years} سال و ${remainingMonths} ماهه`;
    }
    return `${years} ساله`;
  }
};

// تابع formatPrice
const formatPrice = (price: number): string => {
  return price.toLocaleString('fa-IR');
};

// تابع formatDate
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'نامشخص';
  
  const date = new Date(dateString);
  
  // بررسی معتبر بودن تاریخ
  if (isNaN(date.getTime()) || !isFinite(date.getTime())) {
    return 'نامشخص';
  }
  
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

function PurchaseFailedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams?.get("orderNumber");
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // به‌روزرسانی اطلاعات کاربر
    refreshUser();
    
    // دریافت اطلاعات سفارش
    const fetchOrderData = async () => {
      if (!orderNumber) {
        setError("شماره سفارش یافت نشد");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(API_ENDPOINTS.ORDERS.GET(orderNumber), {
          headers: getAuthHeaders(),
        });

        const result = await response.json();

        if (result.status === 1 && result.data) {
          setOrderData(result.data);
        } else {
          setError(result.message || "خطا در دریافت اطلاعات سفارش");
        }
      } catch (err) {
        console.error("Error fetching order data:", err);
        setError("خطا در دریافت اطلاعات سفارش");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderNumber, refreshUser]);

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  const handleRetry = () => {
    if (orderData?.productId) {
      router.push(`/shop/product/${orderData.productId}/buy`);
    } else {
      router.push("/shop");
    }
  };

  if (loading) {
    return (
      <div className={walletStyles.walletPage}>
        <div className={walletStyles.walletCard}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <div style={{ width: '48px', height: '48px', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
          <style jsx>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className={walletStyles.walletPage}>
      <div className={walletStyles.walletCard}>
        {/* آیکون ناموفق */}
        <div className={`${walletStyles.iconContainer} ${walletStyles.iconContainerError}`}>
          <PaymentFailedIcon width={48} height={48} color="var(--error)" />
        </div>

        {/* پیام ناموفق */}
        <h1 className={walletStyles.cardTitle}>پرداخت ناموفق</h1>
        <p className={walletStyles.cardDescription}>
          متأسفانه پرداخت شما انجام نشد. در صورتی که مبلغی از حساب شما کسر شده است، با پشتیبانی تماس بگیرید.
        </p>

        {/* اطلاعات سفارش */}
        {orderData && (
          <>
            <div className={walletStyles.trackIdBox}>
              <div className={walletStyles.trackIdRow}>
                <span className={walletStyles.trackIdLabel}>شماره سفارش:</span>
                <span className={walletStyles.trackIdValue}>{orderData.orderNumber}</span>
              </div>
              <div className={walletStyles.trackIdRow}>
                <span className={walletStyles.trackIdLabel}>تاریخ:</span>
                <span className={`${walletStyles.trackIdValue} ${walletStyles.trackIdValueRtl}`}>{formatDate(orderData.date)}</span>
              </div>
              <div className={walletStyles.trackIdRow}>
                <span className={walletStyles.trackIdLabel}>مبلغ:</span>
                <span className={walletStyles.trackIdValue}>{formatPrice(orderData.amount)} تومان</span>
              </div>
            </div>

            {/* باکس اطلاعات محصول */}
            {orderData.product && (
              <div className={buyPageStyles.productBox} style={{ marginTop: '-16px', marginBottom: '24px', width: '100%', maxWidth: '100%' }}>
                {orderData.product.imagePath ? (
                  <div className={buyPageStyles.productImageContainer}>
                    <img
                      src={`${API_BASE_URL}${orderData.product.imagePath}`}
                      alt={orderData.product.productName}
                      className={buyPageStyles.productImage}
                    />
                  </div>
                ) : (
                  <div className={buyPageStyles.productImagePlaceholder}>
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
                <div className={buyPageStyles.productContent}>
                  <div className={buyPageStyles.productHeader}>
                    <div className={buyPageStyles.productNameRow}>
                      <h3 className={buyPageStyles.productName}>{orderData.product.productName}</h3>
                      <span className={buyPageStyles.productSeparator}>|</span>
                      <span className={buyPageStyles.productDuration}>{formatDuration(orderData.product.duration)}</span>
                    </div>
                  </div>
                  <div className={buyPageStyles.productDetails}>
                    <div className={buyPageStyles.productInfoRow}>
                      <span>{orderData.product.accountType}</span>
                      {orderData.product.activationTimeMinutes > 0 && (
                        <>
                          <span className={buyPageStyles.infoSeparator}>•</span>
                          <span>فعالسازی: {orderData.product.activationTimeMinutes} دقیقه</span>
                        </>
                      )}
                    </div>
                    <div className={buyPageStyles.productInfoRow}>
                      <span>نوع فعالسازی: {orderData.product.activationType}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className={walletStyles.trackIdBox} style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', marginBottom: '24px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--error)', textAlign: 'center' }}>{error}</p>
          </div>
        )}

        {/* دکمه‌ها */}
        <div className={walletStyles.buttonGroup}>
          <button onClick={handleRetry} className={walletStyles.walletButton}>
            تلاش مجدد
          </button>
          <button onClick={handleGoToDashboard} className={`${walletStyles.walletButton} ${walletStyles.walletButtonSecondary}`}>
            رفتن به داشبورد
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseFailedPage() {
  return (
    <Suspense fallback={
      <div className={buyPageStyles.container}>
        <div className={buyPageStyles.loadingContainer}>
          <div className={buyPageStyles.loadingSpinner}></div>
        </div>
      </div>
    }>
      <PurchaseFailedPageContent />
    </Suspense>
  );
}

