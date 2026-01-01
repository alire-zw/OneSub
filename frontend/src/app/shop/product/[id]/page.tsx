"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { isTelegramWebApp } from "@/utils/telegram";
import ChatGPTIcon from "@/components/icons/ChatGPTIcon";
import GeminiIcon from "@/components/icons/GeminiIcon";
import YouTubeIcon from "@/components/icons/YouTubeIcon";
import CapCutIcon from "@/components/icons/CapCutIcon";
import DiscordIcon from "@/components/icons/DiscordIcon";
import IDEIcon from "@/components/icons/IDEIcon";
import SpotifyIcon from "@/components/icons/SpotifyIcon";
import SoundCloudIcon from "@/components/icons/SoundCloudIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import SafeDeliveryIcon from "@/components/icons/SafeDeliveryIcon";
import AlertSquareIcon from "@/components/icons/AlertSquareIcon";
import AlertTriangleIcon from "@/components/icons/AlertTriangleIcon";
import AlertDiamondIcon from "@/components/icons/AlertDiamondIcon";
import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import styles from './page.module.css';

interface Product {
  id: number;
  productName: string;
  category: string;
  accountType: string;
  duration: number;
  purchasePrice: number;
  regularPrice: number;
  merchantPrice: number;
  activationTimeMinutes: number;
  activationType: string;
  imagePath?: string;
  additionalInfo?: string;
  noteType?: 'info' | 'warning' | 'note';
  noteText?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const productId = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shouldApplySpacing, setShouldApplySpacing] = useState(false);

  // محاسبه safe area spacing مشابه mobile navbar
  useEffect(() => {
    if (typeof window !== "undefined") {
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const inTelegram = isTelegramWebApp();
      // فقط در iOS و داخل مینی‌اپ تلگرام فاصله اعمال شود
      setShouldApplySpacing(iOS && inTelegram);
    }
  }, []);

  // تعریف دسته‌بندی‌ها
  const categories = [
    {
      name: "ChatGPT",
      nameFa: "چت جی‌پی‌تی",
      icon: ChatGPTIcon,
      gradient: "linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)",
    },
    {
      name: "Gemini",
      nameFa: "جمینی",
      icon: GeminiIcon,
      gradient: "linear-gradient(135deg, #4285f4 0%,rgb(168, 166, 52) 50%, #fbbc04 75%,rgb(167, 44, 35) 100%)",
    },
    {
      name: "Cursor",
      nameFa: "کرسر",
      icon: IDEIcon,
      gradient: "linear-gradient(135deg, #1e1e1e 0%, #007acc 100%)",
    },
    {
      name: "CapCut",
      nameFa: "کپ کات",
      icon: CapCutIcon,
      gradient: "linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)",
    },
    {
      name: "Discord",
      nameFa: "دیسکورد",
      icon: DiscordIcon,
      gradient: "linear-gradient(135deg, #5865f2 0%, #7289da 100%)",
    },
    {
      name: "Youtube",
      nameFa: "یوتیوب",
      icon: YouTubeIcon,
      gradient: "linear-gradient(135deg, #ff0000 0%, #cc0000 50%, #990000 100%)",
    },
    {
      name: "Spotify",
      nameFa: "اسپاتیفای",
      icon: SpotifyIcon,
      gradient: "linear-gradient(135deg, #1db954 0%, #1ed760 50%, #1db954 100%)",
    },
    {
      name: "SoundCloud",
      nameFa: "ساندکلاد",
      icon: SoundCloudIcon,
      gradient: "linear-gradient(135deg, #ff7700 0%, #ff5500 50%, #ff3300 100%)",
    },
  ];

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(API_ENDPOINTS.PRODUCTS.GET(productId));
        const data = await response.json();

        if (data.status === 1 && data.data) {
          setProduct(data.data);
        } else {
          setError(data.message || "محصول یافت نشد");
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        setError("خطا در بارگذاری محصول");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price);
  };

  const formatDuration = (days: number) => {
    if (days < 30) {
      return `${days} روز`;
    }
    
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      
      if (remainingMonths > 0) {
        return `${years} سال و ${remainingMonths} ماه`;
      }
      return `${years} سال`;
    }
    
    if (remainingDays > 0) {
      return `${months} ماه و ${remainingDays} روز`;
    }
    return `${months} ماه`;
  };

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        {/* هدر */}
        <PageHeader title="در حال بارگذاری..." />

        {/* Skeleton Loading */}
        <div className={styles.container}>
          {/* بخش اول: تصویر و نام محصول */}
          <div className={styles.productHeader}>
            {/* Skeleton تصویر محصول */}
            <div className={styles.imageContainer}>
              <div className={`${styles.placeholderImage} bg-background-secondary animate-pulse`} />
            </div>

            {/* Skeleton نام محصول */}
            <div className={styles.headerSection}>
              {/* Skeleton دسته‌بندی */}
              <div className={`${styles.categoryContainer} animate-pulse`}>
                <div className="h-3 w-16 bg-background-secondary rounded" />
                <div className="w-4 h-4 bg-background-secondary rounded" />
                <div className="h-3 w-20 bg-background-secondary rounded" />
              </div>
              {/* Skeleton نام محصول */}
              <div className="h-5 w-3/4 bg-background-secondary rounded animate-pulse mb-2" />
              {/* Skeleton مدت اشتراک */}
              <div className={`${styles.durationContainer} animate-pulse`}>
                <div className="w-3.5 h-3.5 bg-background-secondary rounded" />
                <div className="h-3 w-20 bg-background-secondary rounded" />
                <div className="h-3 w-16 bg-background-secondary rounded" />
              </div>
              {/* Skeleton قیمت */}
              <div className={`${styles.priceContainer} animate-pulse`}>
                <div className="h-3 w-10 bg-background-secondary rounded" />
                <div className="h-5 w-24 bg-background-secondary rounded" />
              </div>
            </div>
          </div>

          {/* Skeleton اطلاعات محصول */}
          <div className={styles.productInfo}>
            {/* Skeleton نوع حساب و نوع فعالسازی */}
            <div className={styles.fieldGroup}>
              <div className={styles.fieldContainer}>
                <div className={styles.fieldWrapper}>
                  <div className="h-3 w-16 bg-background-secondary rounded animate-pulse mb-1" />
                  <div className={`${styles.fieldItem} bg-background-secondary animate-pulse`}>
                    <div className="h-4 w-20 bg-background rounded" />
                  </div>
                </div>
                <div className={styles.fieldWrapper}>
                  <div className="h-3 w-20 bg-background-secondary rounded animate-pulse mb-1" />
                  <div className={`${styles.fieldItem} bg-background-secondary animate-pulse`}>
                    <div className="h-4 w-24 bg-background rounded" />
                  </div>
                </div>
              </div>
            </div>

            {/* Skeleton زمان فعالسازی */}
            <div className={`${styles.infoRow} bg-background-secondary animate-pulse`}>
              <div className={styles.infoLabelContainer}>
                <div className="w-3.5 h-3.5 bg-background rounded" />
                <div className="h-3 w-40 bg-background rounded" />
              </div>
              <div className="h-3 w-12 bg-background rounded" />
            </div>

            {/* Skeleton اطلاعات بیشتر */}
            <div className={styles.additionalInfoWrapper}>
              <div className="h-3 w-24 bg-background-secondary rounded animate-pulse mb-1" />
              <div className={`${styles.additionalInfo} bg-background-secondary animate-pulse`}>
                <div className="h-4 w-full bg-background rounded mb-1" />
                <div className="h-4 w-3/4 bg-background rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton دکمه خرید ثابت */}
        <div className={styles.buyButtonFixedContainer}>
          <div className={`${styles.buyButton} bg-background-secondary animate-pulse`}>
            <div className="h-5 w-32 bg-background rounded mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="pb-20">
        {/* هدر */}
        <PageHeader title="خطا" />

        <div className="px-4 py-8 text-center">
          <p className="text-sm text-foreground-muted">{error || "محصول یافت نشد"}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-sm text-primary hover:text-primary-hover"
          >
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      {/* هدر */}
      <PageHeader title="اطلاعات محصول" />

      <div className={styles.container}>
        {/* بخش اول: تصویر و نام محصول */}
        <div className={styles.productHeader}>
          {/* تصویر محصول */}
          <div className={styles.imageContainer}>
            {product.imagePath ? (
              <img
                src={`${API_BASE_URL}${product.imagePath}`}
                alt={product.productName}
                className={styles.productImage}
              />
            ) : (
              <div className={styles.placeholderImage}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-foreground-muted"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
            )}
          </div>

          {/* نام محصول */}
          <div className={styles.headerSection}>
            {/* دسته‌بندی */}
            {(() => {
              const categoryInfo = categories.find(cat => cat.name === product.category);
              if (!categoryInfo) return null;
              const IconComponent = categoryInfo.icon;
              return (
                <div className={styles.categoryContainer}>
                  <span className={styles.categoryLabel}>دسته‌بندی:</span>
                  <IconComponent width={16} height={16} color="var(--foreground-secondary)" />
                  <span className={styles.categoryText}>{categoryInfo.nameFa}</span>
                </div>
              );
            })()}
            <h1 className={styles.productName}>{product.productName}</h1>
            <div className={styles.durationContainer}>
              <CalendarIcon width={14} height={14} color="var(--foreground-secondary)" />
              <span className={styles.durationLabel}>مدت اشتراک:</span>
              <span className={styles.durationText}>
                {formatDuration(product.duration)}
              </span>
            </div>
            <div className={styles.priceContainer}>
              <span className={styles.priceLabel}>قیمت</span>
              <span className={styles.productPrice}>
                {formatPrice(user?.role?.toLowerCase() === "merchants" ? product.merchantPrice : product.regularPrice)} تومان
              </span>
            </div>
          </div>
        </div>

        {/* اطلاعات محصول */}
        <div className={styles.productInfo}>

          {/* نوع حساب و نوع فعالسازی */}
          <div className={styles.fieldGroup}>
            <div className={styles.fieldContainer}>
              <div className={styles.fieldWrapper}>
                <label className={styles.fieldLabel}>نوع حساب:</label>
                <div className={styles.fieldItem}>
                  <span className={styles.fieldItemValue}>{product.accountType}</span>
                </div>
              </div>
              <div className={styles.fieldWrapper}>
                <label className={styles.fieldLabel}>نوع فعالسازی:</label>
                <div className={styles.fieldItem}>
                  <span className={styles.fieldItemValue}>{product.activationType}</span>
                </div>
              </div>
            </div>
          </div>

          {/* زمان فعالسازی */}
          {product.activationTimeMinutes > 0 && (
            <div className={styles.infoRow}>
              <div className={styles.infoLabelContainer}>
                <SafeDeliveryIcon width={14} height={14} className={styles.infoIcon} />
                <span className={styles.infoLabel}>زمان فعالسازی اکانت توسط سایت:</span>
              </div>
              <span className={styles.infoValue}>
                {product.activationTimeMinutes} دقیقه
              </span>
            </div>
          )}

          {/* نکات محصول */}
          {product.noteType && product.noteText && (
            <div className={styles.noteWrapper}>
              <label className={`${styles.noteLabel} ${styles[`noteLabel${product.noteType.charAt(0).toUpperCase() + product.noteType.slice(1)}`]}`}>
                {product.noteType === 'info' && (
                  <AlertSquareIcon width={14} height={14} className={styles.noteLabelIcon} color="currentColor" />
                )}
                {product.noteType === 'warning' && (
                  <AlertTriangleIcon width={14} height={14} className={styles.noteLabelIcon} color="currentColor" />
                )}
                {product.noteType === 'note' && (
                  <AlertDiamondIcon width={14} height={14} className={styles.noteLabelIcon} color="currentColor" />
                )}
                {product.noteType === 'info' && 'اطلاعات'}
                {product.noteType === 'warning' && 'هشدار'}
                {product.noteType === 'note' && 'نکته'}
              </label>
              <div className={`${styles.noteBox} ${styles[`noteBox${product.noteType.charAt(0).toUpperCase() + product.noteType.slice(1)}`]}`}>
                <p className={styles.noteText}>{product.noteText}</p>
              </div>
            </div>
          )}

          {/* اطلاعات اضافی */}
          {product.additionalInfo && (
            <div className={styles.additionalInfoWrapper}>
              <label className={styles.additionalInfoLabel}>اطلاعات بیشتر:</label>
              <div className={styles.additionalInfo}>
                <p className={styles.additionalInfoText}>{product.additionalInfo}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* دکمه خرید ثابت */}
      <div 
        className={styles.buyButtonFixedContainer}
        style={
          shouldApplySpacing
            ? {
                paddingBottom: "max(2rem, env(safe-area-inset-bottom) + 0.5rem)",
              }
            : {}
        }
      >
        <button
          onClick={() => {
            router.push(`/shop/product/${product.id}/buy`);
          }}
          className={styles.buyButton}
        >
          {product.productName && product.productName.includes("خرید")
            ? product.productName
            : `خرید ${product.productName}`}
        </button>
      </div>
    </div>
  );
}

