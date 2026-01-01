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
  
  // مخفی کردن هدر در صفحه لاگین، پروفایل، پنل ادمین، wallet، payment، cooperation و shop/all و shop/product
  if (pathname === "/login" || pathname?.startsWith("/login") || pathname === "/profile" || pathname?.startsWith("/profile/") || pathname === "/admin" || pathname?.startsWith("/admin/") || pathname === "/wallet" || pathname?.startsWith("/payment/") || pathname === "/cooperation" || pathname === "/shop/all" || pathname?.startsWith("/shop/product")) {
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
            <button
              className="relative bg-card border border-border rounded-md p-1.5 hover:bg-hover transition-colors text-foreground-muted hover:text-foreground flex items-center justify-center"
              style={{ width: BOX_SIZE, height: BOX_SIZE }}
              aria-label="اعلان‌ها"
            >
              <BellIcon width={20} height={20} className="w-5 h-5" />
              {/* Badge برای تعداد نوتیفیکیشن‌های خوانده نشده */}
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full border-2 border-card"></span>
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}

