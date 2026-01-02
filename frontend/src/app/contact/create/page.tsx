"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import PageHeader from "@/components/PageHeader";
import styles from "./page.module.css";
import Notification from "@/components/Notification";
import Image from "next/image";

interface Order {
  id: number;
  orderNumber: string;
  productName: string;
  productImagePath: string | null;
  category: string;
  createdAt: string;
  deliveryStatus: string;
}

export default function CreateTicketPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  const [formData, setFormData] = useState({
    type: "sales" as "sales" | "technical" | "product_support",
    subject: "",
    message: "",
    orderId: "",
    orderNumber: "",
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrdersList, setShowOrdersList] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (authLoading) return;

      setIsLoadingOrders(true);
      try {
        const response = await fetch(API_ENDPOINTS.TICKETS.MY_ORDERS, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch orders");
        }

        const data = await response.json();
        if (data.status === 1 && data.data) {
          setOrders(data.data);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setIsLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [authLoading]);

  const showNotification = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // اگر نوع تغییر کرد، orderId و orderNumber را پاک کن
      ...(name === "type" && value !== "product_support" ? { orderId: "", orderNumber: "" } : {}),
    }));
    
    // اگر نوع تغییر کرد، انتخاب سفارش را پاک کن
    if (name === "type" && value !== "product_support") {
      setSelectedOrder(null);
      setShowOrdersList(true);
    }
  };

  const handleOrderSelect = (order: Order) => {
    setFormData((prev) => ({
      ...prev,
      orderId: order.id.toString(),
      orderNumber: order.orderNumber,
    }));
    setSelectedOrder(order);
    setShowOrdersList(false);
  };

  const handleChangeOrder = () => {
    setShowOrdersList(true);
    setSelectedOrder(null);
    setFormData((prev) => ({
      ...prev,
      orderId: "",
      orderNumber: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject.trim()) {
      showNotification("لطفاً موضوع تیکت را وارد کنید", "error");
      return;
    }

    if (!formData.message.trim()) {
      showNotification("لطفاً پیام خود را وارد کنید", "error");
      return;
    }

    if (formData.type === "product_support" && !formData.orderId && !formData.orderNumber) {
      showNotification("لطفاً سفارش مربوطه را انتخاب کنید", "error");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.TICKETS.CREATE, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type: formData.type,
          subject: formData.subject,
          message: formData.message,
          ...(formData.type === "product_support" && {
            orderId: formData.orderId ? parseInt(formData.orderId) : null,
            orderNumber: formData.orderNumber || null,
          }),
        }),
      });

      const data = await response.json();

      if (data.status === 1) {
        showNotification("تیکت با موفقیت ایجاد شد", "success");
        setTimeout(() => {
          router.push("/contact");
        }, 1000);
      } else {
        showNotification(data.message || "خطا در ایجاد تیکت", "error");
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      showNotification("خطا در ارتباط با سرور", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case "sales":
        return "فروش";
      case "technical":
        return "فنی";
      case "product_support":
        return "پشتیبانی محصول";
      default:
        return type;
    }
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="ایجاد تیکت جدید" onBack={() => router.push("/contact")} />
        <div className={styles.content}>
          <div className={styles.formContainer}>
            <p>در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <PageHeader title="ایجاد تیکت جدید" onBack={() => router.push("/contact")} />

      <div className={styles.content}>
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* نوع تیکت */}
          <div className={styles.formGroup}>
            <label className={styles.label}>نوع تیکت *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className={styles.select}
              required
            >
              <option value="sales">فروش</option>
              <option value="technical">فنی</option>
              <option value="product_support">پشتیبانی محصول</option>
            </select>
          </div>

          {/* انتخاب سفارش برای پشتیبانی محصول */}
          {formData.type === "product_support" && (
            <div className={styles.formGroup}>
              <label className={styles.label}>سفارش مربوطه *</label>
              {isLoadingOrders ? (
                <div className={styles.loadingText}>در حال بارگذاری سفارش‌ها...</div>
              ) : orders.length === 0 ? (
                <div className={styles.emptyOrders}>
                  <p>شما هنوز سفارشی ثبت نکرده‌اید</p>
                </div>
              ) : selectedOrder && !showOrdersList ? (
                <div className={styles.selectedOrderDisplay}>
                  <div className={styles.selectedOrderContent}>
                    {selectedOrder.productImagePath ? (
                      <div className={styles.selectedOrderImage}>
                        <Image
                          src={`${API_BASE_URL}${selectedOrder.productImagePath}`}
                          alt={selectedOrder.productName}
                          width={40}
                          height={40}
                          className={styles.selectedOrderImageImg}
                        />
                      </div>
                    ) : (
                      <div className={styles.selectedOrderImagePlaceholder}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </div>
                    )}
                    <div className={styles.selectedOrderInfo}>
                      <div className={styles.selectedOrderName}>{selectedOrder.productName}</div>
                      <div className={styles.selectedOrderNumber}>شماره سفارش: {selectedOrder.orderNumber}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.changeOrderButton}
                    onClick={handleChangeOrder}
                  >
                    تغییر
                  </button>
                </div>
              ) : (
                <div className={styles.ordersList}>
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className={styles.orderItem}
                      onClick={() => handleOrderSelect(order)}
                    >
                      <div className={styles.orderItemStart}>
                        {order.productImagePath ? (
                          <div className={styles.orderImage}>
                            <Image
                              src={`${API_BASE_URL}${order.productImagePath}`}
                              alt={order.productName}
                              width={48}
                              height={48}
                              className={styles.orderImageImg}
                            />
                          </div>
                        ) : (
                          <div className={styles.orderImagePlaceholder}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                              <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                          </div>
                        )}
                        <div className={styles.orderContent}>
                          <div className={styles.orderName}>{order.productName}</div>
                          <div className={styles.orderNumber}>شماره سفارش: {order.orderNumber}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* موضوع */}
          <div className={styles.formGroup}>
            <label className={styles.label}>موضوع *</label>
            <input
              type="text"
              name="subject"
              className={styles.input}
              placeholder="موضوع تیکت را وارد کنید"
              value={formData.subject}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* پیام */}
          <div className={styles.formGroup}>
            <label className={styles.label}>پیام *</label>
            <textarea
              name="message"
              className={styles.textarea}
              placeholder="پیام خود را وارد کنید"
              rows={8}
              value={formData.message}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* دکمه‌های فرم */}
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={() => router.push("/contact")}
              className={styles.cancelButton}
              disabled={isLoading}
            >
              انصراف
            </button>
            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? "در حال ایجاد..." : "ایجاد تیکت"}
            </button>
          </div>
        </form>
      </div>

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />
    </div>
  );
}

