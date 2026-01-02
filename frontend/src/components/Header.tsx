"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import BellIcon from "@/components/icons/BellIcon";
import MoneyBagIcon from "@/components/icons/MoneyBagIcon";
import { API_ENDPOINTS, getAuthHeaders } from "@/config/api";

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjOTk5IiBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAzYzEuNjYgMCAzIDEuMzQgMyAzcy0xLjM0IDMtMyAzLTMtMS4zNC0zLTMgMS4zNC0zIDMtM3ptMCAxNC4yYy0yLjUgMC00LjcxLTEuMjgtNi0zLjIyLjAzLTEuOTkgNC0zLjA4IDYtMy4wOCAxLjk5IDAgNS45NyAxLjA5IDYgMy4wOC0xLjI5IDEuOTQtMy41IDMuMjItNiAzLjIyeiIvPjwvc3ZnPg==';

// اندازه یکسان برای همه باکس‌های هدر
const BOX_SIZE = '32px';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [userAvatar, setUserAvatar] = useState(defaultAvatar);
  const [userName, setUserName] = useState("کاربر وان‌ساب");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    if (user?.userName) {
      setUserName(user.userName);
    } else {
      setUserName("کاربر وان‌ساب");
    }

    // دریافت avatar از Telegram
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
      const telegramUser = window.Telegram.WebApp.initDataUnsafe.user as {
        photo_url?: string;
      };
      if (telegramUser.photo_url) {
        setUserAvatar(telegramUser.photo_url);
      }
    }
  }, [user]);

  // دریافت موجودی کاربر
  useEffect(() => {
    const fetchBalance = async () => {
      if (!isAuthenticated) {
        setWalletBalance(null);
        return;
      }

      setWalletLoading(true);
      try {
        const response = await fetch(API_ENDPOINTS.WALLET.BALANCE, {
          method: 'GET',
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
        console.error('Error fetching wallet balance:', error);
      } finally {
        setWalletLoading(false);
      }
    };

    fetchBalance();
  }, [isAuthenticated]);
  
  // دریافت تعداد نوتیفیکیشن‌های خوانده نشده
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!isAuthenticated) {
        setUnreadCount(0);
        return;
      }

      try {
        const response = await fetch(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 1 && data.data) {
            setUnreadCount(data.data.count || 0);
          }
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // دریافت لیست نوتیفیکیشن‌ها برای dropdown
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!isAuthenticated || !notificationsOpen) {
        return;
      }

      setNotificationsLoading(true);
      try {
        const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS.LIST}?limit=5&unreadOnly=true`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 1 && data.data) {
            setNotifications(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setNotificationsLoading(false);
      }
    };

    if (notificationsOpen) {
      fetchNotifications();
    }
  }, [isAuthenticated, notificationsOpen]);

  // بستن dropdown وقتی کلیک خارج از آن انجام می‌شود
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (notificationsOpen && !target.closest('.notifications-dropdown')) {
        setNotificationsOpen(false);
      }
    };

    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [notificationsOpen]);
  
  // مخفی کردن هدر در صفحه لاگین، پروفایل، پنل ادمین، wallet، payment، cooperation، notifications و shop/all و shop/product و contact/ticket و contact/create و orders
  if (pathname === "/login" || pathname?.startsWith("/login") || pathname === "/profile" || pathname?.startsWith("/profile/") || pathname === "/admin" || pathname?.startsWith("/admin/") || pathname === "/wallet" || pathname?.startsWith("/payment/") || pathname === "/cooperation" || pathname === "/notifications" || pathname?.startsWith("/notifications/") || pathname === "/shop/all" || pathname?.startsWith("/shop/product") || pathname?.startsWith("/contact/ticket") || pathname?.startsWith("/contact/create") || pathname === "/orders" || pathname?.startsWith("/orders/")) {
    return null;
  }

  return (
    <header className="bg-card sticky top-0 z-50">
      <nav className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* باکس کاربر یا دکمه ورود */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
          <button
                onClick={() => router.push("/profile")}
                className="relative bg-card border border-border rounded-md hover:bg-hover transition-colors overflow-hidden"
                style={{ width: BOX_SIZE, height: BOX_SIZE }}
                aria-label="پروفایل"
          >
                <Image
                  src={userAvatar}
                  alt="User Avatar"
                  width={32}
                  height={32}
                  className="rounded-md object-cover w-full h-full"
                />
          </button>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-foreground-muted leading-tight">سلام ، خوش اومدی</span>
                <span className="text-[11px] font-medium text-foreground leading-tight truncate max-w-[80px]">
                  {userName}
                </span>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-primary text-white px-4 rounded-md hover:bg-primary-hover transition-colors text-sm font-medium flex items-center justify-center"
              style={{ height: BOX_SIZE }}
            >
              ورود
            </Link>
          )}

          <div className="flex items-center gap-2">
            {/* باکس موجودی کاربر - فقط برای کاربران لاگین شده */}
            {isAuthenticated && (
            <button
              onClick={() => router.push("/wallet")}
              className={`relative rounded-md px-2 py-0.5 transition-colors flex items-center ${
                walletBalance !== null && walletBalance === 0
                  ? 'bg-primary border border-primary text-white hover:bg-primary-hover'
                  : 'bg-card border border-border text-foreground-muted hover:bg-hover hover:text-foreground'
              }`}
              style={{ height: BOX_SIZE, gap: '6px' }}
              aria-label="موجودی"
            >
              {walletLoading ? (
                <div className="w-4 h-4 bg-gray-600 rounded animate-pulse"></div>
              ) : (
                <MoneyBagIcon 
                  width={16} 
                  height={16} 
                  className="w-4 h-4" 
                  color={walletBalance !== null && walletBalance === 0 ? 'white' : 'var(--primary)'} 
                />
              )}
              {walletLoading ? (
                <span className="text-sm">...</span>
              ) : walletBalance !== null && walletBalance > 0 ? (
                <div className="flex items-center gap-1">
                  <span className="text-foreground text-sm">
                    {walletBalance.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-foreground-muted text-[10px]">
                    تومان
                  </span>
                </div>
              ) : (
                <span className="text-sm whitespace-nowrap">
                  شارژ کیف پول
                </span>
              )}
            </button>
            )}

            {/* باکس نوتیفیکیشن */}
            {isAuthenticated && (
            <div className="relative notifications-dropdown">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative bg-card border border-border rounded-md p-1.5 hover:bg-hover transition-colors text-foreground-muted hover:text-foreground flex items-center justify-center"
                style={{ width: BOX_SIZE, height: BOX_SIZE }}
                aria-label="اعلان‌ها"
              >
                <BellIcon width={20} height={20} className="w-5 h-5" />
                {/* Badge برای تعداد نوتیفیکیشن‌های خوانده نشده */}
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-bold rounded-full border-2 border-card flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown نوتیفیکیشن‌ها */}
              {notificationsOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-lg z-50 max-h-[400px] flex flex-col">
                  {/* Header */}
                  <div className="p-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">اعلان‌ها</h3>
                  </div>

                  {/* لیست نوتیفیکیشن‌ها */}
                  <div className="overflow-y-auto flex-1">
                    {notificationsLoading ? (
                      <div className="p-4 text-center text-foreground-muted text-sm">
                        در حال بارگذاری...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-center text-foreground-muted text-sm">
                        اعلانی وجود ندارد
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-3 border-b border-border hover:bg-hover cursor-pointer transition-colors ${
                            !notification.isRead ? 'bg-background-secondary' : ''
                          }`}
                          onClick={async () => {
                            // Mark as read if not already read
                            if (!notification.isRead) {
                              try {
                                await fetch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notification.id), {
                                  method: 'POST',
                                  headers: getAuthHeaders(),
                                });
                                // Update local state
                                setNotifications((prev) =>
                                  prev.map((notif) =>
                                    notif.id === notification.id
                                      ? { ...notif, isRead: true }
                                      : notif
                                  )
                                );
                                // Update unread count
                                setUnreadCount((prev) => Math.max(0, prev - 1));
                              } catch (error) {
                                console.error('Error marking notification as read:', error);
                              }
                            }
                            
                            // Navigate to notification detail page
                            router.push(`/notifications/${notification.id}`);
                            setNotificationsOpen(false);
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-foreground mb-1">
                                {notification.title}
                              </h4>
                              <p className="text-xs text-foreground-muted line-clamp-2">
                                {notification.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer - لینک به مرکز پیام‌ها */}
                  <div className="p-3 border-t border-border">
                    <Link
                      href="/notifications"
                      onClick={() => setNotificationsOpen(false)}
                      className="block w-full text-center text-sm text-primary hover:text-primary-hover font-medium py-2"
                    >
                      برو به مرکز پیام‌ها
                    </Link>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

