"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "./AddBanner.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import Notification from "@/components/Notification";
import SuccessIcon from "@/components/icons/SuccessIcon";

interface Product {
  id: number;
  productName: string;
}

export default function AddBannerPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState({
    linkType: "product" as "product" | "category",
    linkId: "",
    linkValue: "",
    displayOrder: "1",
    isActive: true,
    imagePath: "",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // بارگذاری محصولات برای dropdown
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.PRODUCTS.LIST, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        if (data.status === 1 && data.data) {
          setProducts(data.data);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    if (!authLoading) {
      fetchProducts();
    }
  }, [authLoading]);

  const showNotification = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append('image', file);

        const token = localStorage.getItem('auth_token');
        const response = await fetch(API_ENDPOINTS.BANNERS.UPLOAD_IMAGE, {
          method: 'POST',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: formData,
        });

        const data = await response.json();

        if (data.status === 1 && data.data?.imagePath) {
          setFormData(prev => ({
            ...prev,
            imagePath: data.data.imagePath,
          }));
          showNotification('تصویر با موفقیت آپلود شد', 'success');
        } else {
          showNotification(data.message || 'خطا در آپلود تصویر', 'error');
          setImageFile(null);
          setImagePreview(null);
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        showNotification('خطا در آپلود تصویر', 'error');
        setImageFile(null);
        setImagePreview(null);
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.imagePath) {
      showNotification("لطفاً تصویر بنر را آپلود کنید", "error");
      return;
    }

    if (formData.linkType === "product" && !formData.linkId) {
      showNotification("لطفاً محصول را انتخاب کنید", "error");
      return;
    }

    if (formData.linkType === "category" && !formData.linkValue) {
      showNotification("لطفاً دسته‌بندی را انتخاب کنید", "error");
      return;
    }

    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }
      formDataToSend.append('linkType', formData.linkType);
      if (formData.linkType === 'product') {
        formDataToSend.append('linkId', formData.linkId);
      } else {
        formDataToSend.append('linkValue', formData.linkValue);
      }
      formDataToSend.append('displayOrder', formData.displayOrder);
      formDataToSend.append('isActive', formData.isActive.toString());

      const token = localStorage.getItem('auth_token');
      const response = await fetch(API_ENDPOINTS.BANNERS.CREATE, {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (data.status === 1) {
        showNotification("بنر با موفقیت اضافه شد", "success");
        setTimeout(() => {
          router.push("/admin/banners");
        }, 1000);
      } else {
        showNotification(data.message || "خطا در افزودن بنر", "error");
      }
    } catch (error) {
      console.error("Error adding banner:", error);
      showNotification("خطا در ارتباط با سرور", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="افزودن بنر" onBack={() => router.push("/admin/banners")} />
        <div className={styles.content}>
          <div className={styles.formContainer}>
            <p>در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <PageHeader title="افزودن بنر" onBack={() => router.push("/admin/banners")} />

      <div className={styles.content}>
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* اپلود عکس */}
          <div className={styles.formGroup}>
            <label className={styles.label}>عکس بنر *</label>
            <div className={styles.imageUpload}>
              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={handleImageChange}
                className={styles.fileInput}
              />
              <label htmlFor="image" className={`${styles.fileLabel} ${imagePreview ? styles.uploaded : ''} ${isUploadingImage ? styles.uploading : ''}`}>
                {imagePreview ? (
                  <div className={styles.uploadSuccess}>
                    <SuccessIcon width={20} height={20} />
                    <span>اپلود شد</span>
                  </div>
                ) : (
                  <div className={styles.uploadPlaceholder}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span>{isUploadingImage ? 'در حال آپلود...' : 'انتخاب عکس'}</span>
                  </div>
                )}
              </label>
            </div>
            {imagePreview && (
              <img src={imagePreview} alt="Preview" className={styles.previewImage} />
            )}
          </div>

          {/* نوع لینک */}
          <div className={styles.formGroup}>
            <label className={styles.label}>نوع لینک *</label>
            <select
              name="linkType"
              value={formData.linkType}
              onChange={handleInputChange}
              className={styles.select}
              required
            >
              <option value="product">محصول</option>
              <option value="category">دسته‌بندی</option>
            </select>
          </div>

          {/* لینک بر اساس نوع */}
          {formData.linkType === "product" ? (
            <div className={styles.formGroup}>
              <label className={styles.label}>محصول *</label>
              <select
                name="linkId"
                value={formData.linkId}
                onChange={handleInputChange}
                className={styles.select}
                required
              >
                <option value="">انتخاب کنید</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.productName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className={styles.formGroup}>
              <label className={styles.label}>دسته‌بندی *</label>
              <select
                name="linkValue"
                value={formData.linkValue}
                onChange={handleInputChange}
                className={styles.select}
                required
              >
                <option value="">انتخاب کنید</option>
                <option value="ChatGPT">ChatGPT</option>
                <option value="Gemini">Gemini</option>
                <option value="Cursor">Cursor</option>
                <option value="CapCut">CapCut</option>
                <option value="Discord">Discord</option>
                <option value="Youtube">Youtube</option>
              </select>
            </div>
          )}

          {/* ترتیب نمایش */}
          <div className={styles.formGroup}>
            <label className={styles.label}>ترتیب نمایش *</label>
            <input
              type="number"
              name="displayOrder"
              value={formData.displayOrder}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="1"
              min="1"
              required
            />
          </div>

          {/* دکمه‌های فرم */}
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={() => router.push("/admin/banners")}
              className={styles.cancelButton}
              disabled={isLoading}
            >
              انصراف
            </button>
            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? "در حال افزودن..." : "افزودن بنر"}
            </button>
          </div>
        </form>
      </div>

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />
    </div>
  );
}

