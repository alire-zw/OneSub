"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Notification from "@/components/Notification";
import styles from "./Cooperation.module.css";
import { useRequireAuth, useAuth } from "@/hooks/useAuth";
import { isTelegramWebApp, getTelegramWebApp } from "@/utils/telegram";
import { API_ENDPOINTS, getAuthHeaders } from "@/config/api";

export default function CooperationPage() {
  const router = useRouter();
  const { isLoading: authLoading, user } = useRequireAuth("/login");
  const { refreshUser } = useAuth();

  // State برای notification
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  // State برای فرم درخواست همکاری
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<{
    status: 'none' | 'pending' | 'approved' | 'rejected';
    message: string;
    rejectionReason?: string;
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // بررسی وضعیت درخواست
  useEffect(() => {
    const checkStatus = async () => {
      if (authLoading || !user) return;

      setIsLoadingStatus(true);
      try {
        const response = await fetch(API_ENDPOINTS.MERCHANTS.STATUS, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }

        const data = await response.json();
        if (data.success) {
          setRequestStatus({
            status: data.status,
            message: data.message,
            rejectionReason: data.rejectionReason || undefined,
          });
        }
      } catch (error) {
        console.error('Error checking request status:', error);
      } finally {
        setIsLoadingStatus(false);
      }
    };

    checkStatus();
  }, [authLoading, user]);

  // نمایش دکمه Back تلگرام در Mini App
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const webApp = getTelegramWebApp();
    if (!webApp || !isTelegramWebApp()) return;

    // نمایش دکمه Back
    if (webApp.BackButton && typeof webApp.BackButton.show === "function") {
      webApp.BackButton.show();
    }

    // Handler برای کلیک روی دکمه Back
    const handleBackClick = () => {
      router.back();
    };

    if (webApp.BackButton && typeof webApp.BackButton.onClick === "function") {
      webApp.BackButton.onClick(handleBackClick);
    }

    // Cleanup: مخفی کردن دکمه Back وقتی component unmount می‌شود
    return () => {
      if (webApp.BackButton && typeof webApp.BackButton.hide === "function") {
        webApp.BackButton.hide();
      }
      if (webApp.BackButton && typeof webApp.BackButton.offClick === "function") {
        webApp.BackButton.offClick(handleBackClick);
      }
    };
  }, [router]);

  // توابع notification
  const showNotification = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification((prev) => ({ ...prev, show: false })), 3000);
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }));
  };

  // تابع اعتبارسنجی ایمیل
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // تابع اعتبارسنجی شماره موبایل
  const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^09\d{9}$/;
    const cleanPhone = phone.trim().replace(/\s/g, "");
    return phoneRegex.test(cleanPhone) && cleanPhone.length === 11;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === "phone") {
      // فقط عدد برای شماره موبایل
      const numbers = value.replace(/\D/g, "");
      if (numbers.length <= 11) {
        setFormData((prev) => ({
          ...prev,
          [name]: numbers,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      showNotification("لطفاً نام و نام خانوادگی خود را وارد کنید", "error");
      return;
    }

    if (!formData.email.trim()) {
      showNotification("لطفاً ایمیل خود را وارد کنید", "error");
      return;
    }

    if (!isValidEmail(formData.email)) {
      showNotification("لطفاً یک ایمیل معتبر وارد کنید", "error");
      return;
    }

    if (!formData.phone.trim()) {
      showNotification("لطفاً شماره موبایل خود را وارد کنید", "error");
      return;
    }

    if (!isValidPhone(formData.phone)) {
      showNotification("لطفاً یک شماره موبایل معتبر وارد کنید (مثال: 09123456789)", "error");
      return;
    }

    if (!formData.message.trim()) {
      showNotification("لطفاً پیام خود را وارد کنید", "error");
      return;
    }

    if (formData.message.trim().length < 10) {
      showNotification("پیام شما باید حداقل 10 کاراکتر باشد", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(API_ENDPOINTS.MERCHANTS.REQUEST, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          message: formData.message.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        showNotification(data.message || "درخواست شما با موفقیت ثبت شد و در حال بررسی است. پس از تایید به شما بصورت پیامک اعلام خواهد شد.", "success");
        
        // پاک کردن فرم
        setFormData({
          name: "",
          email: "",
          phone: "",
          message: "",
        });

        // به‌روزرسانی وضعیت
        setRequestStatus({
          status: 'pending',
          message: 'درخواست شما در حال بررسی است',
        });
      } else {
        showNotification(data.message || "خطا در ارسال درخواست. لطفاً دوباره تلاش کنید.", "error");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      showNotification("خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // اگر کاربر همکار است
  if (user?.role?.toLowerCase() === 'merchants') {
    return (
      <div className={styles.container}>
        <PageHeader title="همکاری با ما" onBack={() => router.back()} />
        <div className={styles.content}>
          <div className={styles.statusBox}>
            <div className={styles.statusIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="var(--primary)"/>
              </svg>
            </div>
            <h3 className={styles.statusTitle}>شما در حال حاضر همکار هستید</h3>
            <p className={styles.statusText}>
              شما به عنوان همکار تایید شده‌اید و می‌توانید از قیمت‌های همکار استفاده کنید.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || isLoadingStatus) {
    return (
      <div className={styles.container}>
        <PageHeader title="همکاری با ما" onBack={() => router.back()} />
        <div className={styles.content}>
          <div className={styles.formContainer}>
            <p>در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    );
  }

  // اگر درخواست pending است
  if (requestStatus?.status === 'pending') {
    return (
      <div className={styles.container}>
        <PageHeader title="همکاری با ما" onBack={() => router.back()} />
        <div className={styles.content}>
          <div className={styles.statusBox}>
            <div className={styles.statusIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="var(--warning)"/>
              </svg>
            </div>
            <h3 className={styles.statusTitle}>درخواست شما در حال بررسی است</h3>
            <p className={styles.statusText}>
              درخواست همکاری شما ثبت شده و در حال بررسی است. پس از تایید به شما بصورت پیامک اعلام خواهد شد.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // اگر درخواست rejected است - فرم را نمایش می‌دهیم تا بتواند دوباره درخواست بدهد
  // (فرم در پایین نمایش داده می‌شود)

  return (
    <div className={styles.container}>
      <PageHeader title="همکاری با ما" onBack={() => router.back()} />
      <div className={styles.content}>
        {/* نمایش پیام رد درخواست */}
        {requestStatus?.status === 'rejected' && (
          <div className={styles.statusBox} style={{ marginBottom: '24px' }}>
            <div className={styles.statusIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="var(--error)"/>
              </svg>
            </div>
            <h3 className={styles.statusTitle}>درخواست قبلی شما رد شده است</h3>
            {requestStatus.rejectionReason && (
              <div className={styles.rejectionReason}>
                <strong>دلیل رد:</strong>
                <p>{requestStatus.rejectionReason}</p>
              </div>
            )}
            <p className={styles.statusText}>
              می‌توانید دوباره درخواست همکاری ثبت کنید.
            </p>
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* نام و نام خانوادگی */}
          <div className={styles.formGroup}>
            <label className={styles.label}>نام و نام خانوادگی *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="نام و نام خانوادگی"
              required
              dir="rtl"
            />
          </div>

          {/* ایمیل */}
          <div className={styles.formGroup}>
            <label className={styles.label}>ایمیل *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="example@email.com"
              required
            />
          </div>

          {/* شماره موبایل */}
          <div className={styles.formGroup}>
            <label className={styles.label}>شماره موبایل *</label>
            <input
              type="text"
              inputMode="numeric"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="09123456789"
              maxLength={11}
              required
            />
          </div>

          {/* پیام */}
          <div className={styles.formGroup}>
            <label className={styles.label}>پیام *</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              className={styles.textarea}
              placeholder="لطفاً توضیح دهید که چگونه می‌توانید با ما همکاری کنید..."
              rows={5}
              required
              dir="rtl"
            />
          </div>

          {/* دکمه‌های فرم */}
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={() => router.back()}
              className={styles.cancelButton}
              disabled={isSubmitting}
            >
              انصراف
            </button>
            <button 
              type="submit" 
              className={styles.submitButton} 
              disabled={
                isSubmitting ||
                !formData.name.trim() ||
                !formData.email.trim() ||
                !isValidEmail(formData.email) ||
                !formData.phone.trim() ||
                !isValidPhone(formData.phone) ||
                !formData.message.trim() ||
                formData.message.trim().length < 10
              }
            >
              {isSubmitting ? "در حال ارسال..." : "ارسال درخواست"}
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
