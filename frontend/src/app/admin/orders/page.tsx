"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "./Orders.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, getAuthHeaders, API_BASE_URL } from "@/config/api";
import OrderIcon from "@/components/icons/OrderIcon";
import SearchIcon from "@/components/icons/SearchIcon";

interface Order {
  id: number;
  userId: number;
  orderNumber: string;
  productId: number;
  paymentMethod: string;
  orderEmail: string | null;
  amount: number;
  paidAmount: number;
  status: string;
  deliveryStatus: 'received' | 'processing' | 'delivered';
  transactionId: number | null;
  walletAddress: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  userName: string | null;
  phoneNumber: string | null;
  telegramID: number | null;
  userEmail: string | null;
  loginInfo: string | null;
  productName: string | null;
  category: string | null;
  accountType: string | null;
  imagePath: string | null;
}

type DeliveryStatus = 'received' | 'processing' | 'delivered';

export default function AdminOrdersPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DeliveryStatus>('received');
  const [searchQuery, setSearchQuery] = useState('');

  // بارگذاری سفارشات
  useEffect(() => {
    const fetchOrders = async () => {
      if (authLoading) return;

      setIsLoading(true);
      try {
        const url = activeTab 
          ? `${API_ENDPOINTS.ORDERS.ADMIN.ALL}?deliveryStatus=${activeTab}`
          : API_ENDPOINTS.ORDERS.ADMIN.ALL;
        
        const response = await fetch(url, {
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
  }, [authLoading, activeTab]);

  // فیلتر کردن سفارشات بر اساس جستجو
  useEffect(() => {
    if (!searchQuery.trim()) {
      setOrders(allOrders);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const filtered = allOrders.filter(order => {
      const orderNumberMatch = order.orderNumber?.toLowerCase().includes(query);
      const phoneMatch = order.phoneNumber?.toLowerCase().includes(query);
      return orderNumberMatch || phoneMatch;
    });

    setOrders(filtered);
  }, [searchQuery, allOrders]);

  const formatPrice = (price: number, isCrypto: boolean = false): string => {
    const toman = isCrypto ? Math.floor(price / 10) : price;
    return new Intl.NumberFormat("fa-IR").format(toman);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
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

  const getDeliveryStatusText = (status: DeliveryStatus): string => {
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

  if (authLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="مدیریت سفارشات" onBack={() => router.push("/admin")} />
        <div className={styles.content}>
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <PageHeader title="مدیریت سفارشات" onBack={() => router.push("/admin")} />

      <div className={styles.content}>
        {/* Tabs */}
        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tab} ${activeTab === 'received' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('received')}
          >
            دریافت شده
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'processing' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('processing')}
          >
            در حال پردازش
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'delivered' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('delivered')}
          >
            تحویل شده
          </button>
        </div>

        {/* Search Field */}
        <div className={styles.searchContainer}>
          <div className={styles.searchInputWrapper}>
            <SearchIcon 
              width={18} 
              height={18} 
              className={styles.searchIcon}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس شماره سفارش یا شماره موبایل..."
              dir="rtl"
              className={styles.searchInput}
            />
          </div>
        </div>

        {/* Orders List */}
        <div className={styles.itemsContainer}>
          {isLoading ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>در حال بارگذاری...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg
                  width="64"
                  height="41"
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
              <p className={styles.emptyText}>هیچ سفارشی یافت نشد</p>
            </div>
          ) : (
            orders.map((order, index) => (
              <div key={order.id}>
                <div 
                  className={styles.listItem}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                >
                  <div className={styles.listItemStart}>
                    {order.imagePath ? (
                      <div className={styles.productImage}>
                        <img
                          src={`${API_BASE_URL}${order.imagePath}`}
                          alt={order.productName || ''}
                          className={styles.productImageImg}
                        />
                      </div>
                    ) : (
                      <div className={styles.productImagePlaceholder}>
                        <OrderIcon width={18} height={18} />
                      </div>
                    )}
                      <div className={styles.itemContent}>
                      <div className={styles.itemText}>
                        {order.productName || 'محصول نامشخص'}
                      </div>
                      <div className={styles.itemValue}>
                        {order.orderNumber} | {order.userName || 'کاربر نامشخص'}{order.phoneNumber ? ` | ${order.phoneNumber}` : ''} | {formatPrice(order.amount, order.paymentMethod === 'crypto')} تومان
                      </div>
                      <div className={styles.itemMeta}>
                        {getPaymentMethodText(order.paymentMethod)} | {getStatusText(order.status)}
                      </div>
                    </div>
                  </div>
                  <div className={styles.listItemEnd}>
                    <div className={styles.deliveryStatusBadge} data-status={order.deliveryStatus}>
                      {getDeliveryStatusText(order.deliveryStatus)}
                    </div>
                  </div>
                </div>
                {index < orders.length - 1 && (
                  <div className={styles.menuDivider}></div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
