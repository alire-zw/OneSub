"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "./Banners.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import AddProductIcon from "@/components/icons/AddProductIcon";
import EditIcon from "@/components/icons/EditIcon";
import TrashIcon from "@/components/icons/TrashIcon";
import CenterModal from "@/components/CenterModal";
import Notification from "@/components/Notification";

interface Banner {
  id: number;
  imagePath: string;
  linkType: 'product' | 'category';
  linkId: number | null;
  linkValue: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminBannersPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  // بارگذاری بنرها
  useEffect(() => {
    const fetchBanners = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_ENDPOINTS.BANNERS.LIST}?all=true`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch banners");
        }

        const data = await response.json();
        if (data.status === 1 && data.data) {
          setBanners(data.data);
        }
      } catch (error) {
        console.error("خطا در دریافت بنرها:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      fetchBanners();
    }
  }, [authLoading]);

  const showNotification = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }));
  };

  const handleDelete = (banner: Banner) => {
    setSelectedBanner(banner);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBanner) {
      showNotification("لطفاً بنری را انتخاب کنید", "error");
      setIsDeleteModalOpen(false);
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(API_ENDPOINTS.BANNERS.DELETE(selectedBanner.id.toString()), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (data.status === 1) {
        setBanners(banners.filter(b => b.id !== selectedBanner.id));
        showNotification("بنر با موفقیت حذف شد", "success");
        setIsDeleteModalOpen(false);
        setSelectedBanner(null);
      } else {
        showNotification(data.message || "خطا در حذف بنر", "error");
        setIsDeleteModalOpen(false);
      }
    } catch (error) {
      console.error("Error deleting banner:", error);
      showNotification("خطا در ارتباط با سرور", "error");
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setSelectedBanner(null);
  };

  const getLinkText = (banner: Banner) => {
    if (banner.linkType === 'product') {
      return `محصول #${banner.linkId}`;
    } else {
      return `دسته‌بندی: ${banner.linkValue}`;
    }
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="مدیریت بنرها" onBack={() => router.push("/admin")} />
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>بنرها</h3>
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
      {/* Header */}
      <PageHeader title="مدیریت بنرها" onBack={() => router.push("/admin")} />

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>بنرها</h3>

          {/* دکمه‌های مدیریت */}
          <div className={styles.actionButtonsContainer}>
            <button className={styles.actionButton} onClick={() => router.push("/admin/banners/add")}>
              <AddProductIcon width={18} height={18} />
              <span>افزودن بنر</span>
            </button>
          </div>

          {/* لیست بنرها */}
          <div className={styles.itemsContainer}>
            {isLoading ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>در حال بارگذاری...</p>
              </div>
            ) : banners.length === 0 ? (
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
                <p className={styles.emptyText}>هیچ بنری ثبت نشده است</p>
              </div>
            ) : (
              banners.map((banner, index) => (
                <div key={banner.id}>
                  <div className={styles.listItem}>
                    <div className={styles.listItemStart}>
                      {banner.imagePath ? (
                        <div className={styles.bannerImage}>
                          <img
                            src={`${API_BASE_URL}${banner.imagePath}`}
                            alt={`Banner ${banner.id}`}
                            className={styles.bannerImageImg}
                          />
                        </div>
                      ) : (
                        <div className={styles.bannerImagePlaceholder}>
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
                        <div className={styles.itemText}>
                          ترتیب: {banner.displayOrder} - {getLinkText(banner)}
                        </div>
                        <div className={styles.itemValue}>
                          {banner.linkType === 'product' ? 'محصول' : 'دسته‌بندی'}
                        </div>
                      </div>
                    </div>
                    <div className={styles.listItemEnd}>
                      <div
                        className={`${styles.statusBadge} ${
                          banner.isActive ? styles.active : styles.inactive
                        }`}
                      >
                        {banner.isActive ? "فعال" : "غیرفعال"}
                      </div>
                      <button
                        className={styles.editButton}
                        onClick={() => router.push(`/admin/banners/edit/${banner.id}`)}
                        aria-label="ویرایش"
                      >
                        <EditIcon width={16} height={16} />
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDelete(banner)}
                        aria-label="حذف"
                      >
                        <TrashIcon width={16} height={16} />
                      </button>
                    </div>
                  </div>
                  {index < banners.length - 1 && (
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
        title="تایید حذف بنر"
        description={
          selectedBanner
            ? `آیا مطمئن هستید که می‌خواهید این بنر را حذف کنید؟ این عمل قابل بازگشت نیست.`
            : ""
        }
        buttons={[
          {
            label: "انصراف",
            onClick: handleCancelDelete,
            variant: "default",
            disabled: isDeleting,
          },
          {
            label: isDeleting ? "در حال حذف..." : "حذف بنر",
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

