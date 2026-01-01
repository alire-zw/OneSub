"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./Profile.module.css";
import { useRequireAuth, useAuth } from "@/hooks/useAuth";
import { useTelegramRegister } from "@/hooks/useTelegramRegister";
import OrderTrackingIcon from "@/components/icons/OrderTrackingIcon";
import OrderIcon from "@/components/icons/OrderIcon";
import ThemeIcon from "@/components/icons/ThemeIcon";
import PaymentHistoryIcon from "@/components/icons/PaymentHistoryIcon";
import CollaborationIcon from "@/components/icons/CollaborationIcon";
import SocialMediaIcon from "@/components/icons/SocialMediaIcon";
import LightModeIcon from "@/components/icons/LightModeIcon";
import DarkModeIcon from "@/components/icons/DarkModeIcon";
import AutoIcon from "@/components/icons/AutoIcon";
import { useTheme } from "@/hooks/useTheme";
import type { ThemeMode } from "@/utils/theme";
import TelegramIcon from "@/components/icons/TelegramIcon";
import AdminIcon from "@/components/icons/AdminIcon";
import RegularUserIcon from "@/components/icons/RegularUserIcon";
import ColleagueIcon from "@/components/icons/ColleagueIcon";
import BankCardIcon from "@/components/icons/BankCardIcon";
import BottomSheet from "@/components/BottomSheet";
import { isTelegramWebApp } from "@/utils/telegram";

