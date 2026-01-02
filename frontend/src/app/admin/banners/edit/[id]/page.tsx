"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "../../add/AddBanner.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from "@/config/api";
import Notification from "@/components/Notification";
import SuccessIcon from "@/components/icons/SuccessIcon";

interface Product {
  id: number;
  productName: string;
}

interface Banner {
  id: number;
  imagePath: string;
  linkType: 'product' | 'category';
  linkId: number | null;
  linkValue: string | null;
  displayOrder: number;
  isActive: boolean;
}

export default function EditBannerPage() {
  const router = useRouter();
  const params = useParams();
  const bannerId = params?.id as string;
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBanner, setIsLoadingBanner] = useState(true);
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
  const [currentImagePath, setCurrentImagePath] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // بارگذاری بنر موجود
  useEffect(() => {
    const fetchBanner = async () => {
      if (!bannerId) return;
      
      setIsLoadingBanner(true);
      try {
        const response = await fetch(API_ENDPOINTS.BANNERS.GET(bannerId), {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch banner");
        }

        const data = await response.json();
        if (data.status === 1 && data.data) {
          const banner: Banner = data.data;
          setFormData({
            linkType: banner.linkType,
            linkId: banner.linkId?.toString() || "",
            linkValue: banner.linkValue || "",
            displayOrder: banner.displayOrder.toString(),
            isActive: banner.isActive,
            imagePath: banner.imagePath,
          });
          setCurrentImagePath(banner.imagePath);
          setImagePreview(`${API_BASE_URL}${banner.imagePath}`);
        } else {
          showNotification("بنر یافت نشد", "error");
          setTimeout(() => {
            router.push("/admin/banners");
          }, 1500);
        }
      } catch (error) {
        console.error("Error fetching banner:", error);
        showNotification("خطا در دریافت اطلاعات بنر", "error");
        setTimeout(() => {
          router.push("/admin/banners");
        }, 1500);
      } finally {
        setIsLoadingBanner(false);
      }
    };

    if (!authLoading && bannerId) {
      fetchBanner();
    }
  }, [authLoading, bannerId, router]);

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
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
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
          setImagePreview(currentImagePath ? `${API_BASE_URL}${currentImagePath}` : null);
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        showNotification('خطا در آپلود تصویر', 'error');
        setImageFile(null);
        setImagePreview(currentImagePath ? `${API_BASE_URL}${currentImagePath}` : null);
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.imagePath && !currentImagePath) {
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
      // فقط اگر تصویر جدید آپلود شده باشد، آن را ارسال می‌کنیم
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
      const response = await fetch(API_ENDPOINTS.BANNERS.UPDATE(bannerId), {
        method: "PUT",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (data.status === 1) {
        showNotification("بنر با موفقیت بروزرسانی شد", "success");
        setTimeout(() => {
          router.push("/admin/banners");
        }, 1000);
      } else {
        showNotification(data.message || "خطا در بروزرسانی بنر", "error");
      }
    } catch (error) {
      console.error("Error updating banner:", error);
      showNotification("خطا در ارتباط با سرور", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoadingBanner) {
    return (
      <div className={styles.container}>
        <PageHeader title="ویرایش بنر" onBack={() => router.push("/admin/banners")} />
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
      <PageHeader title="ویرایش بنر" onBack={() => router.push("/admin/banners")} />

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
                    <span>{imageFile ? 'اپلود شد' : 'تصویر فعلی'}</span>
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
                    <span>{isUploadingImage ? 'در حال آپلود...' : 'انتخاب عکس جدید'}</span>
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

          {/* وضعیت فعال/غیرفعال */}
          <div className={styles.formGroup}>
            <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleInputChange}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>فعال</span>
            </label>
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
              {isLoading ? "در حال بروزرسانی..." : "ذخیره تغییرات"}
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

