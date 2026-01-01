"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "../Products.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, getAuthHeaders } from "@/config/api";
import Notification from "@/components/Notification";
import CenterModal from "@/components/CenterModal";

interface Product {
  id: number;
  productName: string;
  category: string;
  accountType: string;
  regularPrice: number;
  imagePath?: string;
  isActive: boolean;
}

function DeleteProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  const showNotification = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }));
  };

  // بارگذاری محصولات
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/products`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }

        const data = await response.json();
        if (data.status === 1 && data.data) {
          setProducts(data.data);
        }
      } catch (error) {
        console.error("خطا در دریافت محصولات:", error);
        showNotification("خطا در دریافت محصولات", "error");
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      fetchProducts();
    }
  }, [authLoading]);

  // اگر id در query string باشد، آن محصول را انتخاب کن و modal را باز کن
  useEffect(() => {
    const productIdParam = searchParams.get("id");
    if (productIdParam && products.length > 0) {
      const id = parseInt(productIdParam);
      if (!isNaN(id) && products.some(p => p.id === id)) {
        setSelectedProductId(id);
        setIsDeleteModalOpen(true);
      }
    }
  }, [searchParams, products]);

  const handleProductClick = (productId: number) => {
    setSelectedProductId(productId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedProductId) {
      showNotification("لطفاً محصولی را انتخاب کنید", "error");
      setIsDeleteModalOpen(false);
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${selectedProductId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (data.status === 1) {
        showNotification("محصول با موفقیت حذف شد", "success");
        setIsDeleteModalOpen(false);
        // حذف محصول از لیست
        setProducts(products.filter(p => p.id !== selectedProductId));
        setSelectedProductId(null);
        // اگر لیست خالی شد، برگشت به صفحه لیست
        if (products.length === 1) {
          setTimeout(() => {
            router.push("/admin/products");
          }, 1500);
        }
      } else {
        showNotification(data.message || "خطا در حذف محصول", "error");
        setIsDeleteModalOpen(false);
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      showNotification("خطا در ارتباط با سرور", "error");
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fa-IR").format(price);
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="حذف محصول" onBack={() => router.push("/admin/products")} />
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>محصولات</h3>
            <div className={styles.itemsContainer}>
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
      <PageHeader title="حذف محصول" onBack={() => router.push("/admin/products")} />

      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>محصولات</h3>

          {/* لیست محصولات */}
          <div className={styles.itemsContainer}>
            {isLoading ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>در حال بارگذاری...</p>
              </div>
            ) : products.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg
                    width="64"
                    height="41"
                    viewBox="0 0 64 41"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <title>No data</title>
                    <g transform="translate(0 1)" fill="none" fillRule="evenodd">
                      <ellipse
                        fill="var(--background-secondary)"
                        cx="32"
                        cy="33"
                        rx="32"
                        ry="7"
                      ></ellipse>
                      <g fillRule="nonzero" stroke="var(--border)">
                        <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z"></path>
                        <path
                          d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z"
                          fill="var(--background-secondary)"
                        ></path>
                      </g>
                    </g>
                  </svg>
                </div>
                <p className={styles.emptyText}>هیچ محصولی ثبت نشده است</p>
              </div>
            ) : (
              products.map((product, index) => (
                <div key={product.id}>
                  <div className={styles.listItem} onClick={() => handleProductClick(product.id)}>
                    <div className={styles.listItemStart}>
                      {product.imagePath ? (
                        <div className={styles.productImage}>
                          <img
                            src={`${API_BASE_URL}${product.imagePath}`}
                            alt={product.productName}
                            className={styles.productImageImg}
                          />
                        </div>
                      ) : (
                        <div className={styles.productImagePlaceholder}>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                        </div>
                      )}
                      <div className={styles.itemContent}>
                        <div className={styles.itemText}>{product.productName}</div>
                        <div className={styles.itemValue}>
                          {product.category} - {product.accountType} | قیمت:{" "}
                          {formatPrice(product.regularPrice)} تومان
                        </div>
                      </div>
                    </div>
                    <div className={styles.listItemEnd}>
                      <div
                        className={`${styles.statusBadge} ${
                          product.isActive ? styles.active : styles.inactive
                        }`}
                      >
                        {product.isActive ? "فعال" : "غیرفعال"}
                      </div>
                    </div>
                  </div>
                  {index < products.length - 1 && (
                    <div className={styles.menuDivider}></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal تایید حذف */}
      <CenterModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        title="تایید حذف محصول"
        description={selectedProduct ? `آیا مطمئن هستید که می‌خواهید محصول "${selectedProduct.productName}" را حذف کنید؟ این عمل قابل بازگشت نیست.` : ""}
        buttons={[
          {
            label: "انصراف",
            onClick: handleCancelDelete,
            variant: "default",
            disabled: isDeleting,
          },
          {
            label: isDeleting ? "در حال حذف..." : "حذف محصول",
            onClick: handleConfirmDelete,
            variant: "danger",
            disabled: isDeleting,
          },
        ]}
      />

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />
    </div>
  );
}

export default function DeleteProductPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <PageHeader title="حذف محصول" onBack={() => {}} />
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>محصولات</h3>
            <div className={styles.itemsContainer}>
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>در حال بارگذاری...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <DeleteProductContent />
    </Suspense>
  );
}