const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjOTk5IiBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAzYzEuNjYgMCAzIDEuMzQgMyAzcy0xLjM0IDMtMyAzLTMtMS4zNC0zLTMgMS4zNC0zIDMtM3ptMCAxNC4yYy0yLjUgMC00LjcxLTEuMjgtNi0zLjIyLjAzLTEuOTkgNC0zLjA4IDYtMy4wOCAxLjk5IDAgNS45NyAxLjA5IDYgMy4wOC0xLjI5IDEuOTQtMy41IDMuMjItNiAzLjIyeiIvPjwvc3ZnPg==';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth("/login");
  const { logout } = useAuth();
  const { isRegistering, registerStatus } = useTelegramRegister();
  
  const [tgName, setTgName] = useState("کاربر وان‌ساب");
  const [tgAvatar, setTgAvatar] = useState(defaultAvatar);
  const [tgId, setTgId] = useState("");
  const [isThemeSheetOpen, setIsThemeSheetOpen] = useState(false);
  const { themeMode, setTheme } = useTheme();
  const [isSocialSheetOpen, setIsSocialSheetOpen] = useState(false);
  const [isInTelegram, setIsInTelegram] = useState<boolean | null>(null); // null = not checked yet

  useEffect(() => {
    // بررسی اینکه آیا در مینی‌اپ تلگرام هستیم (فقط در سمت کلاینت)
    setIsInTelegram(isTelegramWebApp());

    // دریافت اطلاعات از Telegram (فقط برای avatar و به عنوان fallback)
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      tg.ready();

      if (tg.initDataUnsafe?.user) {
        const telegramUser = tg.initDataUnsafe.user as {
          first_name?: string;
          last_name?: string;
          id?: number;
          photo_url?: string;
        };
        setTgAvatar(telegramUser.photo_url || defaultAvatar);
      }
    }
  }, []);

  // استفاده از user data از AuthContext (که از Redis cache می‌آید)
  useEffect(() => {
    if (isLoading || !user) {
      return;
    }

    // Debug: بررسی role
    console.log('User role:', user.role, 'Role type:', typeof user.role, 'Full user:', user);

    // نمایش نام کاربری از cache
    if (user.userName) {
      setTgName(user.userName);
    } else {
      // اگر در cache نامی وجود نداشت، از تلگرام استفاده کن
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const telegramUser = window.Telegram.WebApp.initDataUnsafe.user as {
          first_name?: string;
          last_name?: string;
        };
        const fullName = (telegramUser.first_name || '') + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
        setTgName(fullName || "کاربر وان‌ساب");
      } else {
        setTgName("کاربر وان‌ساب");
      }
    }
    
    // شناسه کاربری از cache
    if (user.id) {
      setTgId(user.id.toString());
    }
  }, [isLoading, user]);

  // تابع تغییر تم
  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode);
  };

  // تابع کپی کردن شناسه
  const copyUserId = async () => {
    if (!tgId) return;
    try {
      await navigator.clipboard.writeText(tgId);
      // می‌توانید notification اضافه کنید
    } catch (error) {
      console.error("Error copying user ID:", error);
    }
  };

  const CopyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );

  const ArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 18-6-6 6-6"></path>
    </svg>
  );

  // هندلر خروج از حساب کاربری
  const handleLogout = () => {
    logout();
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        {/* Header Skeleton */}
        <div className={styles.header}>
          <div className={styles.profileInfo}>
            <div className={`${styles.skeleton} ${styles.skeletonAvatar}`}></div>
            <div className={styles.profileText}>
              <div className={`${styles.skeleton} ${styles.skeletonName}`}></div>
              <div className={`${styles.skeleton} ${styles.skeletonUserId}`}></div>
            </div>
            <div className={styles.flexSpacer}></div>
          </div>
        </div>

        {/* Menu Title Skeleton */}
        <h5 className={styles.menuTitle}>حساب کاربری</h5>

        {/* Menu Box Skeleton */}
        <div className={styles.menuBox}>
          <div className={styles.menuList}>
            <div className={styles.menuItem}>
              <div className={styles.menuItemStart}>
                <span className={styles.menuIcon}>
                  <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                </span>
                <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
              </div>
              <div className={styles.menuItemEnd}>
                <div className={`${styles.skeleton} ${styles.skeletonArrow}`}></div>
              </div>
            </div>

            <div className={styles.menuDivider}></div>

            <div className={styles.menuItem}>
              <div className={styles.menuItemStart}>
                <span className={styles.menuIcon}>
                  <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                </span>
                <div className={`${styles.skeleton} ${styles.skeletonText}`}></div>
              </div>
              <div className={styles.menuItemEnd}>
                <div className={`${styles.skeleton} ${styles.skeletonArrow}`}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Title Skeleton */}
        <h5 className={styles.menuTitle}>سفارشات و تاریخچه</h5>

        {/* Menu Box Skeleton */}
        <div className={styles.menuBox}>
          <div className={styles.menuList}>
            <div className={styles.menuItem}>
              <div className={styles.menuItemStart}>
                <span className={styles.menuIcon}>
                  <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                </span>
                <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '100px' }}></div>
              </div>
              <div className={styles.menuItemEnd}>
                <div className={`${styles.skeleton} ${styles.skeletonArrow}`}></div>
              </div>
            </div>

            <div className={styles.menuDivider}></div>

            <div className={styles.menuItem}>
              <div className={styles.menuItemStart}>
                <span className={styles.menuIcon}>
                  <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                </span>
                <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '100px' }}></div>
              </div>
              <div className={styles.menuItemEnd}>
                <div className={`${styles.skeleton} ${styles.skeletonArrow}`}></div>
              </div>
            </div>

            <div className={styles.menuDivider}></div>

            <div className={styles.menuItem}>
              <div className={styles.menuItemStart}>
                <span className={styles.menuIcon}>
                  <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                </span>
                <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '120px' }}></div>
              </div>
              <div className={styles.menuItemEnd}>
                <div className={`${styles.skeleton} ${styles.skeletonArrow}`}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Title Skeleton */}
        <h5 className={styles.menuTitle}>سایر</h5>

        {/* Menu Box Skeleton */}
        <div className={styles.menuBox}>
          <div className={styles.menuList}>
            <div className={styles.menuItem}>
              <div className={styles.menuItemStart}>
                <span className={styles.menuIcon}>
                  <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                </span>
                <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '60px' }}></div>
              </div>
              <div className={styles.menuItemEnd}>
                <div className={`${styles.skeleton} ${styles.skeletonArrow}`}></div>
              </div>
            </div>

            <div className={styles.menuDivider}></div>

            <div className={styles.menuItem}>
              <div className={styles.menuItemStart}>
                <span className={styles.menuIcon}>
                  <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                </span>
                <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '90px' }}></div>
              </div>
              <div className={styles.menuItemEnd}>
                <div className={`${styles.skeleton} ${styles.skeletonArrow}`}></div>
              </div>
            </div>

            <div className={styles.menuDivider}></div>

            <div className={styles.menuItem}>
              <div className={styles.menuItemStart}>
                <span className={styles.menuIcon}>
                  <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                </span>
                <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '180px' }}></div>
              </div>
              <div className={styles.menuItemEnd}>
                <div className={`${styles.skeleton} ${styles.skeletonArrow}`}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Section Skeleton - فقط در وب سایت نمایش داده می‌شود */}
        {isInTelegram !== true && (
          <div className={styles.logoutSection}>
            <div className={styles.menuBox}>
              <div className={styles.menuList}>
                <div className={styles.menuItem}>
                  <div className={styles.menuItemStart}>
                    <span className={styles.menuIcon}>
                      <div className={`${styles.skeleton} ${styles.skeletonIcon}`}></div>
                    </span>
                    <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '130px' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.profileInfo}>
          <div className={styles.avatar}>
            <Image src={tgAvatar} alt="avatar" width={56} height={56} />
          </div>
          <div className={styles.profileText}>
            <div className={styles.name}>{tgName}</div>
            <div className={styles.userId}>
              شناسه کاربری: <span>{tgId || user?.id || "ثبت نشده"}</span>
              {tgId && (
                <span className={styles.copyIcon} onClick={copyUserId} title="کپی شناسه">
                  <CopyIcon />
                </span>
              )}
            </div>
          </div>
          <div className={styles.flexSpacer}></div>
          {user?.role && (
            <div 
              className={styles.roleBadge}
              style={{
                backgroundColor: user.role.toLowerCase() === "admin" 
                  ? "var(--role-admin-bg)" 
                  : user.role.toLowerCase() === "merchants" 
                  ? "var(--role-merchant-bg)" 
                  : "var(--role-user-bg)"
              }}
            >
              {user.role.toLowerCase() === "admin" && (
                <AdminIcon 
                  width={16} 
                  height={16} 
                  color="var(--role-admin-color)" 
                  className={styles.roleIcon}
                />
              )}
              {user.role.toLowerCase() === "merchants" && (
                <ColleagueIcon 
                  width={16} 
                  height={16} 
                  color="var(--role-merchant-color)" 
                  className={styles.roleIcon}
                />
              )}
              {user.role.toLowerCase() === "user" && (
                <RegularUserIcon 
                  width={16} 
                  height={16} 
                  color="var(--role-user-color)" 
                  className={styles.roleIcon}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Menu Title */}
      <h5 className={styles.menuTitle}>حساب کاربری</h5>

      {/* Menu Box */}
      <div className={styles.menuBox}>
        <div className={styles.menuList}>
          {/* اطلاعات حساب */}
          <div className={styles.menuItem} onClick={() => router.push("/profile/info")}>
            <div className={styles.menuItemStart}>
              <span className={styles.menuIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path opacity="0.4" d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="1.5"></path>
                  <path d="M14 14H10C7.23858 14 5 16.2386 5 19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19C19 16.2386 16.7614 14 14 14Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"></path>
                </svg>
              </span>
              <span className={styles.menuText}>اطلاعات حساب</span>
            </div>
            <div className={styles.menuItemEnd}>
              <ArrowIcon />
            </div>
          </div>

          <div className={styles.menuDivider}></div>

          {/* کارت های بانکی */}
          <div className={styles.menuItem} onClick={() => router.push("/profile/cards")}>
            <div className={styles.menuItemStart}>
              <span className={styles.menuIcon}>
                <BankCardIcon width={18} height={18} />
              </span>
              <span className={styles.menuText}>کارت های بانکی</span>
            </div>
            <div className={styles.menuItemEnd}>
              <ArrowIcon />
            </div>
          </div>
        </div>
      </div>

      {/* Menu Title */}
      <h5 className={styles.menuTitle}>سفارشات و تاریخچه</h5>

      {/* Menu Box */}
      <div className={styles.menuBox}>
        <div className={styles.menuList}>
          {/* پیگیری سفارش */}
          <div className={styles.menuItem} onClick={() => router.push("/orders/tracking")}>
            <div className={styles.menuItemStart}>
              <span className={styles.menuIcon}>
                <OrderTrackingIcon width={18} height={18} />
              </span>
              <span className={styles.menuText}>پیگیری سفارش</span>
            </div>
            <div className={styles.menuItemEnd}>
              <ArrowIcon />
            </div>
          </div>

          <div className={styles.menuDivider}></div>

          {/* لیست سفارشات */}
          <div className={styles.menuItem} onClick={() => router.push("/orders")}>
            <div className={styles.menuItemStart}>
              <span className={styles.menuIcon}>
                <OrderIcon width={18} height={18} />
              </span>
              <span className={styles.menuText}>لیست سفارشات</span>
            </div>
            <div className={styles.menuItemEnd}>
              <ArrowIcon />
            </div>
          </div>

          <div className={styles.menuDivider}></div>

          {/* تاریخچه شارژ حساب */}
          <div className={styles.menuItem} onClick={() => router.push("/profile/charge-history")}>
            <div className={styles.menuItemStart}>
              <span className={styles.menuIcon}>
                <PaymentHistoryIcon width={18} height={18} />
              </span>
              <span className={styles.menuText}>تاریخچه شارژ حساب</span>
            </div>
            <div className={styles.menuItemEnd}>
              <ArrowIcon />
            </div>
          </div>
        </div>
      </div>

      {/* Menu Title */}
      <h5 className={styles.menuTitle}>سایر</h5>

      {/* Menu Box */}
      <div className={styles.menuBox}>
        <div className={styles.menuList}>
          {/* تم سایت */}
          <div className={styles.menuItem} onClick={() => setIsThemeSheetOpen(true)}>
            <div className={styles.menuItemStart}>
              <span className={styles.menuIcon}>
                <ThemeIcon width={18} height={18} />
              </span>
              <span className={styles.menuText}>تم سایت</span>
            </div>
            <div className={styles.menuItemEnd}>
              <ArrowIcon />
            </div>
          </div>

          <div className={styles.menuDivider}></div>

          {/* همکاری با ما */}
          {user?.role?.toLowerCase() !== 'merchants' ? (
          <div className={styles.menuItem} onClick={() => router.push("/cooperation")}>
            <div className={styles.menuItemStart}>
              <span className={styles.menuIcon}>
                <CollaborationIcon width={18} height={18} />
              </span>
              <span className={styles.menuText}>همکاری با ما</span>
            </div>
            <div className={styles.menuItemEnd}>
              <ArrowIcon />
            </div>
          </div>
          ) : (
            <div className={styles.menuItem} style={{ opacity: 0.6, cursor: 'default' }}>
              <div className={styles.menuItemStart}>
                <span className={styles.menuIcon}>
                  <CollaborationIcon width={18} height={18} />
                </span>
                <span className={styles.menuText}>شما در حال حاضر همکار هستید</span>
              </div>
            </div>
          )}

          <div className={styles.menuDivider}></div>

          {/* وان‌ساب در شبکه های اجتماعی */}
          <div className={styles.menuItem} onClick={() => setIsSocialSheetOpen(true)}>
            <div className={styles.menuItemStart}>
              <span className={styles.menuIcon}>
                <SocialMediaIcon width={18} height={18} />
              </span>
              <span className={styles.menuText}>وان‌ساب در شبکه های اجتماعی</span>
            </div>
            <div className={styles.menuItemEnd}>
              <ArrowIcon />
            </div>
          </div>
        </div>
      </div>

      {/* Logout Button - فقط در وب سایت نمایش داده می‌شود */}
      {isInTelegram !== true && (
        <div className={styles.logoutSection}>
          <div className={styles.menuBox}>
            <div className={styles.menuList}>
              <div className={styles.menuItem} onClick={handleLogout}>
                <div className={styles.menuItemStart}>
                  <span className={styles.menuIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4.39267 4.00087C4 4.61597 4 5.41166 4 7.00304V16.997C4 18.5883 4 19.384 4.39267 19.9991C4.46279 20.109 4.5414 20.2132 4.62777 20.3108C5.11144 20.8572 5.87666 21.0758 7.4071 21.513C8.9414 21.9513 9.70856 22.1704 10.264 21.8417C10.3604 21.7847 10.45 21.7171 10.5313 21.6402C11 21.1965 11 20.3988 11 18.8034V5.19662C11 3.60122 11 2.80351 10.5313 2.35982C10.45 2.28288 10.3604 2.21527 10.264 2.15827C9.70856 1.82956 8.9414 2.0487 7.4071 2.48699C5.87666 2.92418 5.11144 3.14278 4.62777 3.68925C4.5414 3.78684 4.46279 3.89103 4.39267 4.00087Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path opacity="0.4" d="M11 4H13.0171C14.9188 4 15.8696 4 16.4604 4.58579C16.7898 4.91238 16.9355 5.34994 17 6M11 20H13.0171C14.9188 20 15.8696 20 16.4604 19.4142C16.7898 19.0876 16.9355 18.6501 17 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M21 12H14M19.5 9.49994C19.5 9.49994 22 11.3412 22 12C22 12.6588 19.5 14.4999 19.5 14.4999" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </span>
                  <span className={styles.menuText}>خروج از حساب کاربری</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Bottom Sheet */}
      <BottomSheet
        isOpen={isThemeSheetOpen}
        onClose={() => setIsThemeSheetOpen(false)}
        title="انتخاب تم"
        options={[
          {
            value: "auto",
            label: "خودکار",
            icon: <AutoIcon width={18} height={18} />,
          },
          {
            value: "light",
            label: "روشن",
            icon: <LightModeIcon width={18} height={18} />,
          },
          {
            value: "dark",
            label: "تیره",
            icon: <DarkModeIcon width={18} height={18} />,
          },
        ]}
        selectedValue={themeMode}
        onSelect={(value) => handleThemeChange(value as ThemeMode)}
      />

      {/* Social Media Bottom Sheet */}
      <BottomSheet
        isOpen={isSocialSheetOpen}
        onClose={() => setIsSocialSheetOpen(false)}
        title="وان‌ساب در شبکه های اجتماعی"
        options={[
          {
            value: "channel",
            label: "کانال تلگرام وان‌ساب",
            icon: <TelegramIcon width={18} height={18} color="#0088cc" />,
          },
          {
            value: "bot",
            label: "ربات تلگرام وان ساب",
            icon: <TelegramIcon width={18} height={18} color="#0088cc" />,
          },
        ]}
        selectedValue={["channel", "bot"]}
        onSelect={(value) => {
          if (value === "channel") {
            window.open("https://t.me/onesub_ir", "_blank");
          } else if (value === "bot") {
            window.open("https://t.me/onesub_bot", "_blank");
          }
          setIsSocialSheetOpen(false);
        }}
      />
    </div>
  );
}
