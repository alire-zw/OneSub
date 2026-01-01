"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "./AddProduct.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, getAuthHeaders } from "@/config/api";
import Notification from "@/components/Notification";
import SuccessIcon from "@/components/icons/SuccessIcon";

export default function AddProductPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  const [formData, setFormData] = useState({
    productName: "",
    category: "",
    accountType: "",
    duration: "",
    purchasePrice: "",
    regularPrice: "",
    merchantPrice: "",
    activationTimeMinutes: "",
    activationType: "",
    additionalInfo: "",
    noteType: "",
    noteText: "",
    imagePath: "",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const showNotification = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }));
  };

  const formatNumberWithCommas = (value: string): string => {
    // حذف تمام کاراکترهای غیر عددی (به جز کاما)
    const numbers = value.replace(/[^\d,]/g, "").replace(/,/g, "");
    // اگر خالی بود، خالی برگردان
    if (!numbers) return "";
    // افزودن تفکیک هزارگان
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const parseNumberFromString = (value: string): string => {
    // حذف کاماها و تبدیل به عدد
    return value.replace(/,/g, "");
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    // اگر فیلد قیمتی است، فرمت کن
    if (name === "purchasePrice" || name === "regularPrice" || name === "merchantPrice") {
      const formatted = formatNumberWithCommas(value);
      setFormData((prev) => ({
        ...prev,
        [name]: formatted,
      }));
    } else if (name === "duration" || name === "activationTimeMinutes") {
      // فقط عدد برای مدت زمان
      const numbers = value.replace(/\D/g, "");
      setFormData((prev) => ({
        ...prev,
        [name]: numbers,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Preview
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload image
      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append('image', file);

        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/products/upload-image`, {
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

    // Validation
    if (!formData.productName.trim()) {
      showNotification("لطفاً نام محصول را وارد کنید", "error");
      return;
    }
    if (!formData.category) {
      showNotification("لطفاً دسته‌بندی را انتخاب کنید", "error");
      return;
    }
    if (!formData.accountType) {
      showNotification("لطفاً نوع اکانت را انتخاب کنید", "error");
      return;
    }
    if (!formData.duration || parseInt(formData.duration) <= 0) {
      showNotification("لطفاً مدت زمان را وارد کنید", "error");
      return;
    }
    if (!formData.purchasePrice || parseFloat(formData.purchasePrice) < 0) {
      showNotification("لطفاً قیمت خرید را وارد کنید", "error");
      return;
    }
    if (!formData.regularPrice || parseFloat(formData.regularPrice) < 0) {
      showNotification("لطفاً قیمت کاربر عادی را وارد کنید", "error");
      return;
    }
    if (!formData.merchantPrice || parseFloat(formData.merchantPrice) < 0) {
      showNotification("لطفاً قیمت همکار را وارد کنید", "error");
      return;
    }
    if (!formData.activationType) {
      showNotification("لطفاً نوع فعالسازی را انتخاب کنید", "error");
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        productName: formData.productName.trim(),
        category: formData.category,
        accountType: formData.accountType,
        duration: parseInt(formData.duration),
        purchasePrice: parseFloat(parseNumberFromString(formData.purchasePrice)),
        regularPrice: parseFloat(parseNumberFromString(formData.regularPrice)),
        merchantPrice: parseFloat(parseNumberFromString(formData.merchantPrice)),
        activationTimeMinutes: parseInt(formData.activationTimeMinutes) || 0,
        activationType: formData.activationType,
        imagePath: formData.imagePath || null,
        additionalInfo: formData.additionalInfo.trim() || null,
        isActive: true,
      };

      // اضافه کردن فیلدهای نکته (فقط اگر هر دو مقدار داشته باشند)
      if (formData.noteType && formData.noteText.trim()) {
        payload.noteType = formData.noteType;
        payload.noteText = formData.noteText.trim();
      }

      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.status === 1) {
        showNotification("محصول با موفقیت اضافه شد", "success");
        setTimeout(() => {
          router.push("/admin/products");
        }, 1000);
      } else {
        showNotification(data.message || "خطا در افزودن محصول", "error");
      }
    } catch (error) {
      console.error("Error adding product:", error);
      showNotification("خطا در ارتباط با سرور", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="افزودن محصول" onBack={() => router.push("/admin/products")} />
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
      <PageHeader title="افزودن محصول" onBack={() => router.push("/admin/products")} />

      <div className={styles.content}>
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* اپلود عکس */}
          <div className={styles.formGroup}>
            <label className={styles.label}>عکس محصول</label>
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
          </div>

          {/* نام محصول */}
          <div className={styles.formGroup}>
            <label className={styles.label}>نام محصول *</label>
            <input
              type="text"
              name="productName"
              value={formData.productName}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="نام محصول"
              required
            />
          </div>

          {/* دسته‌بندی و نوع اکانت */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>دسته‌بندی *</label>
              <select
                name="category"
                value={formData.category}
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

            <div className={styles.formGroup}>
              <label className={styles.label}>نوع اکانت *</label>
              <select
                name="accountType"
                value={formData.accountType}
                onChange={handleInputChange}
                className={styles.select}
                required
              >
                <option value="">انتخاب کنید</option>
                <option value="اشتراکی">اشتراکی</option>
                <option value="اختصاصی">اختصاصی</option>
              </select>
            </div>
          </div>

          {/* نوع فعالسازی و مدت زمان فعالسازی */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>نوع فعالسازی *</label>
              <select
                name="activationType"
                value={formData.activationType}
                onChange={handleInputChange}
                className={styles.select}
                required
              >
                <option value="">انتخاب کنید</option>
                <option value="ایمیل شخصی">ایمیل شخصی</option>
                <option value="ایمیل آماده">ایمیل آماده</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>مدت زمان فعالسازی (دقیقه)</label>
              <input
                type="text"
                inputMode="numeric"
                name="activationTimeMinutes"
                value={formData.activationTimeMinutes}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="مثلاً 30"
              />
            </div>
          </div>

          {/* مدت زمان */}
          <div className={styles.formGroup}>
            <label className={styles.label}>مدت زمان (روز) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="مثلاً 30"
              required
            />
          </div>

          {/* قیمت خرید */}
          <div className={styles.formGroup}>
            <label className={styles.label}>قیمت خرید (تومان) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="purchasePrice"
              value={formData.purchasePrice}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="قیمت خرید"
              required
            />
          </div>

          {/* قیمت کاربر عادی */}
          <div className={styles.formGroup}>
            <label className={styles.label}>قیمت کاربر عادی (تومان) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="regularPrice"
              value={formData.regularPrice}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="قیمت کاربر عادی"
              required
            />
          </div>

          {/* قیمت همکار */}
          <div className={styles.formGroup}>
            <label className={styles.label}>قیمت همکار (تومان) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="merchantPrice"
              value={formData.merchantPrice}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="قیمت همکار"
              required
            />
          </div>

          {/* اطلاعات تکمیلی */}
          <div className={styles.formGroup}>
            <label className={styles.label}>اطلاعات تکمیلی</label>
            <textarea
              name="additionalInfo"
              value={formData.additionalInfo}
              onChange={handleInputChange}
              className={styles.textarea}
              placeholder="اطلاعات تکمیلی محصول..."
              rows={4}
            />
          </div>

          {/* نکات محصول */}
          <div className={styles.formGroup}>
            <label className={styles.label}>نکات محصول</label>
            <div className={styles.noteFields}>
              <div className={styles.formGroup}>
                <label className={styles.label}>نوع نکته</label>
                <select
                  name="noteType"
                  value={formData.noteType}
                  onChange={handleInputChange}
                  className={styles.input}
                >
                  <option value="">بدون نکته</option>
                  <option value="info">اطلاعات</option>
                  <option value="warning">هشدار</option>
                  <option value="note">نکته</option>
                </select>
              </div>
              {formData.noteType && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>متن نکته *</label>
                  <textarea
                    name="noteText"
                    value={formData.noteText}
                    onChange={handleInputChange}
                    className={styles.textarea}
                    placeholder="متن نکته را وارد کنید..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          </div>

          {/* دکمه‌های فرم */}
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={() => router.push("/admin/products")}
              className={styles.cancelButton}
              disabled={isLoading}
            >
              انصراف
            </button>
            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? "در حال افزودن..." : "افزودن محصول"}
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

