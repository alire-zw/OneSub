"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ShopAllHeader from "@/components/ShopAllHeader";
import ChatGPTIcon from "@/components/icons/ChatGPTIcon";
import GeminiIcon from "@/components/icons/GeminiIcon";
import YouTubeIcon from "@/components/icons/YouTubeIcon";
import CapCutIcon from "@/components/icons/CapCutIcon";
import DiscordIcon from "@/components/icons/DiscordIcon";
import IDEIcon from "@/components/icons/IDEIcon";
import SpotifyIcon from "@/components/icons/SpotifyIcon";
import SoundCloudIcon from "@/components/icons/SoundCloudIcon";
import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import styles from './page.module.css';

interface Product {
  id: number;
  productName: string;
  category: string;
  accountType: string;
  duration: number;
  regularPrice: number;
  merchantPrice: number;
  activationTimeMinutes: number;
  activationType: string;
  imagePath?: string;
}

function AllProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSort, setSelectedSort] = useState<'newest' | 'oldest' | 'price-low' | 'price-high' | 'name-asc' | 'name-desc'>('price-low');

  // خواندن دسته‌بندی از query parameter هنگام لود صفحه
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [searchParams]);

  // به‌روزرسانی URL هنگام تغییر دسته‌بندی از طریق UI
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    if (category !== 'all') {
      router.push(`/shop/all?category=${category}`, { scroll: false });
    } else {
      router.push('/shop/all', { scroll: false });
    }
  };

  // تعریف دسته‌بندی‌ها
  const categories = [
    {
      name: "ChatGPT",
      nameFa: "چت جی‌پی‌تی",
      icon: ChatGPTIcon,
      gradient: "linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)", // سبز ChatGPT
    },
    {
      name: "Gemini",
      nameFa: "جمینی",
      icon: GeminiIcon,
      gradient: "linear-gradient(135deg, #4285f4 0%,rgb(168, 166, 52) 50%, #fbbc04 75%,rgb(167, 44, 35) 100%)", // چند رنگه Google
    },
    {
      name: "Cursor",
      nameFa: "کرسر",
      icon: IDEIcon,
      gradient: "linear-gradient(135deg, #1e1e1e 0%, #007acc 100%)", // مشکی و آبی VS Code
    },
    {
      name: "CapCut",
      nameFa: "کپ کات",
      icon: CapCutIcon,
      gradient: "linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)", // آبی گرادیانت
    },
    {
      name: "Discord",
      nameFa: "دیسکورد",
      icon: DiscordIcon,
      gradient: "linear-gradient(135deg, #5865f2 0%, #7289da 100%)", // بنفش Discord
    },
    {
      name: "Youtube",
      nameFa: "یوتیوب",
      icon: YouTubeIcon,
      gradient: "linear-gradient(135deg, #ff0000 0%, #cc0000 50%, #990000 100%)", // قرمز گرادیانت
    },
    {
      name: "Spotify",
      nameFa: "اسپاتیفای",
      icon: SpotifyIcon,
      gradient: "linear-gradient(135deg, #1db954 0%, #1ed760 50%, #1db954 100%)", // سبز Spotify
    },
    {
      name: "SoundCloud",
      nameFa: "ساندکلاد",
      icon: SoundCloudIcon,
      gradient: "linear-gradient(135deg, #ff7700 0%, #ff5500 50%, #ff3300 100%)", // نارنجی/قرمز SoundCloud
    },
  ];

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // بررسی cache در localStorage
        const cacheKey = 'shop_products_cache';
        const cacheData = localStorage.getItem(cacheKey);
        
        if (cacheData) {
          try {
            const parsedCache = JSON.parse(cacheData);
            const cacheTime = parsedCache.timestamp;
            const now = Date.now();
            const cacheAge = now - cacheTime;
            const CACHE_DURATION = 15 * 60 * 1000; // 15 دقیقه
            
            // اگر cache هنوز معتبر است (کمتر از 15 دقیقه)
            if (cacheAge < CACHE_DURATION) {
              setProducts(parsedCache.data);
              setProductsLoading(false);
              // ادامه می‌دهیم تا cache را در background به‌روز کنیم
            }
          } catch (e) {
            // اگر cache معتبر نبود، ادامه می‌دهیم
          }
        }

        const response = await fetch(`${API_ENDPOINTS.PRODUCTS.LIST}?isActive=true`);
        const data = await response.json();
        if (data.status === 1 && data.data) {
          // ذخیره در localStorage
          localStorage.setItem(cacheKey, JSON.stringify({
            data: data.data,
            timestamp: Date.now()
          }));
          
          setProducts(data.data);
          setProductsLoading(false);
        } else {
          setProductsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, []);

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
    } else {
      if (remainingDays > 0) {
        return `${months} ماه و ${remainingDays} روز`;
      }
      return `${months} ماه`;
    }
  };

  // فیلتر کردن محصولات بر اساس دسته‌بندی و جستجو
  const filteredProducts = products.filter((product: Product) => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      product.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // مرتب‌سازی محصولات
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (selectedSort) {
      case 'newest':
        // فرض می‌کنیم که id بالاتر = جدیدتر
        return b.id - a.id;
      case 'oldest':
        return a.id - b.id;
      case 'price-low':
        return a.regularPrice - b.regularPrice;
      case 'price-high':
        return b.regularPrice - a.regularPrice;
      case 'name-asc':
        return a.productName.localeCompare(b.productName, 'fa');
      case 'name-desc':
        return b.productName.localeCompare(a.productName, 'fa');
      default:
        return 0;
    }
  });

  return (
    <div className="pb-20">
      {/* هدر یکپارچه */}
      <ShopAllHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
        categories={categories}
      />

      <div className={styles.productsContainer}>

      {/* لیست محصولات */}
      {productsLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-md overflow-hidden flex gap-2 p-2 pb-2.5 items-end animate-pulse"
            >
              <div className="w-14 h-14 flex-shrink-0 rounded bg-background-secondary" />
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <div className="h-3 bg-background-secondary rounded flex-1" />
                    <div className="h-3 w-8 bg-background-secondary rounded" />
                  </div>
                  <div className="h-3 w-16 bg-background-secondary rounded" />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <div className="h-2.5 bg-background-secondary rounded w-20" />
                    <div className="h-2.5 bg-background-secondary rounded w-24" />
                  </div>
                  <div className="h-6 w-20 bg-background-secondary rounded flex-shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
        ) : sortedProducts.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-foreground-muted">محصولی یافت نشد</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => router.push(`/shop/product/${product.id}`)}
              className="bg-card border border-border rounded-md overflow-hidden flex gap-2 p-2 pb-2.5 items-end cursor-pointer hover:border-primary transition-colors"
            >
              {/* عکس محصول در راست */}
              {product.imagePath ? (
                <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden">
                  <img
                    src={`${API_BASE_URL}${product.imagePath}`}
                    alt={product.productName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 flex-shrink-0 rounded bg-background-secondary border border-border flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
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

              {/* محتوای محصول */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* خط اول: نام | مدت زمان (چپ) و قیمت (راست) */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <h3 className="text-xs font-medium text-foreground truncate">
                      {product.productName}
                    </h3>
                    <span className="text-xs text-foreground-muted">|</span>
                    <span className="text-xs text-foreground-muted whitespace-nowrap">
                      {formatDuration(product.duration)}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">
                    {formatPrice(user?.role?.toLowerCase() === "merchants" ? product.merchantPrice : product.regularPrice)} تومان
                  </span>
                </div>

                {/* خط دوم: اطلاعات محصول (چپ) و دکمه خرید (راست) */}
                <div className="flex items-end justify-between gap-2">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
                      <span>{product.accountType}</span>
                      {product.activationTimeMinutes > 0 && (
                        <>
                          <span>•</span>
                          <span>فعالسازی: {product.activationTimeMinutes} دقیقه</span>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-foreground-muted">
                      <span>نوع فعالسازی: {product.activationType}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/shop/product/${product.id}`);
                    }}
                    className="bg-primary text-white px-3 py-1.5 rounded-md hover:bg-primary-hover transition-colors text-xs font-medium whitespace-nowrap flex-shrink-0"
                  >
                    خرید محصول
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

export default function AllProductsPage() {
  return (
    <Suspense fallback={
      <div className="pb-20">
        <div className={styles.productsContainer}>
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-md overflow-hidden flex gap-2 p-2 pb-2.5 items-end animate-pulse"
              >
                <div className="w-14 h-14 flex-shrink-0 rounded bg-background-secondary" />
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-1">
                      <div className="h-3 bg-background-secondary rounded flex-1" />
                      <div className="h-3 w-8 bg-background-secondary rounded" />
                    </div>
                    <div className="h-3 w-16 bg-background-secondary rounded" />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="flex flex-col gap-0.5 flex-1">
                      <div className="h-2.5 bg-background-secondary rounded w-20" />
                      <div className="h-2.5 bg-background-secondary rounded w-24" />
                    </div>
                    <div className="h-6 w-20 bg-background-secondary rounded flex-shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <AllProductsPageContent />
    </Suspense>
  );
}

