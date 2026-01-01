"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QRCode } from "react-qrcode-logo";
import styles from "./TronPayment.module.css";
import SuccessIcon from "@/components/icons/SuccessIcon";
import PaymentFailedIcon from "@/components/icons/PaymentFailedIcon";
import { API_BASE_URL } from "@/config/api";

interface PaymentData {
  trackId: number;
  orderId: string;
  amountToman: number;
  amountTrx: number;
  trxPrice: number;
  walletAddress: string;
  status: string;
  cryptoStatus: string;
  expiresAt: string;
  completedAt?: string;
  paidAt?: string;
  createdAt: string;
}

function TronPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [primaryColor, setPrimaryColor] = useState<string>("#10b981");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const trackId = searchParams.get("trackId");

  useEffect(() => {
    // Get primary color from CSS variable
    const root = document.documentElement;
    const color = getComputedStyle(root).getPropertyValue('--primary').trim() || '#10b981';
    setPrimaryColor(color);
  }, []);

  useEffect(() => {
    if (!trackId) {
      setError("Track ID is required");
      setLoading(false);
      return;
    }

    fetchPaymentData();
    
    // Check payment status every 10 seconds
    statusCheckIntervalRef.current = setInterval(() => {
      fetchPaymentData();
    }, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (statusCheckIntervalRef.current) clearInterval(statusCheckIntervalRef.current);
    };
  }, [trackId]);

  const fetchPaymentData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/crypto/tron/payment/${trackId}`);
      const result = await response.json();

      if (result.status === 1 && result.data) {
        // Ensure numeric values are numbers
        const data = {
          ...result.data,
          amountTrx: typeof result.data.amountTrx === 'string' ? parseFloat(result.data.amountTrx) : (result.data.amountTrx || 0),
          amountToman: typeof result.data.amountToman === 'string' ? parseFloat(result.data.amountToman) : (result.data.amountToman || 0),
          trxPrice: typeof result.data.trxPrice === 'string' ? parseFloat(result.data.trxPrice) : (result.data.trxPrice || 0)
        };
        setPaymentData(data);
        setError(null);

        // Calculate time left
        if (result.data.expiresAt) {
          const expiresAt = new Date(result.data.expiresAt).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
          setTimeLeft(remaining);

          // Start countdown timer
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (remaining > 0 && result.data.status === "pending") {
            intervalRef.current = setInterval(() => {
              setTimeLeft((prev) => {
                if (prev <= 1) {
                  if (intervalRef.current) clearInterval(intervalRef.current);
                  // Redirect to failed payment page when time expires
                  router.push(`/wallet?success=0&trackId=${trackId}&paymentType=tron&expired=1`);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          } else if (remaining <= 0 && result.data.status === "pending") {
            // Time already expired, redirect immediately
            router.push(`/wallet?success=0&trackId=${trackId}&paymentType=tron&expired=1`);
          }
        }

        // If payment completed, stop checking
        if (result.data.status === "completed") {
          if (statusCheckIntervalRef.current) clearInterval(statusCheckIntervalRef.current);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } else {
        setError(result.message || "Failed to load payment information");
      }
    } catch (err) {
      console.error("Error fetching payment data:", err);
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTrxAmount = (amount: number | string | null | undefined): string => {
    if (amount === null || amount === undefined) return "0.00";
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return "0.00";
    return numAmount.toFixed(2);
  };

  if (loading) {
    return (
      <div className={styles.paymentPage}>
        <div className={styles.paymentCard}>
          <div className={styles.skeletonContainer}>
            {/* Title Row with Timer */}
            <div className={styles.skeletonTitleRow}>
              <div className={styles.skeletonTitle}></div>
              <div className={styles.skeletonTimer}></div>
            </div>

            {/* Instructions Box */}
            <div className={styles.skeletonInstructionsBox}>
              <div className={styles.skeletonInstructionsLine}></div>
              <div className={styles.skeletonInstructionsLine}></div>
            </div>

            {/* Address Row (QR + Address) */}
            <div className={styles.skeletonAddressRow}>
              <div className={styles.skeletonQrBox}></div>
              <div className={styles.skeletonAddressBox}>
                <div className={styles.skeletonAddressLabel}></div>
                <div className={styles.skeletonAddressValue}></div>
                <div className={styles.skeletonCopyButton}></div>
              </div>
            </div>

            {/* Amount Box */}
            <div className={styles.skeletonAmountBox}>
              <div className={styles.skeletonAmountRow}></div>
              <div className={styles.skeletonAmountRow}></div>
              <div className={styles.skeletonAmountRow}></div>
            </div>

            {/* Button */}
            <div className={styles.skeletonButton}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !paymentData) {
    return (
      <div className={styles.paymentPage}>
        <div className={styles.paymentCard}>
          <div className={`${styles.iconContainer} ${styles.iconContainerError}`}>
            <PaymentFailedIcon width={48} height={48} color="var(--error)" />
          </div>
          <h1 className={`${styles.cardTitle} ${styles.cardTitleCenter}`}>خطا</h1>
          <p className={styles.cardDescription}>{error || "Payment information not found"}</p>
          <button
            onClick={() => router.push("/")}
            className={styles.walletButton}
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      </div>
    );
  }

  if (paymentData.status === "completed") {
    return (
      <div className={styles.paymentPage}>
        <div className={styles.paymentCard}>
          <div className={`${styles.iconContainer} ${styles.iconContainerSuccess}`}>
            <SuccessIcon width={48} height={48} color="var(--success)" />
          </div>
          <h1 className={`${styles.cardTitle} ${styles.cardTitleCenter}`}>پرداخت موفق</h1>
          <p className={styles.cardDescription}>پرداخت شما با موفقیت انجام شد</p>
          <div className={styles.infoBox}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>مبلغ:</span>
              <span className={styles.infoValue}>{paymentData.amountToman.toLocaleString("fa-IR")} تومان</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>مبلغ TRX:</span>
              <span className={styles.infoValue}>{formatTrxAmount(paymentData.amountTrx)} TRX</span>
            </div>
          </div>
          <button
            onClick={() => router.push("/wallet")}
            className={styles.walletButton}
          >
            بازگشت به کیف پول
          </button>
        </div>
      </div>
    );
  }

  if (paymentData.cryptoStatus === "expired") {
    return (
      <div className={styles.paymentPage}>
        <div className={styles.paymentCard}>
          <div className={`${styles.iconContainer} ${styles.iconContainerError}`}>
            <PaymentFailedIcon width={48} height={48} color="var(--error)" />
          </div>
          <h1 className={`${styles.cardTitle} ${styles.cardTitleCenter}`}>پرداخت ناموفق</h1>
          <p className={styles.cardDescription}>زمان پرداخت به پایان رسید</p>
          <p className={styles.supportMessage}>
            در صورتی که پرداخت انجام دادید ولی تایید نشد با پشتیبانی در ارتباط باشید
          </p>
          {paymentData.trackId && (
            <div className={styles.trackIdBox}>
              <div className={styles.trackIdRow}>
                <span className={styles.trackIdLabel}>شماره پیگیری:</span>
                <span className={styles.trackIdValue}>{paymentData.trackId}</span>
              </div>
            </div>
          )}
          <div className={styles.buttonGroup}>
            <button
              onClick={() => router.push("/wallet")}
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
        </div>
      </div>
    );
  }

  return (
    <div className={styles.paymentPage}>
      <div className={styles.paymentCard}>
        <div className={styles.titleRow}>
          <h1 className={styles.cardTitle}>پرداخت با ترون</h1>
          <div className={styles.timerInline}>
            <div className={styles.timerLabel}>زمان باقی‌مانده:</div>
            <div className={`${styles.timer} ${timeLeft < 60 ? styles.timerWarning : ""}`}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className={styles.instructionsBox}>
          <p className={styles.instructionsText}>
            لطفاً دقیقاً <strong>{formatTrxAmount(paymentData.amountTrx)} TRX</strong> را به آدرس زیر ارسال کنید.
          </p>
          <p className={styles.instructionsText}>
            پس از ارسال، پرداخت به صورت خودکار تأیید می‌شود.
          </p>
        </div>

        {/* Wallet Address */}
        <div className={styles.addressRow}>
          <div className={styles.emptyBox}>
            {paymentData.walletAddress && (
              <QRCode
                value={paymentData.walletAddress}
                size={134}
                ecLevel="H"
                qrStyle="dots"
                eyeRadius={8}
                eyeColor={primaryColor}
                bgColor="transparent"
                fgColor={primaryColor}
                quietZone={10}
              />
            )}
          </div>
          <div className={styles.addressBox}>
            <div className={styles.addressLabel}>آدرس کیف پول:</div>
            <div className={styles.addressValueContainer}>
              <code className={styles.addressValue}>{paymentData.walletAddress}</code>
            </div>
            <button
              onClick={() => copyToClipboard(paymentData.walletAddress)}
              className={styles.copyButton}
            >
              {copied ? "کپی شد!" : "کپی"}
            </button>
          </div>
        </div>

        {/* Amount Info */}
        <div className={styles.amountBox}>
          <div className={styles.amountRow}>
            <span className={styles.amountLabel}>مبلغ پرداخت:</span>
            <span className={styles.amountValue}>{paymentData.amountToman.toLocaleString("fa-IR")} تومان</span>
          </div>
          <div className={styles.amountRow}>
            <span className={styles.amountLabel}>مبلغ TRX:</span>
            <span className={styles.amountValue}>{formatTrxAmount(paymentData.amountTrx)} TRX</span>
          </div>
          <div className={styles.amountRow}>
            <span className={styles.amountLabel}>قیمت TRX:</span>
            <span className={styles.amountValue}>{paymentData.trxPrice.toLocaleString("fa-IR")} تومان</span>
          </div>
        </div>

        <button
          onClick={() => router.push("/wallet")}
          className={`${styles.walletButton} ${styles.walletButtonSecondary}`}
        >
          بازگشت
        </button>
      </div>
    </div>
  );
}

export default function TronPaymentPage() {
  return (
    <Suspense fallback={
      <div className={styles.paymentPage}>
        <div className={styles.paymentCard}>
          <div className={styles.skeletonContainer}>
            <div className={styles.skeletonTitleRow}>
              <div className={styles.skeletonTitle}></div>
              <div className={styles.skeletonTimer}></div>
            </div>
            <div className={styles.skeletonInstructionsBox}>
              <div className={styles.skeletonInstructionsLine}></div>
              <div className={styles.skeletonInstructionsLine}></div>
            </div>
            <div className={styles.skeletonAddressRow}>
              <div className={styles.skeletonQrBox}></div>
              <div className={styles.skeletonAddressBox}>
                <div className={styles.skeletonAddressLabel}></div>
                <div className={styles.skeletonAddressValue}></div>
                <div className={styles.skeletonCopyButton}></div>
              </div>
            </div>
            <div className={styles.skeletonAmountBox}>
              <div className={styles.skeletonAmountRow}></div>
              <div className={styles.skeletonAmountRow}></div>
              <div className={styles.skeletonAmountRow}></div>
            </div>
            <div className={styles.skeletonButton}></div>
          </div>
        </div>
      </div>
    }>
      <TronPaymentContent />
    </Suspense>
  );
}

