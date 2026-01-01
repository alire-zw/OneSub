"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Notification from "@/components/Notification";
import CenterModal from "@/components/CenterModal";
import IdIcon from "@/components/icons/IdIcon";
import PhoneIcon from "@/components/icons/PhoneIcon";
import EmailIcon from "@/components/icons/EmailIcon";
import styles from "./ProfileInfo.module.css";
import { useRequireAuth, useAuth } from "@/hooks/useAuth";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import { isTelegramWebApp, getTelegramWebApp } from "@/utils/telegram";

export default function ProfileInfoPage() {
  const router = useRouter();
  const { isLoading: authLoading, user } = useRequireAuth("/login");
  const { logout, refreshUser } = useAuth();

  // State برای notification
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [isFullNameModalOpen, setIsFullNameModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [fullNameExists, setFullNameExists] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [mobileExists, setMobileExists] = useState(false);
  const [tempFullName, setTempFullName] = useState("");
  const [tempEmail, setTempEmail] = useState("");
  const [tempMobile, setTempMobile] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mobileStep, setMobileStep] = useState<"phone" | "verification">("phone");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const hasAutoVerified = useRef(false);

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

  // استفاده از user data از AuthContext (که از Redis cache می‌آید)
  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    // استفاده مستقیم از user data که از cache آمده
    setFullName(user.userName || "");
    setFullNameExists(!!user.userName);
    setEmail(user.userEmail || "");
    setEmailExists(!!user.userEmail);
    setMobile(user.phoneNumber || "");
    setMobileExists(!!user.phoneNumber);
  }, [authLoading, user]);

  // Timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

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

  const handleEditFullName = () => {
    setTempFullName(fullName);
    setIsFullNameModalOpen(true);
  };

  const handleEditEmail = () => {
    setTempEmail(email);
    setIsEmailModalOpen(true);
  };

  const handleEditMobile = () => {
    setTempMobile(mobile);
    setMobileStep("phone");
    setVerificationCode("");
    setResendTimer(0);
    hasAutoVerified.current = false;
    setIsMobileModalOpen(true);
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d]/g, "");
    if (value.length > 11) {
      value = value.slice(0, 11);
    }
    setTempMobile(value);
  };

  const handleVerificationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d]/g, "");
    if (value.length > 5) {
      value = value.slice(0, 5);
    }
    setVerificationCode(value);
  };

  // Auto-verify وقتی 5 رقم وارد شد
  useEffect(() => {
    if (verificationCode.length === 5 && mobileStep === "verification" && !isLoading && !hasAutoVerified.current) {
      hasAutoVerified.current = true;
      handleVerifyCode();
    }
    if (verificationCode.length < 5) {
      hasAutoVerified.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationCode, mobileStep, isLoading]);

  const handleSaveFullName = async () => {
    if (!tempFullName.trim()) {
      showNotification("لطفاً نام کامل خود را وارد کنید", "error");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.USERS.UPDATE_PROFILE, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userName: tempFullName.trim(),
        }),
      });

      const data = await response.json();

      if (data.status === 1) {
        setFullName(tempFullName.trim());
        setFullNameExists(true);
        setIsFullNameModalOpen(false);
        showNotification("نام کامل با موفقیت به‌روزرسانی شد", "success");
        // Refresh user cache in context
        await refreshUser();
      } else {
        showNotification(data.message || "خطا در به‌روزرسانی نام کامل", "error");
      }
    } catch (error) {
      console.error("Error updating full name:", error);
      showNotification("خطا در ارتباط با سرور", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!tempEmail.trim()) {
      showNotification("لطفاً ایمیل خود را وارد کنید", "error");
      return;
    }

    if (!isValidEmail(tempEmail)) {
      showNotification("لطفاً یک ایمیل معتبر وارد کنید", "error");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.USERS.UPDATE_PROFILE, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userEmail: tempEmail.trim(),
        }),
      });

      const data = await response.json();

      if (data.status === 1) {
        setEmail(tempEmail.trim());
        setEmailExists(true);
        setIsEmailModalOpen(false);
        showNotification("ایمیل با موفقیت به‌روزرسانی شد", "success");
        // Refresh user cache in context
        await refreshUser();
      } else {
        showNotification(data.message || "خطا در به‌روزرسانی ایمیل", "error");
      }
    } catch (error) {
      console.error("Error updating email:", error);
      showNotification("خطا در ارتباط با سرور", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ارسال کد تایید به شماره موبایل
  const handleSendVerificationCode = async () => {
    if (!tempMobile.trim()) {
      showNotification("لطفاً شماره موبایل خود را وارد کنید", "error");
      return;
    }

    if (!isValidPhone(tempMobile)) {
      showNotification("لطفاً یک شماره موبایل معتبر وارد کنید (مثال: 09123456789)", "error");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/sms/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: tempMobile,
        }),
      });

      const data = await response.json();

      if (data.status === 1) {
        setMobileStep("verification");
        setVerificationCode("");
        setResendTimer(120);
        hasAutoVerified.current = false;
        showNotification("کد تایید به شماره موبایل شما ارسال شد", "success");
      } else {
        showNotification(data.message || "خطا در ارسال کد تایید", "error");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      showNotification("خطا در ارتباط با سرور", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // تایید کد و ذخیره شماره موبایل
  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 5) {
      showNotification("لطفاً کد تایید 5 رقمی را وارد کنید", "error");
      return;
    }

    setIsLoading(true);
    try {
      // تایید OTP
      const verifyResponse = await fetch(`${API_BASE_URL}/api/users/otp-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: tempMobile,
          otp: verificationCode,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (verifyData.status === 1) {
        // به‌روزرسانی شماره در دیتابیس
        const updateResponse = await fetch(API_ENDPOINTS.USERS.UPDATE_PROFILE, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            phoneNumber: tempMobile,
          }),
        });

        const updateData = await updateResponse.json();

        if (updateData.status === 1) {
          setMobile(tempMobile);
          setMobileExists(true);
          setIsMobileModalOpen(false);
          setMobileStep("phone");
          setVerificationCode("");
          showNotification("شماره موبایل با موفقیت به‌روزرسانی شد", "success");
          // Refresh user cache in context
          await refreshUser();
        } else {
          showNotification(updateData.message || "خطا در به‌روزرسانی شماره موبایل", "error");
        }
      } else {
        showNotification(verifyData.message || "کد تایید اشتباه است", "error");
        hasAutoVerified.current = false;
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      showNotification("خطا در ارتباط با سرور", "error");
      hasAutoVerified.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  // تابع برای تغییر شماره موبایل (بازگشت به مرحله اول)
  const handleChangeNumber = () => {
    setMobileStep("phone");
    setVerificationCode("");
    setResendTimer(0);
    hasAutoVerified.current = false;
  };

  // تابع فرمت کردن تایمر به mm:ss
  const formatTimer = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleCancelFullName = () => {
    setIsFullNameModalOpen(false);
    setTempFullName("");
  };

  const handleCancelEmail = () => {
    setIsEmailModalOpen(false);
    setTempEmail("");
  };

  const handleCancelMobile = () => {
    setIsMobileModalOpen(false);
    setTempMobile("");
    setMobileStep("phone");
    setVerificationCode("");
    setResendTimer(0);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <PageHeader title="اطلاعات حساب" onBack={() => router.back()} />

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>اطلاعات پروفایل</h3>

          <div className={styles.itemsContainer}>
            {authLoading ? (
              <>
                {/* Skeleton Loader - نام کامل */}
                <div className={styles.listItem}>
                  <div className={styles.listItemStart}>
                    <span className={styles.editIcon}>
                      <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                    </span>
                    <div className={styles.itemContent}>
                      <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '80px', marginBottom: '4px' }}></div>
                      <div className={`${styles.skeleton} ${styles.skeletonTextSmall}`} style={{ width: '120px' }}></div>
                    </div>
                  </div>
                  <div className={styles.listItemEnd}>
                    <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
                  </div>
                </div>
                <div className={styles.menuDivider}></div>

                {/* Skeleton Loader - شماره موبایل */}
                <div className={styles.listItem}>
                  <div className={styles.listItemStart}>
                    <span className={styles.editIcon}>
                      <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                    </span>
                    <div className={styles.itemContent}>
                      <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '90px', marginBottom: '4px' }}></div>
                      <div className={`${styles.skeleton} ${styles.skeletonTextSmall}`} style={{ width: '100px' }}></div>
                    </div>
                  </div>
                  <div className={styles.listItemEnd}>
                    <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
                  </div>
                </div>
                <div className={styles.menuDivider}></div>

                {/* Skeleton Loader - ایمیل */}
                <div className={styles.listItem}>
                  <div className={styles.listItemStart}>
                    <span className={styles.editIcon}>
                      <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                    </span>
                    <div className={styles.itemContent}>
                      <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '50px', marginBottom: '4px' }}></div>
                      <div className={`${styles.skeleton} ${styles.skeletonTextSmall}`} style={{ width: '140px' }}></div>
                    </div>
                  </div>
                  <div className={styles.listItemEnd}>
                    <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* نام کامل */}
            <div className={styles.listItem}>
              <div className={styles.listItemStart}>
                <span className={styles.editIcon}>
                  <IdIcon width={18} height={18} />
                </span>
                <div className={styles.itemContent}>
                  <div className={styles.itemText}>نام کامل</div>
                  <div className={styles.itemValue}>{fullName || "--"}</div>
                </div>
              </div>

              <div className={styles.listItemEnd}>
                <button className={styles.editButton} onClick={handleEditFullName}>
                  {fullNameExists ? "ویرایش" : "افزودن"}
                </button>
              </div>
            </div>

            <div className={styles.menuDivider}></div>

            {/* شماره موبایل */}
            <div className={styles.listItem}>
              <div className={styles.listItemStart}>
                <span className={styles.editIcon}>
                  <PhoneIcon width={18} height={18} />
                </span>
                <div className={styles.itemContent}>
                  <div className={styles.itemText}>شماره موبایل</div>
                  <div className={styles.itemValue}>{mobile || "--"}</div>
                </div>
              </div>

              <div className={styles.listItemEnd}>
                <button className={styles.editButton} onClick={handleEditMobile}>
                  {mobileExists ? "ویرایش" : "افزودن"}
                </button>
              </div>
            </div>

            <div className={styles.menuDivider}></div>

            {/* ایمیل */}
            <div className={styles.listItem}>
              <div className={styles.listItemStart}>
                <span className={styles.editIcon}>
                  <EmailIcon width={18} height={18} />
                </span>
                <div className={styles.itemContent}>
                  <div className={styles.itemText}>ایمیل</div>
                  <div className={styles.itemValue}>{email || "--"}</div>
                </div>
              </div>

              <div className={styles.listItemEnd}>
                <button className={styles.editButton} onClick={handleEditEmail}>
                  {emailExists ? "ویرایش" : "افزودن"}
                </button>
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notification */}
      <Notification show={notification.show} message={notification.message} type={notification.type} onClose={hideNotification} />

      {/* Full Name Modal */}
      <CenterModal
        isOpen={isFullNameModalOpen}
        onClose={handleCancelFullName}
        title={fullNameExists ? "ویرایش نام کامل" : "افزودن نام کامل"}
        description="نام کامل خود را وارد کنید"
        buttons={[
          {
            label: "لغو",
            onClick: handleCancelFullName,
            variant: "default",
          },
          {
            label: "ذخیره",
            onClick: handleSaveFullName,
            variant: "primary",
            disabled: isLoading || !tempFullName.trim(),
          },
        ]}
      >
        <div className={styles.modalContent}>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              value={tempFullName}
              onChange={(e) => setTempFullName(e.target.value)}
              className={styles.modalInput}
              placeholder="نام کامل"
              dir="rtl"
            />
            <div className={styles.inputIcon}>
              <IdIcon width={16} height={16} />
            </div>
          </div>
        </div>
      </CenterModal>

      {/* Email Modal */}
      <CenterModal
        isOpen={isEmailModalOpen}
        onClose={handleCancelEmail}
        title={emailExists ? "ویرایش ایمیل" : "افزودن ایمیل"}
        description="ایمیل خود را وارد کنید"
        buttons={[
          {
            label: "لغو",
            onClick: handleCancelEmail,
            variant: "default",
          },
          {
            label: "ذخیره",
            onClick: handleSaveEmail,
            variant: "primary",
            disabled: isLoading || !tempEmail.trim() || !isValidEmail(tempEmail),
          },
        ]}
      >
        <div className={styles.modalContent}>
          <div className={styles.inputWrapper}>
            <input
              type="email"
              value={tempEmail}
              onChange={(e) => setTempEmail(e.target.value)}
              className={styles.modalInput}
              placeholder="example@email.com"
            />
            <div className={styles.inputIcon}>
              <EmailIcon width={16} height={16} />
            </div>
          </div>
        </div>
      </CenterModal>

      {/* Mobile Modal */}
      <CenterModal
        isOpen={isMobileModalOpen}
        onClose={handleCancelMobile}
        title={mobileStep === "phone" ? (mobileExists ? "ویرایش شماره موبایل" : "افزودن شماره موبایل") : "تایید شماره موبایل"}
        description={mobileStep === "phone" ? "شماره موبایل خود را وارد کنید" : `کد تایید 5 رقمی ارسال شده به شماره ${tempMobile} را وارد کنید.`}
        buttons={
          mobileStep === "phone"
            ? [
                {
                  label: "لغو",
                  onClick: handleCancelMobile,
                  variant: "default",
                },
                {
                  label: "ارسال کد تایید",
                  onClick: handleSendVerificationCode,
                  variant: "primary",
                  disabled: isLoading || !tempMobile.trim() || !isValidPhone(tempMobile),
                },
              ]
            : [
                {
                  label: "تغییر شماره",
                  onClick: handleChangeNumber,
                  variant: "default",
                },
                {
                  label: resendTimer > 0 ? `ارسال مجدد (${formatTimer(resendTimer)})` : "ارسال مجدد",
                  onClick: handleSendVerificationCode,
                  variant: "default",
                  disabled: resendTimer > 0 || isLoading,
                },
              ]
        }
      >
        <div className={styles.modalContent}>
          {mobileStep === "phone" ? (
            <div className={styles.inputWrapper}>
              <input
                type="tel"
                value={tempMobile}
                onChange={handleMobileChange}
                className={styles.modalInput}
                placeholder="09123456789"
                maxLength={11}
                pattern="[0-9]*"
                inputMode="numeric"
              />
              <div className={styles.inputIcon}>
                <PhoneIcon width={16} height={16} />
              </div>
            </div>
          ) : (
            <div className={styles.inputWrapper}>
              <input
                type="tel"
                value={verificationCode}
                onChange={handleVerificationCodeChange}
                className={styles.modalInput}
                placeholder="کد 5 رقمی"
                maxLength={5}
                pattern="[0-9]*"
                inputMode="numeric"
              />
              <div className={styles.inputIcon}>
                <PhoneIcon width={16} height={16} />
              </div>
            </div>
          )}
        </div>
      </CenterModal>
    </div>
  );
}

