"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isTelegramWebApp } from "@/utils/telegram";
import ShopIcon from "./icons/ShopIcon";
import ShopActiveIcon from "./icons/ShopActiveIcon";
import DashboardIcon from "./icons/DashboardIcon";
import DashboardActiveIcon from "./icons/DashboardActiveIcon";
import ContactIcon from "./icons/ContactIcon";
import ContactActiveIcon from "./icons/ContactActiveIcon";
import UserIcon from "./icons/UserIcon";
import UserActiveIcon from "./icons/UserActiveIcon";
import AdminIcon from "./icons/AdminIcon";
import AdminActiveIcon from "./icons/AdminActiveIcon";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  adminOnly?: boolean;
}

const baseNavItems: NavItem[] = [
  {
    href: "/shop",
    label: "فروشگاه",
    icon: <ShopIcon width={24} height={24} />,
    activeIcon: <ShopActiveIcon width={24} height={24} />,
  },
  {
    href: "/dashboard",
    label: "داشبورد",
    icon: <DashboardIcon width={24} height={24} />,
    activeIcon: <DashboardActiveIcon width={24} height={24} />,
  },
  {
    href: "/contact",
    label: "تماس با ما",
    icon: <ContactIcon width={24} height={24} />,
    activeIcon: <ContactActiveIcon width={24} height={24} />,
  },
  {
    href: "/profile",
    label: "پروفایل",
    icon: <UserIcon width={24} height={24} />,
    activeIcon: <UserActiveIcon width={24} height={24} />,
  },
];

const adminNavItem: NavItem = {
  href: "/admin",
  label: "پنل ادمین",
  icon: <AdminIcon width={24} height={24} />,
  activeIcon: <AdminActiveIcon width={24} height={24} />,
  adminOnly: true,
};

// کش در سطح ماژول برای حفظ وضعیت در تغییر مسیرها
let cachedSpacingState: boolean | null = null;

// محاسبه و کش کردن وضعیت spacing
const getCachedSpacingState = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  // اگر قبلاً محاسبه شده، از کش استفاده کن
  if (cachedSpacingState !== null) {
    return cachedSpacingState;
  }

  // محاسبه برای اولین بار
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const inTelegram = isTelegramWebApp();
  
  // فقط در iOS و داخل مینی‌اپ تلگرام فاصله اعمال شود
  // در iPhone اگر مینی‌اپ تلگرام نبود، فاصله نداشته باشه (مشابه اندروید)
  const shouldApplySpacing = iOS && inTelegram;
  
  // ذخیره در کش
  cachedSpacingState = shouldApplySpacing;

  return shouldApplySpacing;
};

export default function MobileNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [shouldApplySpacing, setShouldApplySpacing] = useState(false);
  
  // Check if user is admin
  const isAdmin = user?.role?.toLowerCase() === "admin";
  
  // Build nav items based on user role
  const navItems = isAdmin 
    ? [...baseNavItems, adminNavItem]
    : baseNavItems;

  useEffect(() => {
    // محاسبه spacing فقط در سمت کلاینت برای جلوگیری از hydration mismatch
    const spacing = getCachedSpacingState();
    setShouldApplySpacing(spacing);
  }, []);

  useEffect(() => {
    // تشخیص باز شدن کیبورد
    if (typeof window !== "undefined") {
      const initialHeight = window.visualViewport?.height || window.innerHeight;
      
      const handleResize = () => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        // اگر ارتفاع صفحه بیش از 150 پیکسل کاهش یابد، کیبورد باز شده
        if (initialHeight - currentHeight > 150) {
          setIsKeyboardOpen(true);
        } else {
          setIsKeyboardOpen(false);
        }
      };

      // رویداد برای تغییر اندازه viewport
      window.visualViewport?.addEventListener('resize', handleResize);
      window.addEventListener('resize', handleResize);

      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // مخفی کردن navbar در صفحه register و profile/info و profile/cards و profile/charge-history و admin/products و admin/accounting و admin/orders و cooperation و shop/all و shop/product (به جز buy/success و buy/failed) و orders
  if (pathname?.startsWith("/register") || pathname?.startsWith("/profile/info") || pathname?.startsWith("/profile/cards") || pathname?.startsWith("/profile/charge-history") || pathname?.startsWith("/admin/products") || pathname?.startsWith("/admin/accounting") || pathname?.startsWith("/admin/orders") || pathname === "/cooperation" || pathname?.startsWith("/shop/all") || (pathname?.startsWith("/shop/product") && pathname?.endsWith("/buy")) || pathname === "/orders" || pathname?.startsWith("/orders/")) {
    return null;
  }

  // مخفی کردن navbar هنگام باز بودن کیبورد
  if (isKeyboardOpen) {
    return null;
  }

  return (
    <div className="mobile-navbar">
      <div
        style={
          shouldApplySpacing
            ? {
                paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
              }
            : {}
        }
      >
        <nav className="flex items-center justify-around py-2 px-2">
          {navItems.map((item) => {
            // اگر در صفحه لاگین باشیم، آیکون پروفایل فعال باشد
            // اگر در صفحات زیرمجموعه فروشگاه یا wallet یا notifications باشیم، آیکون فروشگاه فعال باشد
            // اگر در صفحات زیرمجموعه contact باشیم، آیکون تماس با ما فعال باشد
            // اگر در صفحات زیرمجموعه orders باشیم، آیکون داشبرد فعال باشد
            const isActive = pathname === item.href || 
                            (pathname === "/login" && item.href === "/profile") ||
                            (item.href === "/shop" && (pathname?.startsWith("/shop") || pathname === "/wallet" || pathname?.startsWith("/notifications") || pathname?.includes("/buy/success") || pathname?.includes("/buy/failed"))) ||
                            (item.href === "/contact" && (pathname?.startsWith("/contact"))) ||
                            (item.href === "/dashboard" && (pathname === "/orders" || pathname?.startsWith("/orders/")));

            // بررسی authentication برای صفحه پروفایل و پنل ادمین
            const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
              if (item.href === "/profile" && !isAuthenticated) {
                e.preventDefault();
                router.push("/login");
                return;
              }
              
              // بررسی دسترسی ادمین برای پنل ادمین
              if (item.href === "/admin" && !isAdmin) {
                e.preventDefault();
                router.back();
                return;
              }
            };

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleClick}
                className="flex flex-col items-center py-2 px-3 min-w-0 flex-1 transition-colors"
              >
                <div
                  className={`mb-1 w-6 h-6 ${
                    isActive ? "text-primary" : "text-foreground-muted"
                  }`}
                >
                  {isActive ? item.activeIcon : item.icon}
                </div>
                <span
                  className={`text-[11px] font-medium leading-tight ${
                    isActive
                      ? "text-primary"
                      : "text-foreground-muted"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}


