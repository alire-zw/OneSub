"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import styles from "./Admin.module.css";
import ShopIcon from "@/components/icons/ShopIcon";
import OrderIcon from "@/components/icons/OrderIcon";
import OrderTrackingIcon from "@/components/icons/OrderTrackingIcon";
import PaymentHistoryIcon from "@/components/icons/PaymentHistoryIcon";
import UserIcon from "@/components/icons/UserIcon";
import AdminIcon from "@/components/icons/AdminIcon";
import ColleagueIcon from "@/components/icons/ColleagueIcon";
import DashboardIcon from "@/components/icons/DashboardIcon";
import ThemeIcon from "@/components/icons/ThemeIcon";
import PendingDeliveryIcon from "@/components/icons/PendingDeliveryIcon";
import DeliveringIcon from "@/components/icons/DeliveringIcon";
import DeliveredIcon from "@/components/icons/DeliveredIcon";

const ArrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 18-6-6 6-6"></path>
  </svg>
);

interface MenuItem {
  icon: React.ReactNode;
  text: string;
  href: string;
}

export default function AdminPanelPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // اگر کاربر ادمین نبود، به صفحه قبلی برگردان
    if (!isLoading) {
      if (!user || user.role?.toLowerCase() !== "admin") {
        setShouldRedirect(true);
        setTimeout(() => {
          router.back();
        }, 0);
      }
    }
  }, [user, isLoading, router]);

  // نمایش loading
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonSubtitle}`}></div>
        </div>
        <div className={styles.menuBox}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.menuItem}>
              <div className={styles.menuItemStart}>
                <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
              </div>
              <div className={`${styles.skeleton} ${styles.skeletonArrow}`}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // اگر کاربر ادمین نبود، چیزی نمایش نده (redirect در حال انجام است)
  if (shouldRedirect || !user || user.role?.toLowerCase() !== "admin") {
    return null;
  }

  // بخش محصولات و سفارشات
  const productsMenuItems: MenuItem[] = [
    {
      icon: <ShopIcon width={18} height={18} />,
      text: "مدیریت محصولات",
      href: "/admin/products",
    },
    {
      icon: <ShopIcon width={18} height={18} />,
      text: "مدیریت بنرها",
      href: "/admin/banners",
    },
    {
      icon: <OrderIcon width={18} height={18} />,
      text: "مدیریت سفارشات",
      href: "/admin/orders",
    },
    {
      icon: <OrderTrackingIcon width={18} height={18} />,
      text: "پیگیری سفارشات",
      href: "/admin/orders/tracking",
    },
    {
      icon: <PaymentHistoryIcon width={18} height={18} />,
      text: "گزارشات فروش",
      href: "/admin/reports/sales",
    },
  ];

  // بخش کاربران
  const usersMenuItems: MenuItem[] = [
    {
      icon: <UserIcon width={18} height={18} />,
      text: "مدیریت کاربران",
      href: "/admin/users",
    },
    {
      icon: <AdminIcon width={18} height={18} />,
      text: "مدیریت ادمین‌ها",
      href: "/admin/admins",
    },
    {
      icon: <ColleagueIcon width={18} height={18} />,
      text: "مدیریت همکاران",
      href: "/admin/merchants",
    },
    {
      icon: <DashboardIcon width={18} height={18} />,
      text: "گزارشات کاربران",
      href: "/admin/reports/users",
    },
  ];

  // بخش حسابداری
  const accountingMenuItems: MenuItem[] = [
    {
      icon: <PaymentHistoryIcon width={18} height={18} />,
      text: "تراکنش‌های مالی",
      href: "/admin/accounting/transactions",
    },
    {
      icon: <PaymentHistoryIcon width={18} height={18} />,
      text: "گزارشات مالی",
      href: "/admin/accounting/reports",
    },
    {
      icon: <PaymentHistoryIcon width={18} height={18} />,
      text: "صورت‌حساب‌ها",
      href: "/admin/accounting/invoices",
    },
  ];

  // بخش تنظیمات و سایر
  const settingsMenuItems: MenuItem[] = [
    {
      icon: <ThemeIcon width={18} height={18} />,
      text: "تنظیمات سیستم",
      href: "/admin/settings",
    },
    {
      icon: <DashboardIcon width={18} height={18} />,
      text: "داشبورد آماری",
      href: "/admin/dashboard",
    },
  ];

  const handleMenuItemClick = (href: string) => {
    router.push(href);
  };

  // داده‌های آماری (موقت - بعداً از API می‌آید)
  const stats = {
    pendingOrders: 12,
    processingOrders: 8,
    completedOrders: 45,
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>پنل مدیریت</h1>
        <p className={styles.subtitle}>مدیریت کامل سیستم وان‌ساب</p>
      </div>

      {/* باکس‌های آماری */}
      <div className={styles.statsWrapper}>
        <div className={styles.statsRow}>
          <div className={`${styles.statBox} ${styles.pending}`}>
            <div className={styles.statBoxHeader}>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>
                  <div className={styles.statIcon}>
                    <PendingDeliveryIcon width={18} height={18} />
                  </div>
                  سفارشات در انتظار تایید امروز
                </div>
                <div className={styles.statValue}>{stats.pendingOrders}</div>
              </div>
            </div>
          </div>
          <div className={`${styles.statBox} ${styles.processing}`}>
            <div className={styles.statBoxHeader}>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>
                  <div className={styles.statIcon}>
                    <DeliveringIcon width={18} height={18} />
                  </div>
                  سفارشات در حال انجام امروز
                </div>
                <div className={styles.statValue}>{stats.processingOrders}</div>
              </div>
            </div>
          </div>
        </div>
        <div className={`${styles.statBox} ${styles.completed} ${styles.statBoxFull}`}>
          <div className={styles.statBoxHeader}>
            <div className={styles.statContent}>
              <div className={styles.statLabel}>
                <div className={styles.statIcon}>
                  <DeliveredIcon width={18} height={18} />
                </div>
                سفارشات تکمیل شده امروز
              </div>
              <div className={styles.statValue}>{stats.completedOrders}</div>
            </div>
          </div>
        </div>
      </div>

      {/* بخش محصولات و سفارشات */}
      <h5 className={styles.menuTitle}>محصولات و سفارشات</h5>
      <div className={styles.menuBox}>
        <div className={styles.menuList}>
          {productsMenuItems.map((item, index) => (
            <div key={index}>
              <div className={styles.menuItem} onClick={() => handleMenuItemClick(item.href)}>
                <div className={styles.menuItemStart}>
                  <span className={styles.menuIcon}>{item.icon}</span>
                  <span className={styles.menuText}>{item.text}</span>
                </div>
                <div className={styles.menuItemEnd}>
                  <span className={styles.arrow}>
                    <ArrowIcon />
                  </span>
                </div>
              </div>
              {index < productsMenuItems.length - 1 && <div className={styles.menuDivider}></div>}
            </div>
          ))}
        </div>
      </div>

      {/* بخش کاربران */}
      <h5 className={styles.menuTitle}>کاربران</h5>
      <div className={styles.menuBox}>
        <div className={styles.menuList}>
          {usersMenuItems.map((item, index) => (
            <div key={index}>
              <div className={styles.menuItem} onClick={() => handleMenuItemClick(item.href)}>
                <div className={styles.menuItemStart}>
                  <span className={styles.menuIcon}>{item.icon}</span>
                  <span className={styles.menuText}>{item.text}</span>
                </div>
                <div className={styles.menuItemEnd}>
                  <span className={styles.arrow}>
                    <ArrowIcon />
                  </span>
                </div>
              </div>
              {index < usersMenuItems.length - 1 && <div className={styles.menuDivider}></div>}
            </div>
          ))}
        </div>
      </div>

      {/* بخش حسابداری */}
      <h5 className={styles.menuTitle}>حسابداری</h5>
      <div className={styles.menuBox}>
        <div className={styles.menuList}>
          {accountingMenuItems.map((item, index) => (
            <div key={index}>
              <div className={styles.menuItem} onClick={() => handleMenuItemClick(item.href)}>
                <div className={styles.menuItemStart}>
                  <span className={styles.menuIcon}>{item.icon}</span>
                  <span className={styles.menuText}>{item.text}</span>
                </div>
                <div className={styles.menuItemEnd}>
                  <span className={styles.arrow}>
                    <ArrowIcon />
                  </span>
                </div>
              </div>
              {index < accountingMenuItems.length - 1 && <div className={styles.menuDivider}></div>}
            </div>
          ))}
        </div>
      </div>

      {/* بخش تنظیمات */}
      <h5 className={styles.menuTitle}>سایر</h5>
      <div className={styles.menuBox}>
        <div className={styles.menuList}>
          {settingsMenuItems.map((item, index) => (
            <div key={index}>
              <div className={styles.menuItem} onClick={() => handleMenuItemClick(item.href)}>
                <div className={styles.menuItemStart}>
                  <span className={styles.menuIcon}>{item.icon}</span>
                  <span className={styles.menuText}>{item.text}</span>
                </div>
                <div className={styles.menuItemEnd}>
                  <span className={styles.arrow}>
                    <ArrowIcon />
                  </span>
                </div>
              </div>
              {index < settingsMenuItems.length - 1 && <div className={styles.menuDivider}></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
