"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SearchIcon from "@/components/icons/SearchIcon";
import ArrowBackIcon from "@/components/icons/ArrowBackIcon";
import FilterIcon from "@/components/icons/FilterIcon";
import MoneyBagIcon from "@/components/icons/MoneyBagIcon";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import styles from './ShopAllHeader.module.css';

const BOX_SIZE = '32px';

type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'name-asc' | 'name-desc';

interface ShopAllHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  categories: Array<{
    name: string;
    nameFa: string;
    icon: React.ComponentType<any>;
    gradient?: string;
  }>;
}

const SEARCH_HEIGHT = '38px';

export default function ShopAllHeader({ 
  searchQuery,
  onSearchChange, 
  selectedCategory,
  onCategoryChange,
  selectedSort,
  onSortChange,
  categories
}: ShopAllHeaderProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  
  // Drag to scroll
  const filterContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

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

  // بستن منوی فیلتر با کلیک خارج از آن
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };

    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterMenuOpen]);

  // Drag to scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!filterContainerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - filterContainerRef.current.offsetLeft;
    scrollLeft.current = filterContainerRef.current.scrollLeft;
    filterContainerRef.current.style.cursor = 'grabbing';
    filterContainerRef.current.style.userSelect = 'none';
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !filterContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - filterContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 2; // Scroll speed multiplier
    filterContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleMouseUp = () => {
    if (!filterContainerRef.current) return;
    isDragging.current = false;
    filterContainerRef.current.style.cursor = 'grab';
    filterContainerRef.current.style.userSelect = 'auto';
  };

  return (
    <header className={styles.header}>
      {/* دکمه بازگشت و عنوان */}
      <div className={styles.topBar}>
        <Link href="/shop" className={styles.backButton} aria-label="بازگشت به فروشگاه">
          <ArrowBackIcon width={20} height={20} />
        </Link>
        <Link href="/shop" className={styles.title}>فروشگاه</Link>
        <div className={styles.topBarRight}>
          {/* باکس موجودی کاربر - فقط برای کاربران لاگین شده */}
          {isAuthenticated && (
            <button
              onClick={() => router.push("/wallet")}
              className={`${styles.walletButton} ${
                walletBalance !== null && walletBalance === 0
                  ? styles.walletButtonEmpty
                  : ''
              }`}
              style={{ height: BOX_SIZE }}
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
          <div className={styles.filterButtonWrapper} ref={filterMenuRef}>
          <button
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
            className={`${styles.filterToggleButton} ${isFilterMenuOpen ? styles.filterToggleButtonActive : ''}`}
            aria-label="فیلتر"
          >
            <span>فیلتر</span>
            <FilterIcon width={18} height={18} />
          </button>
          {isFilterMenuOpen && (
            <div className={styles.filterMenu}>
              <button
                className={`${styles.filterMenuItem} ${selectedSort === 'newest' ? styles.filterMenuItemActive : ''}`}
                onClick={() => {
                  onSortChange('newest');
                  setIsFilterMenuOpen(false);
                }}
              >
                جدیدترین
              </button>
              <button
                className={`${styles.filterMenuItem} ${selectedSort === 'oldest' ? styles.filterMenuItemActive : ''}`}
                onClick={() => {
                  onSortChange('oldest');
                  setIsFilterMenuOpen(false);
                }}
              >
                قدیمی‌ترین
              </button>
              <button
                className={`${styles.filterMenuItem} ${selectedSort === 'price-low' ? styles.filterMenuItemActive : ''}`}
                onClick={() => {
                  onSortChange('price-low');
                  setIsFilterMenuOpen(false);
                }}
              >
                ارزان‌ترین
              </button>
              <button
                className={`${styles.filterMenuItem} ${selectedSort === 'price-high' ? styles.filterMenuItemActive : ''}`}
                onClick={() => {
                  onSortChange('price-high');
                  setIsFilterMenuOpen(false);
                }}
              >
                گران‌ترین
              </button>
              <button
                className={`${styles.filterMenuItem} ${selectedSort === 'name-asc' ? styles.filterMenuItemActive : ''}`}
                onClick={() => {
                  onSortChange('name-asc');
                  setIsFilterMenuOpen(false);
                }}
              >
                نام (الف-ی)
              </button>
              <button
                className={`${styles.filterMenuItem} ${selectedSort === 'name-desc' ? styles.filterMenuItemActive : ''}`}
                onClick={() => {
                  onSortChange('name-desc');
                  setIsFilterMenuOpen(false);
                }}
              >
                نام (ی-الف)
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* فیلد جستجو */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="جستجو..."
          dir="rtl"
          className={styles.searchInput}
          style={{ height: SEARCH_HEIGHT }}
        />
        <button
          className={styles.searchButton}
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

      {/* فیلتر دسته‌بندی‌ها */}
      <div 
        className={styles.filterContainer}
        ref={filterContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <button
          className={`${styles.filterButton} ${selectedCategory === 'all' ? styles.filterButtonSelected : ''}`}
          onClick={() => onCategoryChange('all')}
        >
          همه
        </button>
        {categories.map((category) => {
          const IconComponent = category.icon;
          const isSelected = selectedCategory === category.name;
          return (
            <button
              key={category.name}
              className={`${styles.filterButton} ${isSelected ? styles.filterButtonSelected : ''}`}
              onClick={() => onCategoryChange(category.name)}
              style={isSelected && category.gradient ? {
                background: category.gradient,
                borderColor: 'var(--border)',
                color: 'white'
              } : undefined}
            >
              <IconComponent 
                width={16} 
                height={16} 
                color={isSelected ? "white" : "currentColor"} 
              />
              <span>{category.nameFa}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}

