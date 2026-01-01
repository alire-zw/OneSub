"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "./Transactions.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import DepositMoneyIcon from "@/components/icons/DepositMoneyIcon";
import DepositCryptoIcon from "@/components/icons/DepositCryptoIcon";

interface Transaction {
  id: number;
  userId: number;
  userName: string | null;
  phoneNumber: string | null;
  trackId: number;
  orderId: string | null;
  amount: number;
  status: "pending" | "completed" | "failed" | "cancelled";
  paymentType: "zibal" | "tron" | "saman";
  refNumber: string | null;
  cardNumber: string | null;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminTransactionsPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // بارگذاری تراکنش‌ها
  useEffect(() => {
    const fetchTransactions = async () => {
      if (authLoading) return;

      setIsLoading(true);
      try {
        const response = await fetch(API_ENDPOINTS.TRANSACTIONS.LIST_ALL, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch transactions");
        }

        const data = await response.json();

        if (data.status === 1 && data.data) {
          setTransactions(data.data);
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [authLoading]);

  // تابع فرمت کردن مبلغ (تبدیل از ریال به تومان)
  const formatAmount = (amount: number): string => {
    const toman = amount / 10; // تبدیل از ریال به تومان
    return new Intl.NumberFormat("fa-IR").format(toman);
  };

  // تابع فرمت کردن تاریخ
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

  // تابع دریافت متن وضعیت
  const getStatusText = (status: string): string => {
    switch (status) {
      case "pending":
        return "در انتظار";
      case "completed":
        return "تکمیل شده";
      case "failed":
        return "ناموفق";
      case "cancelled":
        return "لغو شده";
      default:
        return status;
    }
  };

  // تابع دریافت رنگ وضعیت
  const getStatusColor = (status: string): string => {
    switch (status) {
      case "pending":
        return "var(--warning)";
      case "completed":
        return "var(--primary)";
      case "failed":
        return "var(--error)";
      case "cancelled":
        return "var(--foreground-muted)";
      default:
        return "var(--foreground-muted)";
    }
  };

  // تابع دریافت متن نوع پرداخت
  const getPaymentTypeText = (paymentType: string): string => {
    switch (paymentType) {
      case "zibal":
        return "درگاه پرداخت انلاین";
      case "tron":
        return "پرداخت بصورت ارز دیجیتال";
      case "saman":
        return "واریز بصورت پل";
      default:
        return paymentType;
    }
  };

  // تابع دریافت آیکون نوع پرداخت
  const getPaymentTypeIcon = (paymentType: string) => {
    if (paymentType === "tron") {
      return DepositCryptoIcon;
    }
    return DepositMoneyIcon;
  };

  // تابع دریافت رنگ آیکون بر اساس وضعیت
  const getIconColor = (status: string): string => {
    if (status === "completed") {
      return "var(--primary)";
    } else if (status === "failed") {
      return "var(--error)";
    }
    return "var(--foreground-muted)";
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="تراکنش‌های مالی" onBack={() => router.push("/admin")} />
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>تراکنش‌ها</h3>
            <div className={styles.itemsContainer}>
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>در حال بارگذاری...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <PageHeader title="تراکنش‌های مالی" onBack={() => router.push("/admin")} />

      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>تراکنش‌ها</h3>

          {isLoading ? (
            <div className={styles.itemsContainer}>
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>در حال بارگذاری...</p>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className={styles.itemsContainer}>
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
                <p className={styles.emptyText}>هیچ تراکنشی یافت نشد</p>
              </div>
            </div>
          ) : (
            <div className={styles.itemsContainer}>
              {transactions.map((transaction) => (
                <div key={transaction.id} className={styles.transactionItem}>
                  <div className={styles.transactionHeader}>
                    <div className={styles.transactionInfo}>
                      <div className={styles.transactionMeta}>
                        <div
                          className={styles.paymentIconBox}
                          style={{ color: getIconColor(transaction.status) }}
                        >
                          {(() => {
                            const IconComponent = getPaymentTypeIcon(transaction.paymentType);
                            return <IconComponent width={16} height={16} />;
                          })()}
                        </div>
                        <div className={styles.transactionMetaText}>
                          <span className={styles.paymentTypeText}>
                            {getPaymentTypeText(transaction.paymentType)}
                          </span>
                          <span
                            className={styles.transactionStatus}
                            style={{ color: getStatusColor(transaction.status) }}
                          >
                            {getStatusText(transaction.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.transactionAmount}>
                      {formatAmount(transaction.amount)} تومان
                    </div>
                  </div>

                  <div className={styles.transactionDetails}>
                    <div className={styles.transactionDetailRow}>
                      <span className={styles.detailLabel}>تاریخ:</span>
                      <span className={styles.detailValue}>
                        {formatDate(transaction.createdAt)}
                      </span>
                    </div>

                    {transaction.userName && (
                      <div className={styles.transactionDetailRow}>
                        <span className={styles.detailLabel}>کاربر:</span>
                        <span className={styles.detailValue}>{transaction.userName}</span>
                      </div>
                    )}

                    {transaction.phoneNumber && (
                      <div className={styles.transactionDetailRow}>
                        <span className={styles.detailLabel}>شماره موبایل:</span>
                        <span className={styles.detailValue}>{transaction.phoneNumber}</span>
                      </div>
                    )}

                    {transaction.trackId && (
                      <div className={styles.transactionDetailRow}>
                        <span className={styles.detailLabel}>کد پیگیری:</span>
                        <span className={styles.detailValue}>{transaction.trackId}</span>
                      </div>
                    )}

                    {transaction.refNumber && (
                      <div className={styles.transactionDetailRow}>
                        <span className={styles.detailLabel}>شماره مرجع:</span>
                        <span className={styles.detailValue}>{transaction.refNumber}</span>
                      </div>
                    )}

                    {transaction.cardNumber && (
                      <div className={styles.transactionDetailRow}>
                        <span className={styles.detailLabel}>شماره کارت:</span>
                        <span className={styles.detailValue}>
                          ****{transaction.cardNumber.slice(-4)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

