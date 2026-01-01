"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./Login.module.css";
import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import { useAuth, useRedirectIfAuthenticated } from "@/hooks/useAuth";
import { getTelegramUser, isTelegramWebApp } from "@/utils/telegram";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  // Redirect اگر کاربر قبلاً لاگین کرده باشد
  useRedirectIfAuthenticated("/profile");
  const [phoneNumber, setPhoneNumber] = useState("09");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const hasAutoVerified = useRef(false);
  const hasAutoLoggedIn = useRef(false);

  // Auto login for Telegram Mini App users
  useEffect(() => {
    if (hasAutoLoggedIn.current) return;
    
    const autoLogin = async () => {
      if (!isTelegramWebApp()) return;
      
      const telegramUser = getTelegramUser();
      if (!telegramUser || !telegramUser.id) return;

      hasAutoLoggedIn.current = true;
      setIsLoading(true);

      try {
        const response = await fetch(API_ENDPOINTS.USERS.TELEGRAM_LOGIN, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            telegramUser: {
              id: telegramUser.id,
              first_name: telegramUser.first_name,
              last_name: telegramUser.last_name || "",
              username: telegramUser.username || null,
              language_code: telegramUser.language_code || null,
              is_premium: telegramUser.is_premium || false,
              photo_url: telegramUser.photo_url || null,
            },
          }),
        });

        const data = await response.json();

        if (data.status === 1 && data.data?.token) {
          // Login successful, save token and user data
          // Fetch user data from backend to get complete info
          const userResponse = await fetch(API_ENDPOINTS.USERS.ME, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${data.data.token}`,
              "Content-Type": "application/json",
            },
          });
          
          const userData = await userResponse.json();
          const user = {
            id: data.data.userId,
            phoneNumber: userData.data?.phoneNumber || "",
            userName: userData.data?.userName || telegramUser.username || telegramUser.first_name || undefined,
            userEmail: userData.data?.userEmail || undefined,
            isPremium: userData.data?.isPremium || telegramUser.is_premium || false,
            loginInfo: userData.data?.loginInfo || "telegramMiniApp",
          };
          
          setAuth(data.data.token, user);
          
          // Redirect to profile
          router.push("/profile");
        } else {
          // If auto login fails, allow manual login
          hasAutoLoggedIn.current = false;
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error in Telegram auto login:", err);
        // If auto login fails, allow manual login
        hasAutoLoggedIn.current = false;
        setIsLoading(false);
      }
    };

    autoLogin();
  }, [setAuth, router]);

  // Timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOTP = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/sms/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: phoneNumber,
        }),
      });

      const data = await response.json();

      if (data.status === 1) {
        setStep("otp");
        setOtpCode("");
        setResendTimer(120); // 2 minutes
        hasAutoVerified.current = false;
      } else {
        setError(data.message || "خطا در ارسال کد تایید");
      }
    } catch (err) {
      console.error("Error sending OTP:", err);
      setError("خطا در ارتباط با سرور");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/otp-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          otp: otpCode,
        }),
      });

      const data = await response.json();

      if (data.status === 1 && data.data?.token) {
        // Login successful, save token and user data
        const user = {
          id: data.data.userId,
          phoneNumber: phoneNumber,
          userName: undefined,
          userEmail: undefined,
          isPremium: false,
          loginInfo: "webSite",
        };
        
        setAuth(data.data.token, user);
        
        // Redirect to profile
        router.push("/profile");
      } else {
        setError(data.message || "کد تایید نامعتبر است");
        setOtpCode("");
        hasAutoVerified.current = false;
      }
    } catch (err) {
      console.error("Error verifying OTP:", err);
      setError("خطا در ارتباط با سرور");
      hasAutoVerified.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-verify when OTP code reaches 5 digits
  useEffect(() => {
    if (otpCode.length === 5 && step === "otp" && !isLoading && !hasAutoVerified.current) {
      hasAutoVerified.current = true;
      const timer = setTimeout(() => {
        handleVerifyOTP();
      }, 300);
      return () => clearTimeout(timer);
    } else if (otpCode.length < 5) {
      hasAutoVerified.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode, step, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === "phone") {
      const phoneRegex = /^09\d{9}$/;
      if (!phoneRegex.test(phoneNumber)) {
        setError("شماره موبایل نامعتبر است");
        return;
      }
      await handleSendOTP();
    } else {
      if (otpCode.length !== 5) {
        setError("کد تایید باید 5 رقم باشد");
        return;
      }
      await handleVerifyOTP();
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    await handleSendOTP();
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 11) {
      setPhoneNumber(value);
      setError(null);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 5) {
      setOtpCode(value);
      setError(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={styles.loginPage}>
      {/* Login Card */}
      <div className={styles.loginCard}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <div className={styles.logoContainer}>
            <Image
              src="/logo.webp"
              alt="وان ساب"
              width={29}
              height={29}
              className={styles.logo}
              priority
            />
          </div>
          <h1 className={styles.cardTitle}>به وان‌ساب، خوش آمدید</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          {step === "phone" ? (
            <>
              <div className={styles.inputContainer}>
                <label className={styles.instructionText}>
                  شماره موبایل خود را وارد کنید
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className={styles.phoneInput}
                  placeholder="09"
                  maxLength={11}
                  dir="ltr"
                />
              </div>

              {error && (
                <div style={{ color: "var(--error)", fontSize: "12px", textAlign: "start" }}>
                  {error}
                </div>
              )}

              <p className={styles.termsText}>
                با ادامه، شما با{" "}
                <a href="/terms" className={styles.termsLink}>
                  قوانین و مقررات
                </a>{" "}
                موافقت می‌کنید
              </p>

              <button
                type="submit"
                className={`${styles.submitButton} ${isLoading ? styles.loading : ""}`}
                disabled={phoneNumber.length < 11 || isLoading}
              >
                {isLoading ? "در حال ارسال..." : "ارسال کد تایید"}
              </button>
            </>
          ) : (
            <>
              <div className={styles.inputContainer}>
                <label className={styles.instructionText}>
                  کد تایید ارسال شده به {phoneNumber} را وارد کنید
                </label>
            <input
              type="tel"
                  value={otpCode}
                  onChange={handleOtpChange}
                  className={styles.phoneInput}
                  placeholder="12345"
                  maxLength={5}
                  dir="ltr"
                  autoFocus
            />
          </div>

              {error && (
                <div style={{ color: "var(--error)", fontSize: "12px", textAlign: "start" }}>
                  {error}
                </div>
              )}

              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={handleResend}
                  className={`${styles.submitButton} ${styles.resendButton}`}
                  disabled={resendTimer > 0 || isLoading}
                >
                  {resendTimer > 0 ? `ارسال مجدد (${formatTime(resendTimer)})` : "ارسال مجدد"}
                </button>
          <button
            type="submit"
                  className={`${styles.submitButton} ${isLoading ? styles.loading : ""}`}
                  disabled={otpCode.length < 5 || isLoading}
          >
                  {isLoading ? "در حال بررسی..." : "تایید"}
          </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
