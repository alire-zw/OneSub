"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import SearchIcon from "@/components/icons/SearchIcon";
import ArrowLeftIcon from "@/components/icons/ArrowLeftIcon";
import ChatGPTIcon from "@/components/icons/ChatGPTIcon";
import GeminiIcon from "@/components/icons/GeminiIcon";
import YouTubeIcon from "@/components/icons/YouTubeIcon";
import CapCutIcon from "@/components/icons/CapCutIcon";
import DiscordIcon from "@/components/icons/DiscordIcon";
import IDEIcon from "@/components/icons/IDEIcon";
import SpotifyIcon from "@/components/icons/SpotifyIcon";
import SoundCloudIcon from "@/components/icons/SoundCloudIcon";
import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import { useTelegramRegister } from "@/hooks/useTelegramRegister";
import { useAuth } from "@/hooks/useAuth";

// ارتفاع فیلد جستجو (بین 32px هدر و 44px قبلی)
const SEARCH_HEIGHT = '38px';

interface Banner {
  id: number;
  imagePath: string;
  linkType: 'product' | 'category';
  linkId: number | null;
  linkValue: string | null;
  displayOrder: number;
}

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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ShopPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isRegistering, registerStatus } = useTelegramRegister();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        // بررسی cache در localStorage
        const cacheKey = 'shop_banners_cache';
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
              const sortedBanners = parsedCache.data
                .filter((b: Banner) => b.displayOrder <= 3)
                .sort((a: Banner, b: Banner) => a.displayOrder - b.displayOrder);
              setBanners(sortedBanners);
              setBannersLoading(false);
              // ادامه می‌دهیم تا cache را در background به‌روز کنیم
            }
          } catch (e) {
            // اگر cache معتبر نبود، ادامه می‌دهیم
          }
        }

        const response = await fetch(API_ENDPOINTS.BANNERS.LIST);
        const data = await response.json();
        if (data.status === 1 && data.data) {
          // مرتب‌سازی بر اساس displayOrder و فقط 3 بنر اول
          const sortedBanners = data.data
            .filter((b: Banner) => b.displayOrder <= 3)
            .sort((a: Banner, b: Banner) => a.displayOrder - b.displayOrder);
          
          // ذخیره در localStorage
          localStorage.setItem(cacheKey, JSON.stringify({
            data: data.data,
            timestamp: Date.now()
          }));
          
          setBanners(sortedBanners);
          setBannersLoading(false);
        } else {
          setBannersLoading(false);
        }
      } catch (error) {
        console.error("Error fetching banners:", error);
        setBannersLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // فیلتر محصولات بر اساس جستجو
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts([]);
      setShowSearchResults(false);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = products.filter((product) => {
      const nameMatch = product.productName?.toLowerCase().includes(query);
      const categoryMatch = product.category?.toLowerCase().includes(query);
      const accountTypeMatch = product.accountType?.toLowerCase().includes(query);
      return nameMatch || categoryMatch || accountTypeMatch;
    });

    setFilteredProducts(filtered);
    setShowSearchResults(true);
  }, [searchQuery, products]);

  // بستن نتایج جستجو هنگام کلیک خارج از آن
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // بارگذاری محصولات
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
              // تصادفی کردن ترتیب محصولات
              const shuffled = [...parsedCache.data].sort(() => Math.random() - 0.5);
              setProducts(shuffled);
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
          // تصادفی کردن ترتیب محصولات
          const shuffled = [...data.data].sort(() => Math.random() - 0.5);
          
          // ذخیره در localStorage
          localStorage.setItem(cacheKey, JSON.stringify({
            data: data.data,
            timestamp: Date.now()
          }));
          
          setProducts(shuffled);
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
    
    // تبدیل به ماه
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    
    // اگر 12 ماه یا بیشتر شد، تبدیل به سال
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      
      if (remainingMonths > 0) {
        return `${years} سال و ${remainingMonths} ماه`;
      }
      return `${years} سال`;
    }
    
    // کمتر از 12 ماه
    if (remainingDays > 0) {
      return `${months} ماه و ${remainingDays} روز`;
    }
    return `${months} ماه`;
  };

  const handleBannerClick = (banner: Banner) => {
    if (banner.linkType === 'product' && banner.linkId) {
      router.push(`/shop/product/${banner.linkId}`);
    } else if (banner.linkType === 'category' && banner.linkValue) {
      router.push(`/shop/category/${banner.linkValue}`);
    }
  };

  const getBannerByOrder = (order: number) => {
    return banners.find(b => b.displayOrder === order);
  };

  const banner1 = getBannerByOrder(1); // بنر بزرگ سمت چپ
  const banner2 = getBannerByOrder(2); // بنر کوچک بالایی سمت راست
  const banner3 = getBannerByOrder(3); // بنر کوچک پایینی سمت راست

  // تعریف دسته‌بندی‌ها با ایکون و گرادیان
  const categories = [
    {
      name: "ChatGPT",
      nameFa: "چت جی‌پی‌تی",
      icon: ChatGPTIcon,
      gradient: "linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)", // سبز ChatGPT
      isActive: true,
    },
    {
      name: "Gemini",
      nameFa: "جمینی",
      icon: GeminiIcon,
      gradient: "linear-gradient(135deg, #4285f4 0%,rgb(168, 166, 52) 50%, #fbbc04 75%,rgb(167, 44, 35) 100%)", // چند رنگه Google (آبی، سبز، زرد، قرمز)
      isActive: true,
    },
    {
      name: "Cursor",
      nameFa: "کرسر",
      icon: IDEIcon,
      gradient: "linear-gradient(135deg, #1e1e1e 0%, #007acc 100%)", // مشکی و آبی VS Code
      isActive: false,
    },
    {
      name: "CapCut",
      nameFa: "کپ کات",
      icon: CapCutIcon,
      gradient: "linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)", // آبی گرادیانت‌تر
      isActive: false,
    },
    {
      name: "Discord",
      nameFa: "دیسکورد",
      icon: DiscordIcon,
      gradient: "linear-gradient(135deg, #5865f2 0%, #7289da 100%)", // بنفش Discord
      isActive: false,
    },
    {
      name: "Youtube",
      nameFa: "یوتیوب",
      icon: YouTubeIcon,
      gradient: "linear-gradient(135deg, #ff0000 0%, #cc0000 50%, #990000 100%)", // قرمز گرادیانت قوی
      isActive: false,
    },
    {
      name: "Spotify",
      nameFa: "اسپاتیفای",
      icon: SpotifyIcon,
      gradient: "linear-gradient(135deg, #1db954 0%, #1ed760 50%, #1db954 100%)", // سبز Spotify گرادیانت
      isActive: false,
    },
    {
      name: "SandCloud",
      nameFa: "ساند کلاد",
      icon: SoundCloudIcon,
      gradient: "linear-gradient(135deg, #ff7700 0%, #ff5500 50%, #ff3300 100%)", // نارنجی/قرمز SandCloud
      isActive: false,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-3 pb-20">
      {/* فیلد جستجو */}
      <div className="relative mb-3">
        <div className="flex items-center gap-2">
          {/* فیلد جستجو */}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim() && filteredProducts.length > 0) {
                setShowSearchResults(true);
              }
            }}
            placeholder="جستجو..."
            dir="rtl"
            className="flex-1 bg-card border border-border rounded-md px-3 py-0 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            style={{ height: SEARCH_HEIGHT }}
          />
          
          {/* دکمه جستجو */}
          <button
            className="bg-primary border border-primary rounded-md hover:bg-primary-hover transition-colors flex items-center justify-center text-white"
            style={{ width: SEARCH_HEIGHT, height: SEARCH_HEIGHT }}
            aria-label="جستجو"
          >
            <SearchIcon 
              width={18} 
              height={18} 
              className="w-[18px] h-[18px]" 
              color="white"
            />
          </button>
        </div>

        {/* نتایج جستجو */}
        {showSearchResults && searchQuery.trim() && (
          <div
            ref={searchResultsRef}
            className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-md shadow-lg max-h-[400px] overflow-y-auto z-50"
          >
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-sm text-foreground-muted">
                محصولی یافت نشد
              </div>
            ) : (
              <div className="py-1">
                {filteredProducts.map((product) => {
                  const productPrice = user?.role?.toLowerCase() === "merchants" ? product.merchantPrice : product.regularPrice;
                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        router.push(`/shop/product/${product.id}`);
                        setSearchQuery("");
                        setShowSearchResults(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-background-secondary cursor-pointer transition-colors border-b border-border last:border-b-0"
                    >
                      {/* تصویر محصول */}
                      {product.imagePath ? (
                        <div className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-background-secondary">
                          <img
                            src={`${API_BASE_URL}${product.imagePath}`}
                            alt={product.productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 flex-shrink-0 rounded-md bg-background-secondary flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
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
                      
                      {/* اطلاعات محصول */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-foreground truncate">
                          {product.productName}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-foreground-muted">
                            {formatDuration(product.duration)}
                          </span>
                          <span className="text-xs text-foreground-muted">•</span>
                          <span className="text-xs text-foreground-muted">
                            {product.accountType}
                          </span>
                        </div>
                      </div>

                      {/* قیمت در سمت چپ */}
                      <div className="flex-shrink-0">
                        <span className="text-sm font-medium text-foreground whitespace-nowrap">
                          {formatPrice(productPrice)} تومان
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* بخش بنرها */}
      {bannersLoading ? (
        <div className="flex gap-1.5 mb-3 items-start">
          {/* Skeleton بنر 1 */}
          <div 
            className="flex-1 rounded-md bg-background-secondary animate-pulse"
            style={{ height: '140px' }}
          />
          {/* Skeleton بنرهای 2 و 3 */}
          <div className="flex flex-col gap-1.5 flex-shrink-0" style={{ height: '140px' }}>
            <div 
              className="rounded-md bg-background-secondary animate-pulse flex-shrink-0"
              style={{ 
                height: 'calc((140px - 6px) / 2)',
                width: 'calc((140px - 6px) / 2)',
                aspectRatio: '1 / 1'
              }}
            />
            <div 
              className="rounded-md bg-background-secondary animate-pulse flex-shrink-0"
              style={{ 
                height: 'calc((140px - 6px) / 2)',
                width: 'calc((140px - 6px) / 2)',
                aspectRatio: '1 / 1'
              }}
            />
          </div>
        </div>
      ) : (banner1 || banner2 || banner3) && (
        <div className="flex gap-1.5 mb-3 items-start">
          {/* بنر 1 - مستطیل که کشیده می‌شود */}
          {banner1 && (
            <div 
              className="flex-1 cursor-pointer rounded-md overflow-hidden"
              onClick={() => handleBannerClick(banner1)}
              style={{ height: '140px' }}
            >
              <img
                src={`${API_BASE_URL}${banner1.imagePath}`}
                alt="Banner 1"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* بنرهای 2 و 3 - دو مربع روی هم سمت چپ */}
          <div className="flex flex-col gap-1.5 flex-shrink-0" style={{ height: '140px' }}>
            {banner2 && (
              <div 
                className="cursor-pointer rounded-md overflow-hidden flex-shrink-0"
                onClick={() => handleBannerClick(banner2)}
                style={{ 
                  height: 'calc((140px - 6px) / 2)',
                  width: 'calc((140px - 6px) / 2)',
                  aspectRatio: '1 / 1'
                }}
              >
                <img
                  src={`${API_BASE_URL}${banner2.imagePath}`}
                  alt="Banner 2"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {banner3 && (
              <div 
                className="cursor-pointer rounded-md overflow-hidden flex-shrink-0"
                onClick={() => handleBannerClick(banner3)}
                style={{ 
                  height: 'calc((140px - 6px) / 2)',
                  width: 'calc((140px - 6px) / 2)',
                  aspectRatio: '1 / 1'
                }}
              >
                <img
                  src={`${API_BASE_URL}${banner3.imagePath}`}
                  alt="Banner 3"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* بخش دسته‌بندی‌ها */}
      <div className="mt-4 mb-3">
        <h2 className="text-sm font-medium text-foreground mb-3">دسته بندی ها</h2>
        
        {/* Grid دو ردیفه دسته‌بندی‌ها */}
        <div className="grid grid-cols-4 gap-3">
            {categories.map((category) => {
              const IconComponent = category.icon;
              return (
                <div
                  key={category.name}
                  className="flex flex-col items-center gap-1.5 relative"
                >
                  {/* مربع با گرادیان و ایکون */}
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm relative ${
                      category.isActive ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                    }`}
                    style={{ background: category.gradient }}
                    onClick={() => {
                      if (category.isActive) {
                        router.push(`/shop/all?category=${category.name}`);
                      }
                    }}
                  >
                    <IconComponent width={24} height={24} color="white" />
                    {/* تگ "به زودی" برای دسته‌بندی‌های غیرفعال */}
                    {!category.isActive && (
                      <div className="absolute top-0 right-0 z-10 bg-foreground text-background px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg text-[8px] font-medium whitespace-nowrap">
                        به زودی
                      </div>
                    )}
                  </div>
                  {/* نام دسته‌بندی فارسی */}
                  <span className={`text-[10px] text-center leading-tight ${
                    category.isActive ? 'text-foreground' : 'text-foreground-muted'
                  }`}>
                    {category.nameFa}
                  </span>
                </div>
              );
            })}
          </div>
      </div>

      {/* بخش محصولات */}
      <div className="mt-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-foreground">محصولات</h2>
          <Link
            href="/shop/all"
            className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
          >
            <span>مشاهده همه</span>
            <ArrowLeftIcon width={14} height={14} color="var(--primary)" />
          </Link>
        </div>
        
        {/* لیست محصولات */}
        {productsLoading ? (
          <div 
            className="grid grid-rows-2 grid-flow-col gap-2 overflow-x-auto pb-2 -mx-4 px-4 hide-scrollbar"
            style={{
              gridAutoColumns: 'calc(100% - 4px)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {/* Skeleton محصولات - 4 عدد برای نمایش */}
            {[1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-md overflow-hidden flex gap-2 p-2 pb-2.5 items-end animate-pulse"
              >
                {/* Skeleton عکس */}
                <div className="w-14 h-14 flex-shrink-0 rounded bg-background-secondary" />
                
                {/* Skeleton محتوا */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Skeleton خط اول */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-1">
                      <div className="h-3 bg-background-secondary rounded flex-1" />
                      <div className="h-3 w-8 bg-background-secondary rounded" />
                    </div>
                    <div className="h-3 w-16 bg-background-secondary rounded" />
                  </div>
                  
                  {/* Skeleton خط دوم */}
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
        ) : products.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-foreground-muted">محصولی یافت نشد</p>
          </div>
        ) : (
          <div 
            ref={scrollContainerRef}
            className="grid grid-rows-2 grid-flow-col gap-2 overflow-x-auto pb-2 -mx-4 px-4 hide-scrollbar cursor-grab active:cursor-grabbing select-none"
            style={{
              gridAutoColumns: 'calc(100% - 4px)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
            onMouseDown={(e) => {
              if (!scrollContainerRef.current) return;
              setIsDragging(true);
              setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
              setScrollLeft(scrollContainerRef.current.scrollLeft);
            }}
            onMouseLeave={() => {
              setIsDragging(false);
            }}
            onMouseUp={() => {
              setIsDragging(false);
            }}
            onMouseMove={(e) => {
              if (!isDragging || !scrollContainerRef.current) return;
              e.preventDefault();
              const x = e.pageX - scrollContainerRef.current.offsetLeft;
              const walk = (x - startX) * 2; // سرعت اسکرول
              scrollContainerRef.current.scrollLeft = scrollLeft - walk;
            }}
          >
            {products.map((product) => (
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
