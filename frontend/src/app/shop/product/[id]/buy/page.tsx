"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useRequireAuth, useAuth } from "@/hooks/useAuth";
import { useTelegramRegister } from "@/hooks/useTelegramRegister";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import NoteIcon from "@/components/icons/NoteIcon";
import PhoneIcon from "@/components/icons/PhoneIcon";
import IdIcon from "@/components/icons/IdIcon";
import OrderIcon from "@/components/icons/OrderIcon";
import BankCardIcon from "@/components/icons/BankCardIcon";
import MoneyBagIcon from "@/components/icons/MoneyBagIcon";
import DepositCryptoIcon from "@/components/icons/DepositCryptoIcon";
import AlertSquareIcon from "@/components/icons/AlertSquareIcon";
import SuccessIcon from "@/components/icons/SuccessIcon";
import PaymentFailedIcon from "@/components/icons/PaymentFailedIcon";
import { QRCode } from "react-qrcode-logo";
import { isTelegramWebApp } from "@/utils/telegram";
import styles from './page.module.css';

type Step = "userInfo" | "orderDescription" | "payment";

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
  additionalInfo?: string;
  noteType?: 'info' | 'warning' | 'note';
  noteText?: string;
}

interface WalletBalance {
  balance: number;
}

interface CryptoPaymentData {
  trackId: number;
  orderNumber: string;
  amountToman: number;
  amountTrx: number;
  trxPrice: number;
  walletAddress: string;
  status: string;
  cryptoStatus: string;
  expiresAt: string;
  completedAt?: string;
  paidAt?: string;
  createdAt: string;
}

function BuyProductPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params?.id as string;
  const { isLoading: authLoading, user } = useRequireAuth("/login");
  const { refreshUser } = useAuth();
  const { isRegistering, registerStatus } = useTelegramRegister();
  
  // Storage key for persisting state
  const storageKey = `buy-product-${productId}`;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize states with default values (to avoid hydration mismatch)
  const [step, setStep] = useState<Step>("userInfo");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileStep, setMobileStep] = useState<"phone" | "verification">("phone");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(false);
  const hasAutoVerified = useRef(false);
  const [shouldApplySpacing, setShouldApplySpacing] = useState(false);
  const [orderEmail, setOrderEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("online");
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [cryptoPaymentData, setCryptoPaymentData] = useState<CryptoPaymentData | null>(null);
  const [cryptoTimeLeft, setCryptoTimeLeft] = useState<number>(0);
  const [cryptoCopied, setCryptoCopied] = useState(false);
  const [cryptoPrimaryColor, setCryptoPrimaryColor] = useState<string>("#10b981");
  const [isRestored, setIsRestored] = useState(false); // Flag to track if state has been restored
  const cryptoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cryptoStatusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cryptoPaymentDataRef = useRef<CryptoPaymentData | null>(null); // Ref to access latest cryptoPaymentData in intervals
  const pollingTrackIdRef = useRef<number | null>(null); // Ref for trackId in polling
  const pollingWalletAddressRef = useRef<string | undefined>(undefined); // Ref for walletAddress in polling
  
  // Restore state from localStorage (only on client-side to avoid hydration mismatch)
  useEffect(() => {
    if (typeof window === "undefined" || isRestored) return;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedState = JSON.parse(saved);
        
        // Restore all states
        if (savedState.step) setStep(savedState.step);
        if (savedState.fullName) setFullName(savedState.fullName);
        if (savedState.mobile) setMobile(savedState.mobile);
        if (savedState.mobileStep) setMobileStep(savedState.mobileStep);
        if (savedState.orderEmail) setOrderEmail(savedState.orderEmail);
        if (savedState.paymentMethod) {
          // اگر paymentMethod "card" است (که دیگر موجود نیست)، به "online" تغییر بده
          setPaymentMethod(savedState.paymentMethod === "card" ? "online" : savedState.paymentMethod);
        }
        if (savedState.useWalletBalance !== undefined) setUseWalletBalance(savedState.useWalletBalance);
        
        // If cryptoPaymentData exists in storage, restore it immediately with minimal data
        // This ensures the payment page shows up while async fetch completes
        if (savedState?.cryptoPaymentData?.trackId) {
          const restoredMinimalData: CryptoPaymentData = {
            trackId: savedState.cryptoPaymentData.trackId,
            orderNumber: savedState.cryptoPaymentData.orderNumber || "",
            walletAddress: savedState.cryptoPaymentData.walletAddress || "",
            amountToman: 0,
            amountTrx: 0,
            trxPrice: 0,
            status: "pending" as const,
            cryptoStatus: "pending" as const,
            expiresAt: savedState.cryptoPaymentData.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            createdAt: savedState.cryptoPaymentData.createdAt || new Date().toISOString(),
          };
          setCryptoPaymentData(restoredMinimalData);
          cryptoPaymentDataRef.current = restoredMinimalData;
          // Ensure step is set correctly - if we have crypto payment, we're on payment step
          // Don't override step if it was explicitly saved
          if (!savedState.step || savedState.step === "userInfo" || savedState.step === "orderDescription") {
            // If step wasn't payment-related, but we have crypto payment, we should be on payment
            // Actually, let's keep the saved step as it might be more accurate
          }
        }
        
        setIsRestored(true);
      } else {
        setIsRestored(true);
      }
    } catch (err) {
      console.error("Error loading state from storage:", err);
      setIsRestored(true);
    }
  }, [storageKey, isRestored]);
  
  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined" || !productId) return;
    
    const stateToSave = {
      step,
      fullName,
      mobile,
      mobileStep,
      orderEmail,
      paymentMethod,
      useWalletBalance,
      cryptoPaymentData: cryptoPaymentData ? {
        trackId: cryptoPaymentData.trackId,
        orderNumber: cryptoPaymentData.orderNumber,
        walletAddress: cryptoPaymentData.walletAddress,
        // Don't save status, timeLeft etc - they will be refreshed
      } : null,
    };
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (err) {
      console.error("Error saving state to storage:", err);
    }
  }, [step, fullName, mobile, mobileStep, orderEmail, paymentMethod, useWalletBalance, cryptoPaymentData?.trackId, cryptoPaymentData?.orderNumber, cryptoPaymentData?.walletAddress, productId, storageKey]);

  // Handle completed payment status - redirect to success page
  useEffect(() => {
    if (cryptoPaymentData?.status === "completed" && isRestored) {
      // Stop all intervals
      if (cryptoStatusCheckIntervalRef.current) {
        clearTimeout(cryptoStatusCheckIntervalRef.current as any);
        cryptoStatusCheckIntervalRef.current = null;
      }
      if (cryptoIntervalRef.current) {
        clearInterval(cryptoIntervalRef.current);
        cryptoIntervalRef.current = null;
      }
      
      // Clear storage
      if (typeof window !== "undefined") {
        localStorage.removeItem(storageKey);
      }
      
      // Get order number and product ID
      const orderNumber = cryptoPaymentData.orderNumber;
      const targetProductId = productId || product?.id;
      
      // Redirect to success page
      if (orderNumber && targetProductId) {
        setTimeout(() => {
          router.push(`/shop/product/${targetProductId}/buy/success?orderNumber=${orderNumber}`);
        }, 500);
      } else {
        console.error("Cannot redirect: missing orderNumber or productId", { orderNumber, targetProductId, cryptoPaymentData });
      }
    }
  }, [cryptoPaymentData?.status, isRestored, cryptoPaymentData?.orderNumber, productId, product?.id, storageKey, router]);

  // محاسبه safe area spacing مشابه mobile navbar
  useEffect(() => {
    if (typeof window !== "undefined") {
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const inTelegram = isTelegramWebApp();
      // فقط در iOS و داخل مینی‌اپ تلگرام فاصله اعمال شود
      setShouldApplySpacing(iOS && inTelegram);
    }
  }, []);

  // بررسی خطای پرداخت و redirect به صفحه failed
  useEffect(() => {
    if (authLoading || !user) return;
    
    const errorParam = searchParams?.get("error");
    const orderNumberParam = searchParams?.get("orderNumber");
    
    if (errorParam === "payment_failed") {
      if (orderNumberParam) {
        // Redirect to failed page with order number
        router.replace(`/shop/product/${productId}/buy/failed?orderNumber=${orderNumberParam}`);
      } else {
        // If no orderNumber, redirect to shop page
        router.replace("/shop");
      }
    }
  }, [searchParams, authLoading, user, productId, router]);

  // دریافت اطلاعات محصول
  useEffect(() => {
    if (!productId) return;

    const fetchProduct = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.PRODUCTS.GET(productId));
        const data = await response.json();
        
        if (data.status === 1 && data.data) {
          setProduct(data.data);
        } else {
          setError(data.message || "محصول یافت نشد");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        setError("خطا در بارگذاری اطلاعات محصول");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // بارگذاری اطلاعات کاربر از دیتابیس
  useEffect(() => {
    if (authLoading || !user || !isRestored) return;

    // اگر کاربر لاگین است، اطلاعات را از دیتابیس بگیر
    // اما فقط اگر در storage ذخیره نشده باشد (یعنی fullName یا mobile خالی باشند)
    if (user.userName && !fullName) {
      setFullName(user.userName);
    }
    if (user.phoneNumber && !mobile) {
      setMobile(user.phoneNumber);
    }
  }, [authLoading, user, isRestored, fullName, mobile]);

  // دریافت موجودی کیف پول
  useEffect(() => {
    if (authLoading || !user) return;

    const fetchWalletBalance = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.WALLET.BALANCE, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        
        if (data.status === 1 && data.data) {
          // موجودی در Rial است، به تومان تبدیل می‌کنیم
          setWalletBalance(Math.floor((data.data.balance || 0) / 10));
        }
      } catch (err) {
        console.error("Error fetching wallet balance:", err);
      }
    };

    fetchWalletBalance();
  }, [authLoading, user]);

  // Get primary color from CSS variable
  useEffect(() => {
    const root = document.documentElement;
    const color = getComputedStyle(root).getPropertyValue('--primary').trim() || '#10b981';
    setCryptoPrimaryColor(color);
  }, []);

  // Fetch crypto payment data
  const fetchCryptoPaymentData = async (trackId: number) => {
    try {
      const url = API_ENDPOINTS.CRYPTO.TRON_PAYMENT(trackId);
      console.log(`[Crypto Polling] Fetching payment data by trackId: ${url}`);
      const response = await fetch(url);
      const result = await response.json();
      console.log(`[Crypto Polling] Response from trackId endpoint:`, result);

      if (result.status === 1 && result.data) {
        const data: CryptoPaymentData = {
          trackId: result.data.trackId,
          orderNumber: result.data.orderNumber || result.data.orderId || cryptoPaymentData?.orderNumber || "",
          amountToman: typeof result.data.amountToman === 'string' ? parseFloat(result.data.amountToman) : (result.data.amountToman || 0),
          amountTrx: typeof result.data.amountTrx === 'string' ? parseFloat(result.data.amountTrx) : (result.data.amountTrx || 0),
          trxPrice: typeof result.data.trxPrice === 'string' ? parseFloat(result.data.trxPrice) : (result.data.trxPrice || 0),
          walletAddress: result.data.walletAddress || cryptoPaymentData?.walletAddress || "",
          status: result.data.status || "pending",
          cryptoStatus: result.data.cryptoStatus || "pending",
          expiresAt: result.data.expiresAt,
          completedAt: result.data.completedAt,
          paidAt: result.data.paidAt,
          createdAt: result.data.createdAt,
        };
        
        // Always update cryptoPaymentData if we have trackId (walletAddress might not be available immediately)
        if (data.trackId) {
          setCryptoPaymentData(data);
          // Update ref so polling can access latest data
          cryptoPaymentDataRef.current = data;
        }

        // Calculate time left
        if (result.data.expiresAt) {
          const expiresAt = new Date(result.data.expiresAt).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
          setCryptoTimeLeft(remaining);
          
          // If time expired but status is still pending and cryptoStatus is not set, mark as expired
          if (remaining <= 0 && result.data.status === "pending" && result.data.cryptoStatus !== "completed") {
            data.cryptoStatus = "expired";
          }
        }

        // If payment completed, stop polling - redirect will be handled by useEffect
        if (result.data.status === "completed") {
          // Stop all intervals
          if (cryptoStatusCheckIntervalRef.current) {
            clearTimeout(cryptoStatusCheckIntervalRef.current as any);
            cryptoStatusCheckIntervalRef.current = null;
          }
          if (cryptoIntervalRef.current) {
            clearInterval(cryptoIntervalRef.current);
            cryptoIntervalRef.current = null;
          }
          // State update will trigger useEffect to handle redirect
        }
        
        return data;
      }
      return null;
    } catch (err) {
      console.error("Error fetching crypto payment data:", err);
      return null;
    }
  };

  // Fetch order status by wallet address
  const fetchOrderByWalletAddress = async (walletAddress: string) => {
    try {
      const url = API_ENDPOINTS.CRYPTO.TRON_WALLET(walletAddress);
      console.log(`[Crypto Polling] Fetching order by wallet address: ${url}`);
      const response = await fetch(url);
      const result = await response.json();
      console.log(`[Crypto Polling] Response from wallet endpoint:`, result);

      if (result.status === 1 && result.data) {
        // If order is completed, update cryptoPaymentData and trigger redirect
        if (result.data.orderStatus === "completed" || result.data.transactionStatus === "completed") {
          if (cryptoPaymentData) {
            const updatedData: CryptoPaymentData = {
              ...cryptoPaymentData,
              status: "completed",
              cryptoStatus: "completed",
              orderNumber: result.data.orderNumber,
            };
            setCryptoPaymentData(updatedData);
            cryptoPaymentDataRef.current = updatedData;
          }
          return {
            completed: true,
            orderNumber: result.data.orderNumber,
            productId: result.data.productId,
          };
        }
        return { completed: false };
      }
      return { completed: false };
    } catch (err) {
      console.error("Error fetching order by wallet address:", err);
      return { completed: false };
    }
  };

  // Start polling for crypto payment status (both by trackId and wallet address)
  // Using recursive setTimeout instead of setInterval for better reliability
  const startCryptoPaymentPolling = (trackId: number, walletAddress?: string) => {
    // Stop any existing polling
    if (cryptoStatusCheckIntervalRef.current) {
      clearTimeout(cryptoStatusCheckIntervalRef.current as any);
      cryptoStatusCheckIntervalRef.current = null;
    }
    
    // Store trackId and walletAddress in refs to avoid stale closure
    pollingTrackIdRef.current = trackId;
    pollingWalletAddressRef.current = walletAddress;
    
    // Initial fetch by trackId
    fetchCryptoPaymentData(trackId);
    
    let tickCount = 0;
    const POLLING_INTERVAL = 10000; // 10 seconds
    const MAX_POLLING_TIME = 15 * 60 * 1000; // 15 minutes
    const startTime = Date.now();
    
    // Recursive polling function
    const poll = async () => {
      try {
        tickCount++;
        const elapsed = Date.now() - startTime;
        console.log(`[Crypto Polling] ===== POLL #${tickCount} (${Math.floor(elapsed / 1000)}s elapsed) =====`);
        
        // Check if we've exceeded max polling time (15 minutes)
        if (elapsed >= MAX_POLLING_TIME) {
          console.log(`[Crypto Polling] Max polling time (15 minutes) reached, stopping`);
          if (cryptoStatusCheckIntervalRef.current) {
            clearTimeout(cryptoStatusCheckIntervalRef.current as any);
            cryptoStatusCheckIntervalRef.current = null;
          }
          return;
        }
        
        // Use ref to get latest cryptoPaymentData (avoids stale closure)
        const currentData = cryptoPaymentDataRef.current;
        const currentTrackId = pollingTrackIdRef.current;
        const currentWalletAddress = pollingWalletAddressRef.current;
        
        console.log(`[Crypto Polling] Current data:`, currentData ? { trackId: currentData.trackId, status: currentData.status, walletAddress: currentData.walletAddress } : 'null');
        
        // If already completed, stop polling
        if (currentData?.status === "completed") {
          console.log(`[Crypto Polling] Payment already completed, stopping polling`);
          if (cryptoStatusCheckIntervalRef.current) {
            clearTimeout(cryptoStatusCheckIntervalRef.current as any);
            cryptoStatusCheckIntervalRef.current = null;
          }
          return;
        }
        
        // Get current wallet address (prioritize from data, fallback to ref)
        const walletAddr = currentData?.walletAddress || currentWalletAddress;
        const trackIdToUse = currentTrackId || currentData?.trackId;
        
        console.log(`[Crypto Polling] Using wallet address: ${walletAddr || 'not available'}, trackId: ${trackIdToUse}`);
        
        // Check by wallet address first (more reliable for detecting completion)
        if (walletAddr) {
          try {
            console.log(`[Crypto Polling] Checking wallet address: ${walletAddr}`);
            const walletCheck = await fetchOrderByWalletAddress(walletAddr);
            if (walletCheck.completed && walletCheck.orderNumber) {
              console.log(`[Crypto Polling] Payment completed! Order: ${walletCheck.orderNumber}`);
              // Stop polling
              if (cryptoStatusCheckIntervalRef.current) {
                clearTimeout(cryptoStatusCheckIntervalRef.current as any);
                cryptoStatusCheckIntervalRef.current = null;
              }
              if (cryptoIntervalRef.current) {
                clearTimeout(cryptoIntervalRef.current as any);
                cryptoIntervalRef.current = null;
              }
              
              // Update state - useEffect will handle redirect
              setCryptoPaymentData((prev) => {
                if (prev && prev.status !== "completed") {
                  const updated = {
                    ...prev,
                    status: "completed",
                    cryptoStatus: "completed",
                    orderNumber: walletCheck.orderNumber,
                  };
                  cryptoPaymentDataRef.current = updated;
                  return updated;
                }
                return prev;
              });
              return;
            }
          } catch (err) {
            console.error("[Crypto Polling] Error checking wallet address:", err);
          }
        }
        
        // Always check by trackId (even if wallet address check was done)
        if (trackIdToUse) {
          try {
            console.log(`[Crypto Polling] Checking by trackId: ${trackIdToUse}`);
            await fetchCryptoPaymentData(trackIdToUse);
          } catch (err) {
            console.error("[Crypto Polling] Error fetching payment data:", err);
          }
        }
        
        // Schedule next poll (recursive setTimeout)
        cryptoStatusCheckIntervalRef.current = setTimeout(poll, POLLING_INTERVAL) as any;
        console.log(`[Crypto Polling] Next poll scheduled in ${POLLING_INTERVAL / 1000} seconds`);
        
      } catch (err) {
        console.error("[Crypto Polling] Unexpected error in polling:", err);
        // Schedule next poll even if there was an error
        cryptoStatusCheckIntervalRef.current = setTimeout(poll, POLLING_INTERVAL) as any;
      }
    };
    
    // Start first poll after initial delay
    cryptoStatusCheckIntervalRef.current = setTimeout(poll, POLLING_INTERVAL) as any;
    
    console.log(`[Crypto Polling] Started recursive polling for trackId: ${trackId}, walletAddress: ${walletAddress || 'not available yet'}`);
    console.log(`[Crypto Polling] Will check every ${POLLING_INTERVAL / 1000} seconds for up to ${MAX_POLLING_TIME / 60000} minutes`);
  };

  // Restore crypto payment data if trackId exists in storage (async fetch to complete data)
  useEffect(() => {
    if (typeof window === "undefined" || !isRestored || !productId) return;
    
    // Only fetch full data if we have partial cryptoPaymentData from storage restore
    if (!cryptoPaymentData?.trackId) return;
    
    // If we already have full data (walletAddress and amountToman > 0), don't fetch again
    if (cryptoPaymentData.walletAddress && cryptoPaymentData.amountToman > 0) return;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedState = JSON.parse(saved);
        
        if (savedState?.cryptoPaymentData?.trackId) {
          // Restore crypto payment by fetching from API
          const restoreCryptoPayment = async () => {
            try {
              const trackId = savedState.cryptoPaymentData.trackId;
              const walletAddr = savedState.cryptoPaymentData?.walletAddress || cryptoPaymentData?.walletAddress;
              
              // First, try to restore from wallet address (more reliable)
              if (walletAddr) {
                const walletCheck = await fetchOrderByWalletAddress(walletAddr);
                if (walletCheck.completed && walletCheck.orderNumber) {
                  // Payment already completed, redirect
                  if (typeof window !== "undefined") {
                    localStorage.removeItem(storageKey);
                  }
                  router.push(`/shop/product/${productId}/buy/success?orderNumber=${walletCheck.orderNumber}`);
                  return;
                }
              }
              
              // Fetch payment data by trackId to complete the data
              const restoredData = await fetchCryptoPaymentData(trackId);
              
              // If payment is still pending (not expired, not completed), continue showing payment page
              if (restoredData) {
                // Only consider expired if cryptoStatus is explicitly "expired"
                const isReallyExpired = restoredData.cryptoStatus === "expired" && restoredData.status === "pending";
                
                if (restoredData.status === "pending" && !isReallyExpired) {
                  // Payment is still valid, continue showing payment page
                  // Start polling if payment is still pending and not expired
                  const finalWalletAddr = restoredData.walletAddress || walletAddr;
                  console.log(`[Crypto Polling] Restore: Starting polling for trackId: ${trackId}, walletAddress: ${finalWalletAddr || 'not available'}`);
                  // Don't use setTimeout - start immediately, useEffect will handle it
                  // But also call it here as backup
                  setTimeout(() => {
                    startCryptoPaymentPolling(trackId, finalWalletAddr);
                  }, 1000);
                } else if (restoredData.status === "completed") {
                  // If completed, redirect to success
                  if (typeof window !== "undefined") {
                    localStorage.removeItem(storageKey);
                  }
                  const orderNum = restoredData.orderNumber || savedState.cryptoPaymentData?.orderNumber;
                  if (orderNum) {
                    router.push(`/shop/product/${productId}/buy/success?orderNumber=${orderNum}`);
                  }
                }
                // If really expired, let it show the expired UI (which will be handled by the render logic)
              } else if (walletAddr) {
                // If fetchCryptoPaymentData failed but we have wallet address, try polling by wallet only
                setTimeout(() => {
                  startCryptoPaymentPolling(trackId, walletAddr);
                }, 500);
              }
            } catch (err) {
              console.error("Error restoring crypto payment:", err);
              // Even if restore failed, try to start polling with saved data
              const walletAddr = savedState?.cryptoPaymentData?.walletAddress || cryptoPaymentData?.walletAddress;
              if (walletAddr) {
                setTimeout(() => {
                  startCryptoPaymentPolling(savedState.cryptoPaymentData.trackId, walletAddr);
                }, 500);
              }
            }
          };

          restoreCryptoPayment();
        }
      }
    } catch (err) {
      console.error("Error restoring crypto payment state:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, isRestored, storageKey, cryptoPaymentData?.trackId]);

  // Auto-start polling when cryptoPaymentData is available and pending
  useEffect(() => {
    if (!isRestored || !cryptoPaymentData?.trackId) {
      console.log(`[Crypto Polling] Not starting - isRestored: ${isRestored}, trackId: ${cryptoPaymentData?.trackId}`);
      return;
    }
    
    // Don't start polling if already completed or expired
    if (cryptoPaymentData.status === "completed") {
      console.log(`[Crypto Polling] Not starting - already completed`);
      return;
    }
    if (cryptoPaymentData.cryptoStatus === "expired" && cryptoPaymentData.status === "pending") {
      console.log(`[Crypto Polling] Not starting - expired`);
      return;
    }
    
    // Check if polling is already active
    if (cryptoStatusCheckIntervalRef.current) {
      console.log(`[Crypto Polling] Already active (interval ID: ${cryptoStatusCheckIntervalRef.current}), not starting again`);
      return;
    }
    
    // Start polling if we have trackId and payment is pending
    const walletAddr = cryptoPaymentData.walletAddress;
    if (cryptoPaymentData.status === "pending") {
      console.log(`[Crypto Polling] Auto-starting polling for trackId: ${cryptoPaymentData.trackId}, walletAddress: ${walletAddr || 'not available yet'}`);
      // Start immediately
      startCryptoPaymentPolling(cryptoPaymentData.trackId, walletAddr);
    } else {
      console.log(`[Crypto Polling] Not starting - status is: ${cryptoPaymentData.status}`);
    }
    
    // Cleanup on unmount
    return () => {
      console.log(`[Crypto Polling] Cleanup on unmount`);
      if (cryptoStatusCheckIntervalRef.current) {
        clearTimeout(cryptoStatusCheckIntervalRef.current as any);
        cryptoStatusCheckIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestored, cryptoPaymentData?.trackId, cryptoPaymentData?.status, cryptoPaymentData?.walletAddress]);

  // Countdown timer for crypto payment
  useEffect(() => {
    if (cryptoPaymentData && cryptoTimeLeft > 0 && cryptoPaymentData.status === "pending") {
      if (cryptoIntervalRef.current) clearInterval(cryptoIntervalRef.current);
      
      cryptoIntervalRef.current = setInterval(() => {
        setCryptoTimeLeft((prev) => {
          if (prev <= 1) {
            if (cryptoIntervalRef.current) clearInterval(cryptoIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (cryptoIntervalRef.current) clearInterval(cryptoIntervalRef.current);
      if (cryptoStatusCheckIntervalRef.current) clearTimeout(cryptoStatusCheckIntervalRef.current as any);
    };
  }, [cryptoPaymentData, cryptoTimeLeft]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCryptoCopied(true);
      setTimeout(() => setCryptoCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTrxAmount = (amount: number | string | null | undefined): string => {
    if (amount === null || amount === undefined) return "0.00";
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return "0.00";
    return numAmount.toFixed(2);
  };

  // Timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Auto-verify وقتی 5 رقم وارد شد
  useEffect(() => {
    if (verificationCode.length === 5 && mobileStep === "verification" && !isLoadingUserInfo && !hasAutoVerified.current) {
      hasAutoVerified.current = true;
      handleVerifyCode();
    }
    if (verificationCode.length < 5) {
      hasAutoVerified.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationCode, mobileStep, isLoadingUserInfo]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price);
  };

  // تابع اعتبارسنجی شماره موبایل
  const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^09\d{9}$/;
    const cleanPhone = phone.trim().replace(/\s/g, "");
    return phoneRegex.test(cleanPhone) && cleanPhone.length === 11;
  };

  // تابع اعتبارسنجی ایمیل
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // بررسی اینکه آیا کاربر شماره موبایل تایید شده دارد
  const hasVerifiedPhone = user?.phoneNumber ? isValidPhone(user.phoneNumber) : false;
  // بررسی اینکه آیا کاربر نام کامل دارد
  const hasFullName = Boolean(user?.userName && user.userName.trim().length > 0);
  
  // بررسی اینکه آیا محصول نیاز به ایمیل/پسورد دارد (اگر activationType شامل "ایمیل آماده" نباشد)
  const needsEmailPassword = product && product.activationType 
    ? !product.activationType.toLowerCase().includes("ایمیل آماده") && !product.activationType.toLowerCase().includes("ready email")
    : false;

  // اگر محصول نیاز به ایمیل/پسورد ندارد و کاربر در مرحله orderDescription است، به payment برو
  useEffect(() => {
    if (product && step === "orderDescription" && !needsEmailPassword) {
      setStep("payment");
    }
  }, [product, step, needsEmailPassword]);

  // ارسال کد تایید به شماره موبایل
  const handleSendVerificationCode = async () => {
    if (!mobile.trim()) {
      setError("لطفاً شماره موبایل خود را وارد کنید");
      return;
    }

    if (!isValidPhone(mobile)) {
      setError("لطفاً یک شماره موبایل معتبر وارد کنید (مثال: 09123456789)");
      return;
    }

    setIsLoadingUserInfo(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/sms/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: mobile,
        }),
      });

      const data = await response.json();

      if (data.status === 1) {
        setMobileStep("verification");
        setVerificationCode("");
        setResendTimer(120);
        hasAutoVerified.current = false;
        setError(null);
      } else {
        setError(data.message || "خطا در ارسال کد تایید");
      }
    } catch (err) {
      console.error("Error sending OTP:", err);
      setError("خطا در ارتباط با سرور");
    } finally {
      setIsLoadingUserInfo(false);
    }
  };

  // تایید کد و ذخیره شماره موبایل
  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 5) {
      setError("لطفاً کد تایید 5 رقمی را وارد کنید");
      return;
    }

    setIsLoadingUserInfo(true);
    setError(null);

    try {
      if (!user) {
        // اگر کاربر لاگین نیست، با otp-login هم verify کن هم کاربر را بساز
        const loginResponse = await fetch(`${API_BASE_URL}/api/users/otp-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: mobile,
            otp: verificationCode,
          }),
        });

        const loginData = await loginResponse.json();

        if (loginData.status === 1 && loginData.data?.token) {
          // ذخیره token و refresh user
          localStorage.setItem("token", loginData.data.token);
          await refreshUser();

          // اگر نام کامل هم وارد شده، آن را ذخیره کن
          if (fullName.trim()) {
            const updateNameResponse = await fetch(API_ENDPOINTS.USERS.UPDATE_PROFILE, {
              method: "PUT",
              headers: getAuthHeaders(),
              body: JSON.stringify({
                userName: fullName.trim(),
              }),
            });
            await updateNameResponse.json();
            await refreshUser();
          }

          // شماره تایید شد
          setMobileStep("phone");
          setVerificationCode("");
          setResendTimer(0);
          setError(null);
        } else {
          setError(loginData.message || "کد تایید اشتباه است");
          hasAutoVerified.current = false;
        }
      } else {
        // اگر کاربر لاگین است، فقط OTP را verify کن
        const verifyResponse = await fetch(`${API_BASE_URL}/api/sms/verify-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mobile: mobile,
            otp: verificationCode,
          }),
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.status === 1) {
          // شماره را در دیتابیس به‌روزرسانی کن
          const updateResponse = await fetch(API_ENDPOINTS.USERS.UPDATE_PROFILE, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              phoneNumber: mobile,
            }),
          });

          const updateData = await updateResponse.json();

          if (updateData.status === 1) {
            await refreshUser();
          }
          
          // شماره تایید شد
          setMobileStep("phone");
          setVerificationCode("");
          setResendTimer(0);
          setError(null);
        } else {
          setError(verifyData.message || "کد تایید اشتباه است");
          hasAutoVerified.current = false;
        }
      }
    } catch (err) {
      console.error("Error verifying code:", err);
      setError("خطا در ارتباط با سرور");
      hasAutoVerified.current = false;
    } finally {
      setIsLoadingUserInfo(false);
    }
  };

  // تابع برای تغییر شماره موبایل (بازگشت به مرحله اول)
  const handleChangeNumber = () => {
    setMobileStep("phone");
    setVerificationCode("");
    setResendTimer(0);
    hasAutoVerified.current = false;
  };

  // تابع فرمت کردن تایمر به mm:ss
  const formatTimer = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // ذخیره نام کامل
  const handleSaveFullName = async () => {
    if (!fullName.trim()) {
      setError("لطفاً نام کامل خود را وارد کنید");
      return;
    }

    setIsLoadingUserInfo(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.USERS.UPDATE_PROFILE, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userName: fullName.trim(),
        }),
      });

      const data = await response.json();

      if (data.status === 1) {
        await refreshUser();
        setError(null);
      } else {
        setError(data.message || "خطا در به‌روزرسانی نام کامل");
      }
    } catch (err) {
      console.error("Error updating full name:", err);
      setError("خطا در ارتباط با سرور");
    } finally {
      setIsLoadingUserInfo(false);
    }
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

  const handlePurchase = async () => {
    if (!product) return;

    setPurchasing(true);
    setError(null);

    try {
      let response;
      let data;

      if (paymentMethod === "wallet") {
        // پرداخت با کیف پول
        if (walletBalance === null || walletBalance < productPrice) {
          setError("موجودی کیف پول شما کافی نیست");
          setPurchasing(false);
          return;
        }

        response = await fetch(API_ENDPOINTS.ORDERS.PURCHASE_WITH_WALLET, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            productId: product.id,
            orderEmail: needsEmailPassword ? orderEmail : null,
          }),
        });

        data = await response.json();

        if (data.status === 1) {
          // Clear storage before redirect
          if (typeof window !== "undefined") {
            localStorage.removeItem(storageKey);
          }
          // به‌روزرسانی موجودی کیف پول
          await refreshUser();
          // هدایت به صفحه موفقیت
          router.push(`/shop/product/${product.id}/buy/success?orderNumber=${data.data.orderNumber}`);
        } else {
          setError(data.message || "خطا در خرید محصول");
        }
      } else if (paymentMethod === "online") {
        // پرداخت آنلاین با درگاه
        response = await fetch(API_ENDPOINTS.ORDERS.PURCHASE_DIRECT, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            productId: product.id,
            orderEmail: needsEmailPassword ? orderEmail : null,
            useWalletBalance: useWalletBalance && walletBalance !== null && walletBalance > 0 && walletBalance < productPrice,
          }),
        });

        data = await response.json();

        if (data.status === 1) {
          // هدایت به درگاه پرداخت (در همان تب فعلی)
          if (data.data.paymentUrl) {
            // استفاده از window.location.replace برای جلوگیری از باز شدن تب جدید
            window.location.replace(data.data.paymentUrl);
          } else {
            setError("خطا در دریافت لینک پرداخت");
          }
        } else {
          setError(data.message || "خطا در ایجاد درخواست پرداخت");
        }
      } else if (paymentMethod === "crypto") {
        // پرداخت با ارز دیجیتال
        response = await fetch(API_ENDPOINTS.ORDERS.PURCHASE_WITH_CRYPTO, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            productId: product.id,
            orderEmail: needsEmailPassword ? orderEmail : null,
          }),
        });

        data = await response.json();

        if (data.status === 1 && data.data) {
          // نمایش صفحه پرداخت ارز دیجیتال
          const paymentData: CryptoPaymentData = {
            trackId: data.data.trackId,
            orderNumber: data.data.orderNumber,
            amountToman: data.data.amountToman,
            amountTrx: data.data.amountTrx,
            trxPrice: data.data.trxPrice,
            walletAddress: data.data.walletAddress,
            status: "pending",
            cryptoStatus: "pending",
            expiresAt: data.data.expiresAt,
            createdAt: new Date().toISOString(),
          };
          setCryptoPaymentData(paymentData);
          cryptoPaymentDataRef.current = paymentData;
          
          // محاسبه زمان باقی‌مانده
          if (data.data.expiresAt) {
            const expiresAt = new Date(data.data.expiresAt).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            setCryptoTimeLeft(remaining);
          }
          
          // شروع چک کردن وضعیت پرداخت
          console.log(`[Crypto Purchase] Payment created, starting polling for trackId: ${data.data.trackId}, walletAddress: ${data.data.walletAddress}`);
          startCryptoPaymentPolling(data.data.trackId, data.data.walletAddress);
        } else {
          setError(data.message || "خطا در ایجاد درخواست پرداخت");
        }
      } else {
        setError("لطفاً روش پرداخت را انتخاب کنید");
      }
    } catch (err) {
      console.error("Error purchasing product:", err);
      setError("خطا در ارتباط با سرور");
    } finally {
      setPurchasing(false);
    }
  };

  // نمایش صفحه پرداخت ارز دیجیتال
  // Only show crypto payment if we have valid data AND state has been restored (to avoid hydration mismatch)
  // Wait for restoration to complete before showing crypto payment UI
  // Show payment page if we have trackId (walletAddress might be loaded later)
  if (isRestored && cryptoPaymentData && cryptoPaymentData.trackId) {
    // Payment completed
    if (cryptoPaymentData.status === "completed") {
      return (
        <div className={styles.pageWrapper}>
          <PageHeader title="پرداخت موفق" />
          <div className={styles.container}>
            <div className={styles.cryptoPaymentCard}>
              <div className={`${styles.cryptoIconContainer} ${styles.cryptoIconContainerSuccess}`}>
                <SuccessIcon width={48} height={48} color="var(--success)" />
              </div>
              <h1 className={styles.cryptoCardTitle}>پرداخت موفق</h1>
              <p className={styles.cryptoCardDescription}>پرداخت شما با موفقیت انجام شد</p>
              <div className={styles.cryptoInfoBox}>
                <div className={styles.cryptoInfoRow}>
                  <span className={styles.cryptoInfoLabel}>مبلغ:</span>
                  <span className={styles.cryptoInfoValue}>{cryptoPaymentData.amountToman.toLocaleString("fa-IR")} تومان</span>
                </div>
                <div className={styles.cryptoInfoRow}>
                  <span className={styles.cryptoInfoLabel}>مبلغ TRX:</span>
                  <span className={styles.cryptoInfoValue}>{formatTrxAmount(cryptoPaymentData.amountTrx)} TRX</span>
                </div>
              </div>
              <button
                onClick={() => {
                  // Clear storage before redirect
                  if (typeof window !== "undefined") {
                    localStorage.removeItem(storageKey);
                  }
                  setCryptoPaymentData(null);
                  cryptoPaymentDataRef.current = null;
                  router.push(`/shop/product/${product?.id}/buy/success?orderNumber=${cryptoPaymentData.orderNumber}`);
                }}
                className={styles.cryptoWalletButton}
              >
                مشاهده سفارش
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Payment expired - only show if cryptoStatus is explicitly "expired"
    // Don't show expired just because timeLeft is 0 initially (it will be calculated from expiresAt)
    // Only show expired if cryptoStatus is "expired" AND status is still "pending" (not completed)
    const isReallyExpired = cryptoPaymentData.cryptoStatus === "expired" && 
                           cryptoPaymentData.status === "pending";
    
    if (isReallyExpired) {
      return (
        <div className={styles.pageWrapper}>
          <PageHeader title="پرداخت ناموفق" />
          <div className={styles.container}>
            <div className={styles.cryptoPaymentCard}>
              <div className={`${styles.cryptoIconContainer} ${styles.cryptoIconContainerError}`}>
                <PaymentFailedIcon width={48} height={48} color="var(--error)" />
              </div>
              <h1 className={styles.cryptoCardTitle}>پرداخت ناموفق</h1>
              <p className={styles.cryptoCardDescription}>زمان پرداخت به پایان رسید</p>
              <p className={styles.cryptoSupportMessage}>
                در صورتی که پرداخت انجام دادید ولی تایید نشد با پشتیبانی در ارتباط باشید
              </p>
              {cryptoPaymentData.trackId && (
                <div className={styles.cryptoTrackIdBox}>
                  <div className={styles.cryptoTrackIdRow}>
                    <span className={styles.cryptoTrackIdLabel}>شماره پیگیری:</span>
                    <span className={styles.cryptoTrackIdValue}>{cryptoPaymentData.trackId}</span>
                  </div>
                </div>
              )}
              <div className={styles.cryptoButtonGroup}>
                <button
                  onClick={() => setCryptoPaymentData(null)}
                  className={styles.cryptoWalletButton}
                >
                  تلاش مجدد
                </button>
                <button
                  onClick={() => router.push("/shop")}
                  className={`${styles.cryptoWalletButton} ${styles.cryptoWalletButtonSecondary}`}
                >
                  بازگشت به فروشگاه
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Payment pending - show payment UI
    return (
      <div className={styles.pageWrapper}>
        <PageHeader title="پرداخت با ترون" />
        <div className={styles.container}>
          <div className={styles.cryptoPaymentCard}>
            <div className={styles.cryptoTitleRow}>
              <h1 className={styles.cryptoCardTitle}>پرداخت با ترون</h1>
              <div className={styles.cryptoTimerInline}>
                <div className={styles.cryptoTimerLabel}>زمان باقی‌مانده:</div>
                <div className={`${styles.cryptoTimer} ${cryptoTimeLeft < 60 ? styles.cryptoTimerWarning : ""}`}>
                  {formatTime(cryptoTimeLeft)}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className={styles.cryptoInstructionsBox}>
              <p className={styles.cryptoInstructionsText}>
                لطفاً دقیقاً <strong>{formatTrxAmount(cryptoPaymentData.amountTrx)} TRX</strong> را به آدرس زیر ارسال کنید.
              </p>
              <p className={styles.cryptoInstructionsText}>
                پس از ارسال، پرداخت به صورت خودکار تأیید می‌شود.
              </p>
            </div>

            {/* Note about refresh */}
            <div className={`${styles.noteWrapper} ${styles.cryptoNoteWrapper}`}>
              <label className={`${styles.noteLabel} ${styles.noteLabelInfo}`}>
                <AlertSquareIcon width={14} height={14} className={styles.noteLabelIcon} color="currentColor" />
                <span>نکته مهم</span>
              </label>
              <div className={`${styles.noteBox} ${styles.noteBoxInfo}`}>
                <p className={`${styles.noteText} ${styles.cryptoNoteText}`}>
                  در صورت انجام پرداخت و عدم انتقال خودکار به صفحه پرداخت موفق، لطفاً صفحه را رفرش نمایید. 
                  در صورت تکمیل موفقیت‌آمیز پرداخت، سفارش شما در داشبورد کاربری اضافه خواهد شد و از طریق پیامک نیز اطلاع‌رسانی انجام خواهد شد.
                </p>
              </div>
            </div>

            {/* Wallet Address */}
            <div className={styles.cryptoAddressRow}>
              <div className={styles.cryptoEmptyBox}>
                {cryptoPaymentData.walletAddress && (
                  <QRCode
                    value={cryptoPaymentData.walletAddress}
                    size={134}
                    ecLevel="H"
                    qrStyle="dots"
                    eyeRadius={8}
                    eyeColor={cryptoPrimaryColor}
                    bgColor="transparent"
                    fgColor={cryptoPrimaryColor}
                    quietZone={10}
                  />
                )}
              </div>
              <div className={styles.cryptoAddressBox}>
                <div className={styles.cryptoAddressLabel}>آدرس کیف پول:</div>
                <div className={styles.cryptoAddressValueContainer}>
                  <code className={styles.cryptoAddressValue}>{cryptoPaymentData.walletAddress}</code>
                </div>
                <button
                  onClick={() => copyToClipboard(cryptoPaymentData.walletAddress)}
                  className={styles.cryptoCopyButton}
                >
                  {cryptoCopied ? "کپی شد!" : "کپی"}
                </button>
              </div>
            </div>

            {/* Amount Info */}
            <div className={styles.cryptoAmountBox}>
              <div className={styles.cryptoAmountRow}>
                <span className={styles.cryptoAmountLabel}>مبلغ پرداخت:</span>
                <span className={styles.cryptoAmountValue}>{cryptoPaymentData.amountToman.toLocaleString("fa-IR")} تومان</span>
              </div>
              <div className={styles.cryptoAmountRow}>
                <span className={styles.cryptoAmountLabel}>مبلغ TRX:</span>
                <span className={styles.cryptoAmountValue}>{formatTrxAmount(cryptoPaymentData.amountTrx)} TRX</span>
              </div>
              <div className={styles.cryptoAmountRow}>
                <span className={styles.cryptoAmountLabel}>قیمت TRX:</span>
                <span className={styles.cryptoAmountValue}>{cryptoPaymentData.trxPrice.toLocaleString("fa-IR")} تومان</span>
              </div>
            </div>

            <button
              onClick={() => setCryptoPaymentData(null)}
              className={`${styles.cryptoWalletButton} ${styles.cryptoWalletButtonSecondary}`}
            >
              بازگشت
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className={styles.pageWrapper}>
        <PageHeader title="خرید محصول" />
        
        <div className={styles.container}>
          {/* Skeleton Loading */}
          <div className={styles.productBoxSkeleton}>
            <div className={styles.productImageSkeleton} />
            <div className={styles.productContentSkeleton}>
              <div className={styles.skeletonLine} style={{ width: '60%', marginBottom: '4px' }} />
              <div className={styles.skeletonLine} style={{ width: '40%', marginBottom: '4px' }} />
              <div className={styles.skeletonLine} style={{ width: '50%' }} />
            </div>
          </div>

          <div className={styles.nextButtonSkeleton} />
        </div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className={styles.pageWrapper}>
        <PageHeader title="خرید محصول" />
        <div className={styles.container}>
          <div className={styles.errorMessage}>
            <p>{error}</p>
            <button onClick={() => router.back()} className={styles.backButton}>
              بازگشت
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  // تابع محاسبه قیمت بر اساس role کاربر
  const getProductPrice = () => {
    const userRole = user?.role?.toLowerCase();
    if (userRole === "merchants") {
      return product.merchantPrice || product.regularPrice;
    }
    return product.regularPrice;
  };

  const productPrice = getProductPrice();

  const hasEnoughBalance = walletBalance !== null && walletBalance >= productPrice;
  const balanceShortage = walletBalance !== null && walletBalance < productPrice 
    ? productPrice - walletBalance 
    : 0;

  // محاسبه درصد پیشرفت
  const getProgressPercentage = () => {
    switch (step) {
      case "userInfo":
        return 33; // 1/3
      case "orderDescription":
        return 67; // 2/3
      case "payment":
        return 100; // 3/3
      default:
        return 0;
    }
  };

  // دریافت نام مرحله فعلی
  const getCurrentStepName = () => {
    switch (step) {
      case "userInfo":
        return "اطلاعات کاربر";
      case "orderDescription":
        return "توضیحات سفارش";
      case "payment":
        return "پرداخت";
      default:
        return "";
    }
  };

  // تابع helper برای دریافت آیکون مرحله فعلی
  const getCurrentStepIcon = () => {
    switch (step) {
      case "userInfo":
        return <NoteIcon width={20} height={20} className={styles.progressIcon} />;
      case "orderDescription":
        return <OrderIcon width={20} height={20} className={styles.progressIcon} />;
      case "payment":
        return <BankCardIcon width={20} height={20} className={styles.progressIcon} />;
      default:
        return null;
    }
  };

  // تابع helper برای تعیین شماره مرحله فعلی
  const getCurrentStepNumber = (): number => {
    if (!needsEmailPassword) {
      // اگر محصول نیاز به ایمیل/پسورد ندارد، فقط 2 مرحله داریم
      switch (step) {
        case "userInfo":
          return 1;
        case "payment":
          return 2;
        default:
          return 1;
      }
    } else {
      // اگر محصول نیاز به ایمیل/پسورد دارد، 3 مرحله داریم
      switch (step) {
        case "userInfo":
          return 1;
        case "orderDescription":
          return 2;
        case "payment":
          return 3;
        default:
          return 1;
      }
    }
  };

  // تابع helper برای تعیین وضعیت هر مرحله
  const getStepStatus = (stepNumber: 1 | 2 | 3) => {
    const currentStepNumber = getCurrentStepNumber();
    if (stepNumber < currentStepNumber) return "completed";
    if (stepNumber === currentStepNumber) return "active";
    return "pending";
  };

  // مرحله 1: اطلاعات کاربر
  if (step === "userInfo") {
    return (
      <div className={styles.pageWrapper}>
        <PageHeader title="خرید محصول" />

        <div className={styles.container}>
          {/* Wrapper برای باکس محصول و پیشرفت */}
          <div className={styles.productWrapper}>
            {/* باکس محصول مشابه صفحه فروشگاه */}
            <div className={styles.productBox}>
            {/* عکس محصول در راست */}
            {product.imagePath ? (
              <div className={styles.productImageContainer}>
                <img
                  src={`${API_BASE_URL}${product.imagePath}`}
                  alt={product.productName}
                  className={styles.productImage}
                />
              </div>
            ) : (
              <div className={styles.productImagePlaceholder}>
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
            <div className={styles.productContent}>
              {/* خط اول: نام | مدت زمان */}
              <div className={styles.productHeader}>
                <div className={styles.productNameRow}>
                  <h3 className={styles.productName}>{product.productName}</h3>
                  <span className={styles.productSeparator}>|</span>
                  <span className={styles.productDuration}>{formatDuration(product.duration)}</span>
                </div>
              </div>

              {/* خط دوم: اطلاعات محصول */}
              <div className={styles.productDetails}>
                <div className={styles.productInfoRow}>
                  <span>{product.accountType}</span>
                  {product.activationTimeMinutes > 0 && (
                    <>
                      <span className={styles.infoSeparator}>•</span>
                      <span>فعالسازی: {product.activationTimeMinutes} دقیقه</span>
                    </>
                  )}
                </div>
                <div className={styles.productInfoRow}>
                  <span>نوع فعالسازی: {product.activationType}</span>
                </div>
              </div>
            </div>
          </div>
            {/* نوار پیشرفت مراحل - ثابت زیر باکس محصول */}
            <div className={styles.progressContainer}>
              <div className={styles.progressHeader}>
                <div className={styles.progressTitle}>
                  {getCurrentStepIcon()}
                  <span>{getCurrentStepName()}</span>
                </div>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressSegments}>
                  {(needsEmailPassword ? [1, 2, 3] : [1, 2]).map((segment) => {
                    const currentStepNumber = getCurrentStepNumber();
                    let segmentClass = styles.progressSegment;
                    
                    if (segment < currentStepNumber) {
                      segmentClass = `${styles.progressSegment} ${styles.progressSegmentCompleted}`;
                    } else if (segment === currentStepNumber) {
                      segmentClass = `${styles.progressSegment} ${styles.progressSegmentActive}`;
                    }
                    
                    return <div key={segment} className={segmentClass} />;
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* فرم اطلاعات کاربر */}
          <div className={styles.userInfoForm}>
            {/* فیلد نام کامل */}
            <div className={styles.fieldWrapper}>
              <label className={styles.fieldLabel}>نام کامل (فارسی)</label>
              <div className={styles.fieldItem}>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={handleSaveFullName}
                  placeholder="نام کامل خود را وارد کنید"
                  className={styles.fieldItemValue}
                  dir="rtl"
                  disabled={hasFullName}
                />
              </div>
            </div>

            {/* فیلد شماره موبایل */}
            <div className={styles.fieldWrapper}>
              <label className={styles.fieldLabel}>شماره موبایل</label>
              {mobileStep === "phone" ? (
                <div className={styles.mobileFieldContainer}>
                  <div className={styles.fieldItem}>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => {
                        let value = e.target.value.replace(/[^\d]/g, "");
                        if (value.length > 11) {
                          value = value.slice(0, 11);
                        }
                        setMobile(value);
                        setError(null);
                      }}
                      placeholder="09123456789"
                      className={styles.fieldItemValue}
                      maxLength={11}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      disabled={!!hasVerifiedPhone}
                    />
                  </div>
                  <button
                    onClick={handleSendVerificationCode}
                    disabled={hasVerifiedPhone || isLoadingUserInfo || !isValidPhone(mobile)}
                    className={styles.verifyButton}
                  >
                    {hasVerifiedPhone ? "تایید شده" : isLoadingUserInfo ? "..." : "تایید شماره"}
                  </button>
                </div>
              ) : (
                <div className={styles.verificationContainer}>
                  <div className={styles.mobileFieldContainer}>
                    <div className={styles.fieldItem}>
                      <input
                        type="tel"
                        value={verificationCode}
                        onChange={(e) => {
                          let value = e.target.value.replace(/[^\d]/g, "");
                          if (value.length > 5) {
                            value = value.slice(0, 5);
                          }
                          setVerificationCode(value);
                          setError(null);
                        }}
                        placeholder="کد 5 رقمی"
                        className={styles.fieldItemValue}
                        maxLength={5}
                        pattern="[0-9]*"
                        inputMode="numeric"
                      />
                    </div>
                    <button
                      onClick={handleVerifyCode}
                      disabled={isLoadingUserInfo || verificationCode.length !== 5}
                      className={styles.verifyButton}
                    >
                      {isLoadingUserInfo ? "..." : "تایید"}
                    </button>
                  </div>
                  <div className={styles.mobileActions}>
                    <button
                      onClick={handleChangeNumber}
                      className={styles.changeNumberButton}
                    >
                      تغییر شماره
                    </button>
                    {resendTimer > 0 ? (
                      <span className={styles.resendTimer}>
                        ارسال مجدد ({formatTimer(resendTimer)})
                      </span>
                    ) : (
                      <button
                        onClick={handleSendVerificationCode}
                        disabled={isLoadingUserInfo}
                        className={styles.resendButton}
                      >
                        ارسال مجدد
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* پیام خطا */}
            {error && (
              <div className={styles.errorBox}>
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* دکمه‌های ادامه و بازگشت - ثابت در پایین */}
          <div 
            className={styles.buttonFixedContainer}
            style={
              shouldApplySpacing
                ? {
                    paddingBottom: "max(2rem, env(safe-area-inset-bottom) + 0.5rem)",
                  }
                : {}
            }
          >
            <div className={styles.buttonRow}>
              <button
                onClick={() => router.back()}
                className={styles.backButton}
              >
                بازگشت
              </button>
              <button
                onClick={() => {
                  // بررسی اینکه اطلاعات لازم وارد شده است
                  if (!fullName.trim()) {
                    setError("لطفاً نام کامل خود را وارد کنید");
                    return;
                  }
                  if (!mobile.trim() || !isValidPhone(mobile)) {
                    setError("لطفاً شماره موبایل معتبر وارد کنید");
                    return;
                  }
                  if (mobileStep === "verification") {
                    setError("لطفاً شماره موبایل خود را تایید کنید");
                    return;
                  }
                  setError(null);
                  // اگر محصول نیاز به ایمیل/پسورد دارد، به مرحله توضیحات سفارش برو
                  // در غیر این صورت مستقیماً به پرداخت برو
                  if (needsEmailPassword) {
                    setStep("orderDescription");
                  } else {
                    setStep("payment");
                  }
                }}
                disabled={isLoadingUserInfo}
                className={styles.nextButton}
              >
                ادامه
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // مرحله 2: توضیحات سفارش (فقط برای محصولاتی که نیاز به ایمیل/پسورد دارند)
  if (step === "orderDescription" && needsEmailPassword) {
    return (
      <div className={styles.pageWrapper}>
        <PageHeader title="توضیحات سفارش" />

        <div className={styles.container}>
          {/* Wrapper برای باکس محصول و پیشرفت */}
          <div className={styles.productWrapper}>
            {/* باکس محصول */}
            <div className={styles.productBox}>
              {product.imagePath ? (
                <div className={styles.productImageContainer}>
                  <img
                    src={`${API_BASE_URL}${product.imagePath}`}
                    alt={product.productName}
                    className={styles.productImage}
                  />
                </div>
              ) : (
                <div className={styles.productImagePlaceholder}>
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
              <div className={styles.productContent}>
                <div className={styles.productHeader}>
                  <div className={styles.productNameRow}>
                    <h3 className={styles.productName}>{product.productName}</h3>
                    <span className={styles.productSeparator}>|</span>
                    <span className={styles.productDuration}>{formatDuration(product.duration)}</span>
                  </div>
                </div>
                <div className={styles.productDetails}>
                  <div className={styles.productInfoRow}>
                    <span>{product.accountType}</span>
                    {product.activationTimeMinutes > 0 && (
                      <>
                        <span className={styles.infoSeparator}>•</span>
                        <span>فعالسازی: {product.activationTimeMinutes} دقیقه</span>
                      </>
                    )}
                  </div>
                  <div className={styles.productInfoRow}>
                    <span>نوع فعالسازی: {product.activationType}</span>
                  </div>
                </div>
              </div>
            </div>
            {/* نوار پیشرفت مراحل - ثابت زیر باکس محصول */}
            <div className={styles.progressContainer}>
              <div className={styles.progressHeader}>
                <div className={styles.progressTitle}>
                  {getCurrentStepIcon()}
                  <span>{getCurrentStepName()}</span>
                </div>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressSegments}>
                  {(needsEmailPassword ? [1, 2, 3] : [1, 2]).map((segment) => {
                    const currentStepNumber = getCurrentStepNumber();
                    let segmentClass = styles.progressSegment;
                    
                    if (segment < currentStepNumber) {
                      segmentClass = `${styles.progressSegment} ${styles.progressSegmentCompleted}`;
                    } else if (segment === currentStepNumber) {
                      segmentClass = `${styles.progressSegment} ${styles.progressSegmentActive}`;
                    }
                    
                    return <div key={segment} className={segmentClass} />;
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* فرم توضیحات سفارش */}
          <div className={styles.orderForm}>
            {/* نوت امنیت */}
            <div className={styles.noteWrapper}>
              <label className={`${styles.noteLabel} ${styles.noteLabelInfo}`}>
                <AlertSquareIcon width={14} height={14} className={styles.noteLabelIcon} color="currentColor" />
                <span>اطلاعات امنیتی</span>
              </label>
              <div className={`${styles.noteBox} ${styles.noteBoxInfo}`}>
                <p className={styles.noteText}>لطفاً توجه داشته باشید که از شما پسورد دریافت نخواهد شد. تیم پشتیبانی ما پس از تکمیل سفارش، در کوتاه‌ترین زمان ممکن با شما تماس حاصل نموده و فرآیند فعال‌سازی اکانت را انجام خواهند داد.</p>
              </div>
            </div>

            {/* فیلد ایمیل */}
            <div className={styles.fieldWrapper}>
              <label className={styles.fieldLabel}>ایمیلی که می‌خواهید سفارش بر روی آن باشد</label>
              <div className={styles.fieldItem}>
                <input
                  type="email"
                  value={orderEmail}
                  onChange={(e) => setOrderEmail(e.target.value)}
                  placeholder="example@email.com"
                  className={styles.fieldItemValue}
                  dir="ltr"
                />
              </div>
            </div>

            {/* پیام خطا */}
            {error && (
              <div className={styles.errorBox}>
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* دکمه‌های ادامه و بازگشت - ثابت در پایین */}
          <div 
            className={styles.buttonFixedContainer}
            style={
              shouldApplySpacing
                ? {
                    paddingBottom: "max(2rem, env(safe-area-inset-bottom) + 0.5rem)",
                  }
                : {}
            }
          >
            <div className={styles.buttonRow}>
              <button
                onClick={() => setStep("userInfo")}
                className={styles.backButton}
              >
                بازگشت
              </button>
              <button
                onClick={() => {
                  // بررسی اینکه اطلاعات لازم وارد شده است
                  if (!orderEmail.trim()) {
                    setError("لطفاً ایمیل خود را وارد کنید");
                    return;
                  }
                  if (!isValidEmail(orderEmail)) {
                    setError("لطفاً یک ایمیل معتبر وارد کنید");
                    return;
                  }
                  setError(null);
                  setStep("payment");
                }}
                className={styles.nextButton}
              >
                ادامه
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // مرحله 3: خلاصه قیمت و پرداخت
  return (
    <div className={styles.pageWrapper}>
      <PageHeader title="تأیید خرید" />

      <div className={styles.container}>
        {/* Wrapper برای باکس محصول و پیشرفت */}
        <div className={styles.productWrapper}>
          {/* باکس محصول (نمایش سریع) */}
          <div className={styles.productBox}>
            {product.imagePath ? (
              <div className={styles.productImageContainer}>
                <img
                  src={`${API_BASE_URL}${product.imagePath}`}
                  alt={product.productName}
                  className={styles.productImage}
                />
              </div>
            ) : (
              <div className={styles.productImagePlaceholder}>
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
            <div className={styles.productContent}>
              <div className={styles.productHeader}>
                <div className={styles.productNameRow}>
                  <h3 className={styles.productName}>{product.productName}</h3>
                  <span className={styles.productSeparator}>|</span>
                  <span className={styles.productDuration}>{formatDuration(product.duration)}</span>
                </div>
              </div>
              <div className={styles.productDetails}>
                <div className={styles.productInfoRow}>
                  <span>{product.accountType}</span>
                  {product.activationTimeMinutes > 0 && (
                    <>
                      <span className={styles.infoSeparator}>•</span>
                      <span>فعالسازی: {product.activationTimeMinutes} دقیقه</span>
                    </>
                  )}
                </div>
                <div className={styles.productInfoRow}>
                  <span>نوع فعالسازی: {product.activationType}</span>
                </div>
              </div>
            </div>
          </div>
          {/* نوار پیشرفت مراحل - ثابت زیر باکس محصول */}
          <div className={styles.progressContainer}>
            <div className={styles.progressHeader}>
              <div className={styles.progressTitle}>
                {getCurrentStepIcon()}
                <span>{getCurrentStepName()}</span>
              </div>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressSegments}>
                {(needsEmailPassword ? [1, 2, 3] : [1, 2]).map((segment) => {
                  const currentStepNumber = getCurrentStepNumber();
                  let segmentClass = styles.progressSegment;
                  
                  if (segment < currentStepNumber) {
                    segmentClass = `${styles.progressSegment} ${styles.progressSegmentCompleted}`;
                  } else if (segment === currentStepNumber) {
                    segmentClass = `${styles.progressSegment} ${styles.progressSegmentActive}`;
                  }
                  
                  return <div key={segment} className={segmentClass} />;
                })}
              </div>
            </div>
          </div>
        </div>

        {/* انتخاب روش پرداخت */}
        <div className={styles.paymentMethods}>
          <div className={styles.fieldWrapper}>
            <label className={styles.fieldLabel}>انتخاب روش پرداخت</label>
            <div 
              className={`${styles.fieldItem} ${paymentMethod === "wallet" ? styles.paymentMethodItemSelected : ''}`}
              onClick={() => setPaymentMethod("wallet")}
            >
              <input
                type="radio"
                id="wallet"
                name="paymentMethod"
                value="wallet"
                checked={paymentMethod === "wallet"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={styles.paymentMethodRadio}
                onClick={(e) => e.stopPropagation()}
              />
              <label htmlFor="wallet" className={styles.paymentMethodLabel}>
                <span className={styles.menuIcon}>
                  <MoneyBagIcon width={18} height={18} />
                </span>
                <span className={styles.fieldItemValue}>پرداخت با کیف پول</span>
                <span className={styles.paymentMethodInfo}>
                  {walletBalance !== null ? (
                    <>
                      <span>موجودی: {walletBalance.toLocaleString('fa-IR')} تومان</span>
                      <span className={walletBalance >= productPrice ? styles.sufficientBalance : styles.insufficientBalance}>
                        {walletBalance >= productPrice ? "کافی" : "ناکافی"}
                      </span>
                    </>
                  ) : (
                    <span>--</span>
                  )}
                </span>
              </label>
            </div>
          </div>

          <div className={styles.fieldWrapper}>
            <div 
              className={`${styles.fieldItem} ${paymentMethod === "online" ? styles.paymentMethodItemSelected : ''}`}
              onClick={() => setPaymentMethod("online")}
            >
              <input
                type="radio"
                id="online"
                name="paymentMethod"
                value="online"
                checked={paymentMethod === "online"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={styles.paymentMethodRadio}
                onClick={(e) => e.stopPropagation()}
              />
              <label htmlFor="online" className={styles.paymentMethodLabel}>
                <span className={styles.menuIcon}>
                  <BankCardIcon width={18} height={18} />
                </span>
                <span className={styles.fieldItemValue}>پرداخت آنلاین با درگاه</span>
                <span className={styles.paymentMethodInfo}>
                  <span>
                    {walletBalance !== null && walletBalance > 0 && useWalletBalance && walletBalance < productPrice
                      ? formatPrice(productPrice - walletBalance)
                      : formatPrice(productPrice)
                    } تومان
                  </span>
                </span>
              </label>
              {walletBalance !== null && walletBalance > 0 && walletBalance < productPrice && (
                <div 
                  className={styles.walletCheckboxContainer}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    id="useWalletBalance"
                    checked={useWalletBalance}
                    onChange={(e) => setUseWalletBalance(e.target.checked)}
                    className={styles.walletCheckbox}
                  />
                  <label htmlFor="useWalletBalance" className={styles.walletCheckboxLabel}>
                    استفاده از موجودی کیف پول ({walletBalance.toLocaleString('fa-IR')} تومان)
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className={styles.fieldWrapper}>
            <div 
              className={`${styles.fieldItem} ${paymentMethod === "crypto" ? styles.paymentMethodItemSelected : ''}`}
              onClick={() => setPaymentMethod("crypto")}
            >
              <input
                type="radio"
                id="crypto"
                name="paymentMethod"
                value="crypto"
                checked={paymentMethod === "crypto"}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={styles.paymentMethodRadio}
                onClick={(e) => e.stopPropagation()}
              />
              <label htmlFor="crypto" className={styles.paymentMethodLabel}>
                <span className={styles.menuIcon}>
                  <DepositCryptoIcon width={18} height={18} />
                </span>
                <span className={styles.fieldItemValue}>پرداخت با ارز دیجیتال</span>
              </label>
            </div>
          </div>
        </div>

        {/* پیام خطا */}
        {error && (
          <div className={styles.errorBox}>
            <p>{error}</p>
          </div>
        )}

        {/* دکمه‌های ادامه و بازگشت - ثابت در پایین */}
        <div 
          className={styles.buttonFixedContainer}
          style={
            shouldApplySpacing
              ? {
                  paddingBottom: "max(2rem, env(safe-area-inset-bottom) + 0.5rem)",
                }
              : {}
          }
        >
          <div className={styles.buttonRow}>
            <button
              onClick={() => {
                if (needsEmailPassword) {
                  setStep("orderDescription");
                } else {
                  setStep("userInfo");
                }
              }}
              className={styles.backButton}
            >
              بازگشت
            </button>
            <button
              onClick={handlePurchase}
              disabled={purchasing || !paymentMethod}
              className={styles.nextButton}
            >
              {purchasing ? "در حال پردازش..." : "تأیید و خرید"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BuyProductPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
        </div>
      </div>
    }>
      <BuyProductPageContent />
    </Suspense>
  );
}

