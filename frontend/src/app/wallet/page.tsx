"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import { isTelegramWebApp, getTelegramWebApp } from "@/utils/telegram";
import MoneyBagIcon from "@/components/icons/MoneyBagIcon";
import DepositMoneyIcon from "@/components/icons/DepositMoneyIcon";
import DepositCryptoIcon from "@/components/icons/DepositCryptoIcon";
import BankCardIcon from "@/components/icons/BankCardIcon";
import SuccessIcon from "@/components/icons/SuccessIcon";
import PaymentFailedIcon from "@/components/icons/PaymentFailedIcon";
import AlertSquareIcon from "@/components/icons/AlertSquareIcon";
import CenterModal from "@/components/CenterModal";
import styles from "./Wallet.module.css";

function WalletContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [chargeAmount, setChargeAmount] = useState<string>("");
  const [chargePaymentMethod, setChargePaymentMethod] = useState<string>("online");
  const [isProcessingCharge, setIsProcessingCharge] = useState(false);
  const [hasBankCard, setHasBankCard] = useState<boolean | null>(null);
  const [isCardToCardModalOpen, setIsCardToCardModalOpen] = useState(false);
  const [isNoCardModalOpen, setIsNoCardModalOpen] = useState(false);
  const [shabaCopied, setShabaCopied] = useState(false);
  const [status, setStatus] = useState<"success" | "failed" | "normal" | "loading">("normal");
  
  // دریافت اطلاعات از env
  const shabaNumber = process.env.NEXT_PUBLIC_SHIBA_NUMBER || "";
  const accountHolderName = process.env.NEXT_PUBLIC_ACCOUNT_HOLDER_NAME || "";
  const [statusData, setStatusData] = useState<{
    trackId?: string;
    amount?: number;
    paidAt?: string;
    expired?: boolean;
    paymentType?: string;
  } | null>(null);

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

  // بررسی وضعیت پرداخت از URL params
  useEffect(() => {
    const success = searchParams.get("success");
    const trackId = searchParams.get("trackId");
    const amount = searchParams.get("amount");
    const paidAt = searchParams.get("paidAt");
    const expired = searchParams.get("expired");
    const paymentType = searchParams.get("paymentType");

    if (success === "1") {
      setStatus("success");
      setStatusData({
        trackId: trackId || undefined,
        amount: amount ? parseInt(amount) : undefined,
        paidAt: paidAt ? decodeURIComponent(paidAt) : undefined,
        paymentType: paymentType || undefined,
      });
    } else if (success === "0") {
      setStatus("failed");
      setStatusData({
        trackId: trackId || undefined,
        expired: expired === "1",
        paymentType: paymentType || undefined,
      });
    } else {
      setStatus("normal");
    }
  }, [searchParams]);

  // دریافت موجودی کیف پول
  useEffect(() => {
    const fetchBalance = async () => {
      if (authLoading) return;

      setWalletLoading(true);
      try {
        const response = await fetch(API_ENDPOINTS.WALLET.BALANCE, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 1 && data.data) {
            // موجودی در Rial است، به تومان تبدیل می‌کنیم
            setWalletBalance(Math.floor((data.data.balance || 0) / 10));
          }
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
      } finally {
        setWalletLoading(false);
      }
    };

    fetchBalance();
  }, [authLoading]);

  // تابع helper برای بررسی وجود کارت بانکی
  const checkBankCard = async () => {
    if (authLoading) return;

    try {
      const response = await fetch(API_ENDPOINTS.CARDS.LIST, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[Wallet] Cards API response:", data);
        if (data.success && data.cards) {
          const hasCard = Array.isArray(data.cards) && data.cards.length > 0;
          console.log("[Wallet] Has bank card:", hasCard, "Cards count:", data.cards.length);
          setHasBankCard(hasCard);
        } else {
          console.log("[Wallet] No cards found in response");
          setHasBankCard(false);
        }
      } else {
        console.log("[Wallet] Cards API response not ok:", response.status);
        setHasBankCard(false);
      }
    } catch (error) {
      console.error("[Wallet] Error fetching bank cards:", error);
      setHasBankCard(false);
    }
  };

  // بررسی وجود کارت بانکی
  useEffect(() => {
    checkBankCard();

    // وقتی صفحه focus می‌شود (مثلاً بعد از بازگشت از صفحه کارت‌ها)، دوباره چک کن
    const handleFocus = () => {
      checkBankCard();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkBankCard();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authLoading]);

  // تابع فرمت کردن تاریخ (برای نمایش نتیجه پرداخت)
  const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
    const persianDate = new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      }).format(date);
      return persianDate;
  };

  // تابع فرمت کردن مبلغ
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price);
  };

  // تابع فرمت کردن عدد با جداکننده هزارگان
  const formatNumberWithSeparator = (value: string): string => {
    if (!value) return "";
    // حذف همه کاراکترهای غیر عددی
    const numericValue = value.replace(/[^\d]/g, "");
    if (!numericValue) return "";
    // فرمت با جداکننده هزارگان (انگلیسی)
    return new Intl.NumberFormat('en-US').format(parseInt(numericValue));
  };

  // تابع تبدیل مقدار فرمت شده به عدد خالص
  const parseFormattedNumber = (value: string): string => {
    // حذف همه کاراکترهای غیر عددی (شامل جداکننده‌های هزارگان)
    return value.replace(/[^\d]/g, "");
  };

  // تابع کپی کردن شبا
  const copyShabaToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shabaNumber);
      setShabaCopied(true);
      setTimeout(() => setShabaCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // تابع هدایت به صفحه شارژ (برای دکمه قدیمی)
  const handleCharge = () => {
    router.push("/profile/charge");
  };

  // تابع پردازش شارژ
  const handleProcessCharge = async () => {
    const numericAmount = parseFormattedNumber(chargeAmount);
    const amount = parseFloat(numericAmount || "0");
    
    // بررسی حداقل مبلغ بر اساس روش پرداخت
    const minAmount = chargePaymentMethod === "crypto" ? 30000 : 1000;
    
    if (!numericAmount || amount < minAmount) {
      const methodName = chargePaymentMethod === "crypto" ? "ارز دیجیتال" : chargePaymentMethod === "online" ? "درگاه پرداخت آنلاین" : "کارت به کارت";
      alert(`حداقل مبلغ شارژ برای پرداخت ${methodName} ${minAmount.toLocaleString('fa-IR')} تومان است`);
      return;
    }
    
    if (amount > 100000000) {
      alert("حداکثر مبلغ شارژ ۱۰۰,۰۰۰,۰۰۰ تومان است");
      return;
    }

    if (chargePaymentMethod === "online") {
      // شارژ با درگاه پرداخت آنلاین (زیبال)
      setIsProcessingCharge(true);
      try {
        const response = await fetch(API_ENDPOINTS.WALLET.CHARGE, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            amount: amount,
          }),
        });

        const data = await response.json();

        if (data.status === 1 && data.data) {
          // هدایت به درگاه پرداخت (در همان تب فعلی)
          if (data.data.paymentUrl) {
            // استفاده از window.location.replace برای جلوگیری از باز شدن تب جدید
            window.location.replace(data.data.paymentUrl);
          } else {
            alert("خطا در دریافت لینک پرداخت");
            setIsProcessingCharge(false);
          }
        } else {
          alert(data.message || "خطا در ایجاد درخواست پرداخت");
          setIsProcessingCharge(false);
        }
      } catch (error) {
        console.error("Error processing charge:", error);
        alert("خطا در اتصال به سرور");
        setIsProcessingCharge(false);
      }
      } else if (chargePaymentMethod === "card") {
        // بررسی وجود کارت بانکی - همیشه دوباره چک کن برای اطمینان
        const checkAndProceed = async () => {
          try {
            const response = await fetch(API_ENDPOINTS.CARDS.LIST, {
              headers: getAuthHeaders(),
            });

            if (response.ok) {
              const data = await response.json();
              console.log("[Wallet] Card payment - API response:", data);
              if (data.success && data.cards && Array.isArray(data.cards) && data.cards.length > 0) {
                console.log("[Wallet] Card found, opening card-to-card modal");
                setHasBankCard(true);
                setIsProcessingCharge(false);
                setIsCardToCardModalOpen(true);
              } else {
                console.log("[Wallet] No card found, opening no-card modal");
                setHasBankCard(false);
                setIsProcessingCharge(false);
                setIsNoCardModalOpen(true);
              }
            } else {
              console.log("[Wallet] Cards API response not ok:", response.status);
              setHasBankCard(false);
              setIsProcessingCharge(false);
              setIsNoCardModalOpen(true);
            }
          } catch (error) {
            console.error("Error fetching bank cards:", error);
            setHasBankCard(false);
            setIsNoCardModalOpen(true);
          }
        };
        
        checkAndProceed();
    } else if (chargePaymentMethod === "crypto") {
      // شارژ با ارز دیجیتال (ترون)
      setIsProcessingCharge(true);
      try {
        const response = await fetch(API_ENDPOINTS.CRYPTO.TRON_CHARGE, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            amount: amount,
          }),
        });

        const data = await response.json();

        if (data.status === 1 && data.data) {
          // هدایت به صفحه پرداخت ترون
          if (data.data.trackId) {
            router.push(`/payment/tron?trackId=${data.data.trackId}`);
          } else {
            alert("خطا در دریافت اطلاعات پرداخت");
            setIsProcessingCharge(false);
          }
        } else {
          alert(data.message || "خطا در ایجاد درخواست پرداخت");
          setIsProcessingCharge(false);
        }
      } catch (error) {
        console.error("Error processing crypto charge:", error);
        alert("خطا در اتصال به سرور");
        setIsProcessingCharge(false);
      }
    }
  };

  // نمایش صفحه نتیجه پرداخت
  if (status === "success" || status === "failed") {
  return (
    <div className={styles.walletPage}>
      <div className={styles.walletCard}>
        {status === "success" && (
          <>
            <div className={`${styles.iconContainer} ${styles.iconContainerSuccess}`}>
              <SuccessIcon width={48} height={48} color="var(--success)" />
            </div>
            <h1 className={styles.cardTitle}>پرداخت موفق</h1>
            <p className={styles.cardDescription}>پرداخت شما با موفقیت انجام شد</p>
            
              {statusData?.trackId && (
              <div className={styles.trackIdBox}>
                <div className={styles.trackIdRow}>
                  <span className={styles.trackIdLabel}>شماره پیگیری:</span>
                    <span className={styles.trackIdValue}>{statusData.trackId}</span>
                </div>
                  {statusData.amount && (
                  <div className={styles.trackIdRow}>
                    <span className={styles.trackIdLabel}>مبلغ:</span>
                      <span className={styles.trackIdValue}>{statusData.amount.toLocaleString('fa-IR')} تومان</span>
                  </div>
                )}
                  {statusData.paidAt && (
                  <div className={styles.trackIdRow}>
                    <span className={styles.trackIdLabel}>زمان پرداخت:</span>
                      <span className={`${styles.trackIdValue} ${styles.trackIdValueRtl}`}>{formatDate(statusData.paidAt)}</span>
                  </div>
                )}
              </div>
            )}

            <div className={styles.buttonGroup}>
                <button
                  onClick={() => {
                    setStatus("normal");
                    router.replace("/wallet");
                  }}
                  className={`${styles.walletButton} ${styles.walletButtonSecondary}`}
                >
                  بازگشت به کیف پول
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className={styles.walletButton}
                >
                مشاهده داشبورد
                </button>
            </div>
          </>
        )}

        {status === "failed" && (
          <>
            <div className={`${styles.iconContainer} ${styles.iconContainerError}`}>
              <PaymentFailedIcon width={48} height={48} color="var(--error)" />
            </div>
            <h1 className={styles.cardTitle}>پرداخت ناموفق</h1>
            <p className={styles.cardDescription}>
                {statusData?.expired && statusData.paymentType === "tron"
                ? "زمان پرداخت به پایان رسید"
                : "متأسفانه پرداخت شما انجام نشد"}
            </p>
            
              {statusData?.expired && statusData.paymentType === "tron" && (
              <p className={styles.supportMessage}>
                در صورتی که پرداخت انجام دادید ولی تایید نشد با پشتیبانی در ارتباط باشید
              </p>
            )}
            
              {statusData?.trackId && (
              <div className={styles.trackIdBox}>
                <div className={styles.trackIdRow}>
                  <span className={styles.trackIdLabel}>شماره پیگیری:</span>
                    <span className={styles.trackIdValue}>{statusData.trackId}</span>
                </div>
              </div>
            )}

            <div className={styles.buttonGroup}>
              <button
                  onClick={() => {
                    setStatus("normal");
                    router.replace("/wallet");
                  }}
                className={styles.walletButton}
              >
                تلاش مجدد
              </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className={`${styles.walletButton} ${styles.walletButtonSecondary}`}
                >
                بازگشت به داشبورد
                </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

  // نمایش صفحه اصلی کیف پول
  return (
    <div className={styles.container}>
      <PageHeader title="کیف پول" onBack={() => router.back()} />

      <div className={styles.content}>
        {/* باکس موجودی کیف پول */}
        <div className={styles.balanceSection}>
          <div className={styles.balanceCard}>
            <div className={styles.balanceInfo}>
              <span className={styles.balanceLabel}>
                <MoneyBagIcon width={14} height={14} color="var(--foreground-muted)" className={styles.balanceLabelIcon} />
                موجودی کیف پول
              </span>
              {walletLoading ? (
                <div className={styles.balanceSkeleton}></div>
              ) : (
                <span className={styles.balanceAmount}>
                  {walletBalance !== null
                    ? walletBalance.toLocaleString("fa-IR")
                    : "۰"}
                  <span className={styles.balanceUnit}> تومان</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* بخش افزایش موجودی */}
        <div className={styles.chargeSection}>
          {/* اینفو باکس حداقل مبلغ شارژ */}
          <div className={styles.noteWrapper}>
            <label className={`${styles.noteLabel} ${styles.noteLabelInfo}`}>
              <AlertSquareIcon width={14} height={14} className={styles.noteLabelIcon} color="currentColor" />
              <span>حداقل مبلغ شارژ</span>
            </label>
            <div className={`${styles.noteBox} ${styles.noteBoxInfo}`}>
              <p className={styles.noteText}>
                حداقل مبلغ شارژ برای روش‌های پرداخت آنلاین و کارت به کارت <strong style={{ color: "var(--foreground)", fontWeight: "500" }}>۱,۰۰۰</strong> تومان و برای پرداخت با ارز دیجیتال <strong style={{ color: "var(--foreground)", fontWeight: "500" }}>۳۰,۰۰۰</strong> تومان می‌باشد.
              </p>
            </div>
          </div>
          
          {/* فیلد مقدار شارژ */}
          <div className={styles.fieldWrapper}>
            <label className={styles.fieldLabel}>مقدار مورد نظر (تومان)</label>
              <div className={styles.fieldItem}>
                <input
                  type="text"
                  value={chargeAmount ? formatNumberWithSeparator(chargeAmount) : ""}
                  onChange={(e) => {
                    const numericValue = parseFormattedNumber(e.target.value);
                    setChargeAmount(numericValue);
                  }}
                  placeholder="مقدار مورد نظر را وارد کنید"
                  className={styles.fieldItemValue}
                  dir="ltr"
                  inputMode="numeric"
                />
              </div>
          </div>

          {/* انتخاب روش پرداخت */}
          <div className={styles.paymentMethods}>
            <div className={styles.fieldWrapper}>
              <label className={styles.fieldLabel}>روش پرداخت</label>
              
              {/* شارژ با درگاه پرداخت آنلاین */}
              <div 
                className={`${styles.fieldItem} ${chargePaymentMethod === "online" ? styles.paymentMethodItemSelected : ''}`}
                onClick={() => setChargePaymentMethod("online")}
              >
                <input
                  type="radio"
                  id="charge-online"
                  name="chargePaymentMethod"
                  value="online"
                  checked={chargePaymentMethod === "online"}
                  onChange={(e) => setChargePaymentMethod(e.target.value)}
                  className={styles.paymentMethodRadio}
                  onClick={(e) => e.stopPropagation()}
                />
                <label htmlFor="charge-online" className={styles.paymentMethodLabel}>
                  <span className={styles.menuIcon}>
                    <BankCardIcon width={18} height={18} />
                  </span>
                  <span className={styles.fieldItemValue}>شارژ با درگاه پرداخت آنلاین</span>
                </label>
              </div>
            </div>

            <div className={styles.fieldWrapper}>
              {/* شارژ از طریق کارت به کارت */}
              <div 
                className={`${styles.fieldItem} ${chargePaymentMethod === "card" ? styles.paymentMethodItemSelected : ''}`}
                onClick={() => setChargePaymentMethod("card")}
              >
                <input
                  type="radio"
                  id="charge-card"
                  name="chargePaymentMethod"
                  value="card"
                  checked={chargePaymentMethod === "card"}
                  onChange={(e) => setChargePaymentMethod(e.target.value)}
                  className={styles.paymentMethodRadio}
                  onClick={(e) => e.stopPropagation()}
                />
                <label htmlFor="charge-card" className={styles.paymentMethodLabel}>
                  <span className={styles.menuIcon}>
                    <DepositMoneyIcon width={18} height={18} />
                  </span>
                  <span className={styles.fieldItemValue}>شارژ از طریق کارت به کارت</span>
                </label>
              </div>
            </div>

            <div className={styles.fieldWrapper}>
              {/* شارژ از طریق ارز دیجیتال */}
              <div 
                className={`${styles.fieldItem} ${chargePaymentMethod === "crypto" ? styles.paymentMethodItemSelected : ''}`}
                onClick={() => setChargePaymentMethod("crypto")}
              >
                <input
                  type="radio"
                  id="charge-crypto"
                  name="chargePaymentMethod"
                  value="crypto"
                  checked={chargePaymentMethod === "crypto"}
                  onChange={(e) => setChargePaymentMethod(e.target.value)}
                  className={styles.paymentMethodRadio}
                  onClick={(e) => e.stopPropagation()}
                />
                <label htmlFor="charge-crypto" className={styles.paymentMethodLabel}>
                  <span className={styles.menuIcon}>
                    <DepositCryptoIcon width={18} height={18} />
                  </span>
                  <span className={styles.fieldItemValue}>شارژ از طریق ارز دیجیتال</span>
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={handleProcessCharge}
            className={styles.chargeButton}
            disabled={
              walletLoading || 
              isProcessingCharge || 
              !chargeAmount || 
              parseFloat(parseFormattedNumber(chargeAmount)) < (chargePaymentMethod === "crypto" ? 30000 : 1000)
            }
          >
            <DepositMoneyIcon width={18} height={18} color="white" />
            <span>شارژ کیف پول</span>
          </button>
        </div>
      </div>

      {/* مودال عدم وجود کارت */}
      <CenterModal
        isOpen={isNoCardModalOpen}
        onClose={() => {
          setIsNoCardModalOpen(false);
          // بعد از بستن مودال، دوباره کارت‌ها را چک کن
          checkBankCard();
        }}
        title="ثبت شماره کارت"
        description="برای افزایش موجودی به صورت کارت به کارت و تأیید خودکار می‌بایست شماره کارت خود را در سیستم اضافه کنید."
        buttons={[
          {
            label: "رفتن به مدیریت کارت‌ها",
            onClick: () => {
              setIsNoCardModalOpen(false);
              router.push("/profile/cards");
            },
            variant: "primary",
          },
          {
            label: "انصراف",
            onClick: () => {
              setIsNoCardModalOpen(false);
              // بعد از بستن مودال، دوباره کارت‌ها را چک کن
              checkBankCard();
            },
            variant: "default",
          },
        ]}
      >
      </CenterModal>

      {/* مودال کارت به کارت */}
      <CenterModal
        isOpen={isCardToCardModalOpen}
        onClose={() => setIsCardToCardModalOpen(false)}
        title="واریز کارت به کارت"
        buttons={[
          {
            label: "متوجه شدم",
            onClick: () => setIsCardToCardModalOpen(false),
            variant: "primary",
          },
        ]}
      >
        <blockquote className={styles.modalDescription}>
          لطفاً مبلغ <strong style={{ color: "var(--foreground)", fontWeight: "500" }}>{chargeAmount ? formatNumberWithSeparator(chargeAmount) : '0'}</strong> تومان را به شماره شبای زیر به صورت پل ارسال کنید. پس از واریز، در کمتر از ۱ دقیقه واریزی شما به صورت خودکار تأیید خواهد شد.
        </blockquote>
        <div className={styles.noteWrapper}>
          <label className={`${styles.noteLabel} ${styles.noteLabelWarning}`}>
            <AlertSquareIcon width={14} height={14} className={styles.noteLabelIcon} color="currentColor" />
            <span>توجه مهم</span>
          </label>
          <div className={`${styles.noteBox} ${styles.noteBoxWarning}`}>
            <p className={styles.noteText}>
              دقت کنید که حتماً از طریق پل باشد، در غیر این صورت پرداخت شما تأیید نخواهد شد.
            </p>
          </div>
        </div>

        {accountHolderName && (
          <div style={{ marginBottom: "12px", textAlign: "right" }}>
            <span style={{ fontSize: "12px", color: "var(--foreground-muted)", marginLeft: "8px" }}>به نام:</span>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--foreground)" }}>{accountHolderName}</span>
          </div>
        )}

        {shabaNumber && (
          <div style={{ 
            backgroundColor: "var(--background-secondary)", 
            border: "1px solid var(--border)", 
            borderRadius: "8px", 
            padding: "12px 16px",
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}>
            <span style={{ 
              fontSize: "13px", 
              fontFamily: "monospace",
              direction: "ltr",
              textAlign: "right",
              flex: 1,
              color: "var(--foreground)",
              wordBreak: "break-all",
              fontWeight: "500"
            }}>
              {shabaNumber}
            </span>
            <button
              onClick={copyShabaToClipboard}
              style={{
                backgroundColor: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: shabaCopied ? "var(--success)" : "var(--primary)",
                fontSize: "12px",
                fontWeight: "500",
                fontFamily: "var(--font-onebit), Arial, Helvetica, sans-serif",
                transition: "all 0.2s",
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!shabaCopied) {
                  e.currentTarget.style.backgroundColor = "var(--hover)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {shabaCopied ? "کپی شد" : "کپی"}
            </button>
          </div>
        )}
      </CenterModal>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <PageHeader title="کیف پول" />
          <div className={styles.content}>
            <div className={styles.balanceSection}>
              <div className={styles.balanceCard}>
                <div className={styles.balanceSkeleton}></div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <WalletContent />
    </Suspense>
  );
}
