"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import styles from "./page.module.css";
import ContactIcon from "@/components/icons/ContactIcon";
import Notification from "@/components/Notification";
import CenterModal from "@/components/CenterModal";

interface Ticket {
  id: number;
  type: "sales" | "technical" | "product_support";
  subject: string;
  message: string;
  status: "open" | "pending" | "closed";
  createdAt: string;
  updatedAt: string;
}

export default function ContactPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!user;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  const [chatMessages, setChatMessages] = useState<Array<{
    id: number;
    sender: "user" | "support";
    message: string;
    timestamp: string;
  }>>([]);
  const [chatInput, setChatInput] = useState("");

  // بارگذاری تیکت‌ها (فقط اگر کاربر لاگین باشد)
  useEffect(() => {
    const fetchTickets = async () => {
      if (authLoading) return;
      
      // فقط اگر کاربر لاگین باشد، تیکت‌ها را بارگذاری کن
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(API_ENDPOINTS.TICKETS.LIST, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch tickets");
        }

        const data = await response.json();
        if (data.status === 1 && data.data) {
          setTickets(data.data);
        }
      } catch (error) {
        console.error("خطا در دریافت تیکت‌ها:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [authLoading, isAuthenticated]);

  const showNotification = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }));
  };


  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;

    const newMessage = {
      id: Date.now(),
      sender: "user" as const,
      message: chatInput,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, newMessage]);
    setChatInput("");

    // شبیه‌سازی پاسخ پشتیبانی
    setTimeout(() => {
      const supportMessage = {
        id: Date.now() + 1,
        sender: "support" as const,
        message: "پیام شما دریافت شد. در حال بررسی هستیم...",
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, supportMessage]);
    }, 1000);
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

  const getStatusText = (status: Ticket["status"]): string => {
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

  const getStatusColor = (status: Ticket["status"]): string => {
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

  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          {isAuthenticated && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>تیکت‌های پشتیبانی</h3>
              <div className={styles.ticketsBox}>
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>در حال بارگذاری...</p>
                </div>
              </div>
            </div>
          )}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>چت آنلاین با پشتیبانی</h3>
            <div className={styles.ticketsBox}>
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
      <div className={styles.content}>
        {/* بخش تیکت‌ها - فقط برای کاربران لاگین شده */}
        {isAuthenticated && (
          <div className={styles.section}>
          <h3 className={styles.sectionTitle}>تیکت‌های پشتیبانی</h3>
          <div className={styles.actionButtons}>
            <button
              className={styles.actionButton}
              onClick={() => router.push("/contact/create")}
            >
              <ContactIcon width={18} height={18} />
              ایجاد تیکت جدید
            </button>
          </div>

          <div className={styles.ticketsBox}>
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
                <p className={styles.emptyText}>هیچ تیکتی ثبت نشده است</p>
              </div>
            ) : (
              tickets.map((ticket, index) => (
                <div key={ticket.id}>
                  <div 
                    className={styles.ticketItem}
                  >
                    <div className={styles.ticketItemStart}>
                      <div className={styles.ticketContent}>
                        <div className={styles.ticketHeader}>
                          <h4 className={styles.ticketSubject}>{ticket.subject}</h4>
                          <div className={styles.ticketHeaderBadges}>
                            <span className={styles.ticketTypeBadge}>{getTypeLabel(ticket.type)}</span>
                            <div
                              className={styles.statusBadge}
                              style={{ color: getStatusColor(ticket.status) }}
                            >
                              {getStatusText(ticket.status)}
                            </div>
                          </div>
                        </div>
                        <p className={styles.ticketMessage}>{ticket.message}</p>
                        <div className={styles.ticketDate}>
                          {formatDate(ticket.createdAt)}
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
        )}

        {/* بخش چت آنلاین */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>چت آنلاین با پشتیبانی</h3>
          <div className={styles.actionButtons}>
            <button
              className={styles.actionButton}
              onClick={() => setIsChatOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              شروع چت آنلاین
            </button>
          </div>
          <div className={styles.chatInfoBox}>
            <div className={styles.chatInfoContent}>
              <div className={styles.chatInfoIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <div className={styles.chatInfoText}>
                <h4 className={styles.chatInfoTitle}>پشتیبانی آنلاین</h4>
                <p className={styles.chatInfoDescription}>
                  برای دریافت پاسخ سریع‌تر، می‌توانید از چت آنلاین استفاده کنید. تیم پشتیبانی ما در ساعات کاری آماده پاسخگویی است.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal چت آنلاین */}
      <CenterModal
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setChatMessages([]);
          setChatInput("");
        }}
        title="چت آنلاین با پشتیبانی"
        showCloseButton={true}
        buttons={[]}
      >
        <div className={styles.chatContainer}>
          <div className={styles.chatMessages}>
            {chatMessages.length === 0 ? (
              <div className={styles.chatEmptyState}>
                <p className={styles.chatEmptyText}>
                  سلام! چطور می‌تونم کمکتون کنم؟
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.chatMessage} ${
                    msg.sender === "user" ? styles.chatMessageUser : styles.chatMessageSupport
                  }`}
                >
                  <div className={styles.chatMessageBubble}>
                    <p className={styles.chatMessageText}>{msg.message}</p>
                    <span className={styles.chatMessageTime}>
                      {new Date(msg.timestamp).toLocaleTimeString("fa-IR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className={styles.chatInputContainer}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="پیام خود را بنویسید..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSendChatMessage();
                }
              }}
            />
            <button
              className={styles.chatSendButton}
              onClick={handleSendChatMessage}
              disabled={!chatInput.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </CenterModal>

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />
    </div>
  );
}
