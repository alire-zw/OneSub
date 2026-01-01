"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./BankCard.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import { detectBank, getBankIcon, getBankName } from "@/utils/bankDetector";
import Notification from "@/components/Notification";
import CenterModal from "@/components/CenterModal";
import PageHeader from "@/components/PageHeader";
import BankCardIcon from "@/components/icons/BankCardIcon";
import { isTelegramWebApp, getTelegramWebApp } from "@/utils/telegram";

interface BankCard {
  id: number;
  userId: number;
  cardName?: string;
  cardNumber: string;
  shebaNumber?: string;
  bankName: string;
  createdAt: string;
  updatedAt: string;
}

// لیست پترن‌های موجود
const patterns = [
  '/pattern/Pattern1.svg',
  '/pattern/Pattern2.svg',
  '/pattern/Pattern3.svg',
  '/pattern/Pattern4.svg',
  '/pattern/Pattern5.svg',
  '/pattern/Pattern6.svg',
  '/pattern/Shape1.svg',
  '/pattern/Shape2.svg',
];

// تابع انتخاب رندوم پترن بر اساس ID کارت (ثابت برای هر کارت)
const getCardPattern = (cardId: number): string => {
  const index = cardId % patterns.length;
  return patterns[index];
};

export default function BankCardPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  
  const [bankCards, setBankCards] = useState<BankCard[]>([]);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [detectedBankIcon, setDetectedBankIcon] = useState<string | null>(null);
  const [detectedBankName, setDetectedBankName] = useState<string | null>(null);
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info'
  });

  // Drag to scroll
  const cardsScrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // نمایش دکمه Back تلگرام در Mini App
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const webApp = getTelegramWebApp();
    if (!webApp || !isTelegramWebApp()) return;

    // نمایش دکمه Back
    if (webApp.BackButton && typeof webApp.BackButton.show === "function") {
      webApp.BackButton.show();
    }

    // Handler برای کلیک روی دکمه Back
    const handleBackClick = () => {
      router.back();
    };

    if (webApp.BackButton && typeof webApp.BackButton.onClick === "function") {
      webApp.BackButton.onClick(handleBackClick);
    }

    // Cleanup: مخفی کردن دکمه Back وقتی component unmount می‌شود
    return () => {
      if (webApp.BackButton && typeof webApp.BackButton.hide === "function") {
        webApp.BackButton.hide();
      }
      if (webApp.BackButton && typeof webApp.BackButton.offClick === "function") {
        webApp.BackButton.offClick(handleBackClick);
      }
    };
  }, [router]);

  // بارگذاری کارت‌های بانکی
  useEffect(() => {
    const fetchBankCards = async () => {
      setIsLoadingCards(true);
      try {
        const response = await fetch(API_ENDPOINTS.CARDS.LIST, {
          headers: getAuthHeaders(),
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch cards');
        }
        
        const data = await response.json();
        if (data.success) {
          setBankCards(data.cards || []);
        }
      } catch (error) {
        console.error('خطا در دریافت کارت‌ها:', error);
      } finally {
        setIsLoadingCards(false);
      }
    };

    if (!authLoading) {
      fetchBankCards();
    }
  }, [authLoading]);

  // تشخیص بانک هنگام تغییر شماره کارت
  useEffect(() => {
    if (cardNumber) {
      const icon = getBankIcon(cardNumber);
      const name = getBankName(cardNumber);
      setDetectedBankIcon(icon);
      setDetectedBankName(name);
    } else {
      setDetectedBankIcon(null);
      setDetectedBankName(null);
    }
  }, [cardNumber]);

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  const handleOpenAddCard = () => {
    setCardNumber('');
    setDetectedBankIcon(null);
    setDetectedBankName(null);
    setIsAddCardModalOpen(true);
  };

  const handleCloseAddCard = () => {
    setIsAddCardModalOpen(false);
    setCardNumber('');
    setDetectedBankIcon(null);
    setDetectedBankName(null);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // فقط اعداد مجاز
    let value = e.target.value.replace(/[^\d]/g, '');
    
    // حداکثر 16 رقم
    if (value.length > 16) {
      value = value.slice(0, 16);
    }
    
    // اضافه کردن فاصله هر 4 رقم
    const formattedValue = value.replace(/(\d{4})(?=\d)/g, '$1-');
    
    setCardNumber(formattedValue);
  };

  // Drag to scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardsScrollContainerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - cardsScrollContainerRef.current.offsetLeft;
    scrollLeft.current = cardsScrollContainerRef.current.scrollLeft;
    cardsScrollContainerRef.current.style.cursor = 'grabbing';
    cardsScrollContainerRef.current.style.userSelect = 'none';
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !cardsScrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - cardsScrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    cardsScrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleMouseUp = () => {
    if (!cardsScrollContainerRef.current) return;
    isDragging.current = false;
    cardsScrollContainerRef.current.style.cursor = 'grab';
    cardsScrollContainerRef.current.style.userSelect = 'auto';
  };

  const isValidCardNumber = (): boolean => {
    const cleanNumber = cardNumber.replace(/[-\s]/g, '');
    return cleanNumber.length === 16;
  };

  const handleAddCard = async () => {
    if (!isValidCardNumber()) {
      showNotification('شماره کارت باید 16 رقم باشد', 'error');
      return;
    }

    if (!detectedBankName) {
      showNotification('بانک شناسایی نشد', 'error');
      return;
    }

    setIsLoading(true);
    
    try {
      const cleanCardNumber = cardNumber.replace(/[-\s]/g, '');
      console.log('Adding card:', { cleanCardNumber, detectedBankName });
      
      // تبدیل شماره کارت به شبا از طریق API
      let shebaNumber = null;
      let finalBankName = detectedBankName;
      
      try {
        console.log('Calling card-to-iban API...');
        const ibanResponse = await fetch(API_ENDPOINTS.CARDS.CARD_TO_IBAN, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            cardNumber: cleanCardNumber,
          }),
        });

        if (!ibanResponse.ok) {
          console.error('Card-to-IBAN API error:', ibanResponse.status, ibanResponse.statusText);
        } else {
          const ibanData = await ibanResponse.json();
          console.log('Card-to-IBAN response:', ibanData);
          
          if (ibanData.success && ibanData.data) {
            // حذف "IR" از ابتدای شبا برای ذخیره در دیتابیس
            if (ibanData.data.IBAN) {
              shebaNumber = ibanData.data.IBAN.replace(/^IR/i, '');
              console.log('Extracted sheba number:', shebaNumber);
            }
            // استفاده از نام بانک از API اگر موجود باشد
            if (ibanData.data.bankName) {
              finalBankName = ibanData.data.bankName;
              console.log('Updated bank name:', finalBankName);
            }
          }
        }
      } catch (ibanError) {
        console.error('خطا در تبدیل کارت به شبا:', ibanError);
        // ادامه می‌دهیم بدون شبا
      }
      
      console.log('Calling add card API...', {
        cardNumber: cleanCardNumber,
        bankName: finalBankName,
        shebaNumber: shebaNumber,
      });
      
      const response = await fetch(API_ENDPOINTS.CARDS.ADD, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          cardNumber: cleanCardNumber,
          bankName: finalBankName,
          shebaNumber: shebaNumber,
        }),
      });

      if (!response.ok) {
        console.error('Add card API error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        showNotification(`خطا در افزودن کارت: ${response.status} ${response.statusText}`, 'error');
        return;
      }

      const data = await response.json();
      console.log('Add card response:', data);

      if (data.success) {
        showNotification('کارت با موفقیت اضافه شد', 'success');
        handleCloseAddCard();
        
        // بارگذاری مجدد لیست کارت‌ها
        const cardsResponse = await fetch(API_ENDPOINTS.CARDS.LIST, {
          headers: getAuthHeaders(),
        });
        const cardsData = await cardsResponse.json();
        if (cardsData.success) {
          setBankCards(cardsData.cards || []);
        }
      } else {
        showNotification(data.message || 'خطا در افزودن کارت', 'error');
      }
    } catch (error) {
      console.error('خطا در افزودن کارت بانکی:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطای نامشخص';
      showNotification(`خطا در افزودن کارت: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>کارت های بانکی</h3>
            <div className={styles.cardsContainer}>
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
      {/* Header */}
      <PageHeader title="کارت های بانکی" onBack={() => router.back()} />

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>کارت های بانکی</h3>
          
          <div className={styles.cardsContainer}>
            {isLoadingCards ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>در حال بارگذاری...</p>
              </div>
            ) : bankCards.length === 0 ? (
              /* Empty State */
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg width="64" height="41" viewBox="0 0 64 41" xmlns="http://www.w3.org/2000/svg">
                    <title>No data</title>
                    <g transform="translate(0 1)" fill="none" fillRule="evenodd">
                      <ellipse fill="var(--background-secondary)" cx="32" cy="33" rx="32" ry="7"></ellipse>
                      <g fillRule="nonzero" stroke="var(--border)">
                        <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z"></path>
                        <path d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z" fill="var(--background-secondary)"></path>
                      </g>
                    </g>
                  </svg>
                </div>
                <p className={styles.emptyText}>هیچ کارتی ثبت نشده است</p>
              </div>
            ) : (
              /* Cards List */
              <div 
                className={styles.cardsScrollContainer}
                ref={cardsScrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div className={styles.cardsWrapper}>
                  {bankCards.map((card) => {
                    // فرمت کردن شماره کارت
                    const formattedCard = card.cardNumber.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
                    
                    // دریافت اطلاعات بانک برای رنگ‌ها
                    const bankInfo = detectBank(card.cardNumber);
                    const color1 = bankInfo?.color1 || '#667eea';
                    const color2 = bankInfo?.color2 || '#764ba2';
                    
                    // انتخاب پترن رندوم برای این کارت
                    const cardPattern = getCardPattern(card.id);
                    
                    // دریافت آیکون بانک
                    const bankIcon = getBankIcon(card.cardNumber);
                    
                    return (
                      <div key={card.id} className={styles.bankCard}>
                        {/* قسمت بالا - گرادیانت با پترن */}
                        <div 
                          className={styles.cardTop}
                          style={{
                            background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
                            backgroundImage: `url('${cardPattern}'), linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
                            backgroundSize: 'cover, cover',
                            backgroundPosition: 'center, center',
                            backgroundRepeat: 'no-repeat, no-repeat',
                          }}
                        >
                          <div className={styles.cardHeader}>
                            <div className={styles.bankNameWrapper}>
                              {bankIcon && (
                                <Image 
                                  src={bankIcon} 
                                  alt={card.bankName}
                                  width={20}
                                  height={20}
                                  className={styles.bankIcon}
                                />
                              )}
                              <div className={styles.bankName}>{card.bankName}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* قسمت پایین - رنگ تم */}
                        <div className={styles.cardBottom}>
                          <div className={styles.cardNumber}>{formattedCard}</div>
                          <div className={styles.holderName}>{card.shebaNumber ? `IR${card.shebaNumber}` : ''}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* دکمه افزودن کارت بانکی */}
          <button className={styles.addButton} onClick={handleOpenAddCard}>
            <span className={styles.addButtonIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14"></path>
              </svg>
            </span>
            <span>افزودن کارت بانکی</span>
          </button>
        </div>
      </div>

      {/* Notification */}
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      {/* Add Card Modal */}
      <CenterModal
        isOpen={isAddCardModalOpen}
        onClose={handleCloseAddCard}
        title="افزودن کارت بانکی"
        description="شماره 16 رقمی کارت بانکی خود را وارد کنید. سیستم به صورت خودکار شماره شبا و اطلاعات بانک را دریافت می‌کند."
        buttons={[
          {
            label: "انصراف",
            onClick: handleCloseAddCard,
            variant: 'default',
          },
          {
            label: isLoading ? "در حال افزودن..." : "ذخیره",
            onClick: handleAddCard,
            variant: 'primary',
            disabled: isLoading || !isValidCardNumber(),
          },
        ]}
      >
        <div className={styles.modalContent}>
          <div className={styles.inputWrapper}>
            <input
              type="tel"
              value={cardNumber}
              onChange={handleCardNumberChange}
              className={styles.modalInput}
              placeholder="1234-5678-9012-3456"
              maxLength={19}
              pattern="[0-9-]*"
              inputMode="numeric"
            />
            <div className={styles.inputIcon}>
              {detectedBankIcon ? (
                <Image 
                  src={detectedBankIcon} 
                  alt="Bank Logo" 
                  width={20} 
                  height={20}
                  style={{ objectFit: 'contain' }}
                />
              ) : (
                <BankCardIcon width={16} height={16} />
              )}
            </div>
          </div>
        </div>
      </CenterModal>
    </div>
  );
}

