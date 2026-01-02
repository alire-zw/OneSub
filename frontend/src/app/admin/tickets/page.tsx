"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "./Tickets.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import Image from "next/image";

interface Ticket {
  id: number;
  userId: number;
  userName: string | null;
  phoneNumber: string | null;
  type: "sales" | "technical" | "product_support";
  subject: string;
  message: string;
  orderNumber: string | null;
  productName: string | null;
  productImagePath: string | null;
  status: "open" | "pending" | "closed";
  createdAt: string;
  updatedAt: string;
  adminMessageCount: number;
  userMessageCount: number;
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "open" | "pending" | "closed">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "sales" | "technical" | "product_support">("all");

  // بارگذاری تیکت‌ها
  useEffect(() => {
    const fetchTickets = async () => {
      if (authLoading) return;

      setIsLoading(true);
      try {
        let url = API_ENDPOINTS.TICKETS.ADMIN.ALL;
        const params = new URLSearchParams();
        
        if (activeFilter !== "all") {
          params.append("status", activeFilter);
        }
        
        if (typeFilter !== "all") {
          params.append("type", typeFilter);
        }

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch tickets");
        }

        const data = await response.json();
        if (data.status === 1 && data.data) {
          setAllTickets(data.data);
          setTickets(data.data);
        }
      } catch (error) {
        console.error("خطا در دریافت تیکت‌ها:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [authLoading, activeFilter, typeFilter]);

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

  const getStatusText = (status: string): string => {
    switch (status) {
      case "open":
        return "باز";
      case "pending":
        return "در انتظار";
      case "closed":
        return "بسته شده";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "open":
        return "var(--primary)";
      case "pending":
        return "var(--warning)";
      case "closed":
        return "var(--foreground-muted)";
      default:
        return "var(--foreground-muted)";
    }
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

  if (authLoading || isLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="مدیریت تیکت‌ها" onBack={() => router.push("/admin")} />
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
      <PageHeader title="مدیریت تیکت‌ها" onBack={() => router.push("/admin")} />

      <div className={styles.content}>
        {/* فیلترها */}
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>وضعیت:</label>
            <div className={styles.filterButtons}>
              <button
                className={`${styles.filterButton} ${activeFilter === "all" ? styles.filterButtonActive : ""}`}
                onClick={() => setActiveFilter("all")}
              >
                همه
              </button>
              <button
                className={`${styles.filterButton} ${activeFilter === "open" ? styles.filterButtonActive : ""}`}
                onClick={() => setActiveFilter("open")}
              >
                باز
              </button>
              <button
                className={`${styles.filterButton} ${activeFilter === "pending" ? styles.filterButtonActive : ""}`}
                onClick={() => setActiveFilter("pending")}
              >
                در انتظار
              </button>
              <button
                className={`${styles.filterButton} ${activeFilter === "closed" ? styles.filterButtonActive : ""}`}
                onClick={() => setActiveFilter("closed")}
              >
                بسته شده
              </button>
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>نوع:</label>
            <div className={styles.filterButtons}>
              <button
                className={`${styles.filterButton} ${typeFilter === "all" ? styles.filterButtonActive : ""}`}
                onClick={() => setTypeFilter("all")}
              >
                همه
              </button>
              <button
                className={`${styles.filterButton} ${typeFilter === "sales" ? styles.filterButtonActive : ""}`}
                onClick={() => setTypeFilter("sales")}
              >
                فروش
              </button>
              <button
                className={`${styles.filterButton} ${typeFilter === "technical" ? styles.filterButtonActive : ""}`}
                onClick={() => setTypeFilter("technical")}
              >
                فنی
              </button>
              <button
                className={`${styles.filterButton} ${typeFilter === "product_support" ? styles.filterButtonActive : ""}`}
                onClick={() => setTypeFilter("product_support")}
              >
                پشتیبانی محصول
              </button>
            </div>
          </div>
        </div>

        {/* لیست تیکت‌ها */}
        <div className={styles.ticketsList}>
          {tickets.length === 0 ? (
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
              <p className={styles.emptyText}>هیچ تیکتی یافت نشد</p>
            </div>
          ) : (
            tickets.map((ticket, index) => (
              <div key={ticket.id}>
                <div
                  className={styles.ticketItem}
                >
                  <div className={styles.ticketItemStart}>
                    {ticket.type === "product_support" && ticket.productImagePath && (
                      <div className={styles.ticketImage}>
                        <Image
                          src={`${API_BASE_URL}${ticket.productImagePath}`}
                          alt={ticket.productName || "Product"}
                          width={48}
                          height={48}
                          className={styles.ticketImageImg}
                        />
                      </div>
                    )}
                    <div className={styles.ticketContent}>
                      <div className={styles.ticketHeader}>
                        <h4 className={styles.ticketSubject}>{ticket.subject}</h4>
                        <div className={styles.ticketBadges}>
                          <span className={styles.ticketTypeBadge}>{getTypeLabel(ticket.type)}</span>
                          <div
                            className={styles.statusBadge}
                            style={{ color: getStatusColor(ticket.status) }}
                          >
                            {getStatusText(ticket.status)}
                          </div>
                        </div>
                      </div>
                      <div className={styles.ticketInfo}>
                        <span className={styles.ticketUser}>
                          {ticket.userName || ticket.phoneNumber || "کاربر"}
                        </span>
                        {ticket.orderNumber && (
                          <>
                            <span className={styles.ticketSeparator}>•</span>
                            <span className={styles.ticketOrder}>سفارش: {ticket.orderNumber}</span>
                          </>
                        )}
                      </div>
                      <div className={styles.ticketMeta}>
                        <span className={styles.ticketDate}>{formatDate(ticket.createdAt)}</span>
                        <span className={styles.ticketMessages}>
                          {ticket.userMessageCount} پیام کاربر • {ticket.adminMessageCount} پیام ادمین
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {index < tickets.length - 1 && (
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

