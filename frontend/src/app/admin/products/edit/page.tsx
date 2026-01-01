"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import styles from "../Products.module.css";
import formStyles from "../add/AddProduct.module.css";
import { useRequireAuth } from "@/hooks/useAuth";
import { API_BASE_URL, getAuthHeaders } from "@/config/api";
import Notification from "@/components/Notification";
import SuccessIcon from "@/components/icons/SuccessIcon";

interface Product {
  id: number;
  productName: string;
  category: string;
  accountType: string;
  regularPrice: number;
  imagePath?: string;
  isActive: boolean;
}

function EditProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

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

  const showNotification = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }));
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fa-IR").format(price);
  };

  const handleProductClick = (productId: number) => {
    router.push(`/admin/products/edit?id=${productId}`);
  };

  // اگر productId وجود داشت، به صفحه ویرایش با فرم برو
  if (productId) {
    return <EditProductForm productId={productId} onBack={() => router.push("/admin/products/edit")} />;
  }

  if (authLoading) {
    return (
      <div className={styles.container}>
        <PageHeader title="ویرایش محصول" onBack={() => router.push("/admin/products")} />
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
      <PageHeader title="ویرایش محصول" onBack={() => router.push("/admin/products")} />

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

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />
    </div>
  );
}

export default function EditProductPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <PageHeader title="ویرایش محصول" onBack={() => {}} />
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
      <EditProductContent />
    </Suspense>
  );
}

// کامپوننت فرم ویرایش
function EditProductForm({ productId, onBack }: { productId: string; onBack: () => void }) {
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth("/login");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
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

  const formatNumberWithCommas = (value: string | number): string => {
    if (!value && value !== 0) return "";
    const numStr = value.toString().replace(/,/g, "");
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // بارگذاری محصول
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) {
        showNotification("شناسه محصول یافت نشد", "error");
        setIsLoadingProduct(false);
        setTimeout(() => onBack(), 2000);
        return;
      }

      setIsLoadingProduct(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch product");
        }

        const data = await response.json();
        if (data.status === 1 && data.data) {
          const product = data.data;

          setFormData({
            productName: product.productName || "",
            category: product.category || "",
            accountType: product.accountType || "",
            duration: product.duration?.toString() || "",
            purchasePrice: formatNumberWithCommas(product.purchasePrice || ""),
            regularPrice: formatNumberWithCommas(product.regularPrice || ""),
            merchantPrice: formatNumberWithCommas(product.merchantPrice || ""),
            activationTimeMinutes: product.activationTimeMinutes?.toString() || "",
            activationType: product.activationType || "",
            additionalInfo: product.additionalInfo || "",
            noteType: product.noteType || "",
            noteText: product.noteText || "",
            imagePath: product.imagePath || "",
          });

          if (product.imagePath) {
            setImagePreview("uploaded"); // نشان می‌دهد که تصویر از قبل آپلود شده
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        showNotification("خطا در دریافت اطلاعات محصول", "error");
        setTimeout(() => onBack(), 2000);
      } finally {
        setIsLoadingProduct(false);
      }
    };

    if (!authLoading && productId) {
      fetchProduct();
    }
  }, [authLoading, productId, onBack]);

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
          setImagePreview("uploaded");
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

    if (!productId) {
      showNotification("شناسه محصول یافت نشد", "error");
      return;
    }

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
      };

      // اضافه کردن فیلدهای نکته (فقط اگر هر دو مقدار داشته باشند)
      if (formData.noteType && formData.noteText.trim()) {
        payload.noteType = formData.noteType;
        payload.noteText = formData.noteText.trim();
      } else {
        // اگر خالی باشد، null ارسال می‌شود تا حذف شود
        payload.noteType = null;
        payload.noteText = null;
      }

      const response = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.status === 1) {
        showNotification("محصول با موفقیت به‌روزرسانی شد", "success");
        setTimeout(() => {
          router.push("/admin/products");
        }, 1000);
      } else {
        showNotification(data.message || "خطا در به‌روزرسانی محصول", "error");
      }
    } catch (error) {
      console.error("Error updating product:", error);
      showNotification("خطا در ارتباط با سرور", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoadingProduct) {
    return (
      <div className={formStyles.container}>
        <PageHeader title="ویرایش محصول" onBack={onBack} />
        <div className={formStyles.content}>
          <div className={formStyles.formContainer}>
            <p>در حال بارگذاری...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={formStyles.container}>
      <PageHeader title="ویرایش محصول" onBack={onBack} />

      <div className={formStyles.content}>
        <form className={formStyles.form} onSubmit={handleSubmit}>
          {/* اپلود عکس */}
          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>عکس محصول</label>
            <div className={formStyles.imageUpload}>
              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={handleImageChange}
                className={formStyles.fileInput}
              />
              <label htmlFor="image" className={`${formStyles.fileLabel} ${imagePreview ? formStyles.uploaded : ''} ${isUploadingImage ? formStyles.uploading : ''}`}>
                {imagePreview ? (
                  <div className={formStyles.uploadSuccess}>
                    <SuccessIcon width={20} height={20} />
                    <span>اپلود شد</span>
                  </div>
                ) : (
                  <div className={formStyles.uploadPlaceholder}>
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
          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>نام محصول *</label>
            <input
              type="text"
              name="productName"
              value={formData.productName}
              onChange={handleInputChange}
              className={formStyles.input}
              placeholder="نام محصول"
              required
            />
          </div>

          {/* دسته‌بندی و نوع اکانت */}
          <div className={formStyles.formRow}>
            <div className={formStyles.formGroup}>
              <label className={formStyles.label}>دسته‌بندی *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={formStyles.select}
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

            <div className={formStyles.formGroup}>
              <label className={formStyles.label}>نوع اکانت *</label>
              <select
                name="accountType"
                value={formData.accountType}
                onChange={handleInputChange}
                className={formStyles.select}
                required
              >
                <option value="">انتخاب کنید</option>
                <option value="اشتراکی">اشتراکی</option>
                <option value="اختصاصی">اختصاصی</option>
              </select>
            </div>
          </div>

          {/* نوع فعالسازی و مدت زمان فعالسازی */}
          <div className={formStyles.formRow}>
            <div className={formStyles.formGroup}>
              <label className={formStyles.label}>نوع فعالسازی *</label>
              <select
                name="activationType"
                value={formData.activationType}
                onChange={handleInputChange}
                className={formStyles.select}
                required
              >
                <option value="">انتخاب کنید</option>
                <option value="ایمیل شخصی">ایمیل شخصی</option>
                <option value="ایمیل آماده">ایمیل آماده</option>
              </select>
            </div>

            <div className={formStyles.formGroup}>
              <label className={formStyles.label}>مدت زمان فعالسازی (دقیقه)</label>
              <input
                type="text"
                inputMode="numeric"
                name="activationTimeMinutes"
                value={formData.activationTimeMinutes}
                onChange={handleInputChange}
                className={formStyles.input}
                placeholder="مثلاً 30"
              />
            </div>
          </div>

          {/* مدت زمان */}
          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>مدت زمان (روز) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="duration"
              value={formData.duration}
              onChange={handleInputChange}
              className={formStyles.input}
              placeholder="مثلاً 30"
              required
            />
          </div>

          {/* قیمت خرید */}
          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>قیمت خرید (تومان) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="purchasePrice"
              value={formData.purchasePrice}
              onChange={handleInputChange}
              className={formStyles.input}
              placeholder="قیمت خرید"
              required
            />
          </div>

          {/* قیمت کاربر عادی */}
          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>قیمت کاربر عادی (تومان) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="regularPrice"
              value={formData.regularPrice}
              onChange={handleInputChange}
              className={formStyles.input}
              placeholder="قیمت کاربر عادی"
              required
            />
          </div>

          {/* قیمت همکار */}
          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>قیمت همکار (تومان) *</label>
            <input
              type="text"
              inputMode="numeric"
              name="merchantPrice"
              value={formData.merchantPrice}
              onChange={handleInputChange}
              className={formStyles.input}
              placeholder="قیمت همکار"
              required
            />
          </div>

          {/* اطلاعات تکمیلی */}
          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>اطلاعات تکمیلی</label>
            <textarea
              name="additionalInfo"
              value={formData.additionalInfo}
              onChange={handleInputChange}
              className={formStyles.textarea}
              placeholder="اطلاعات تکمیلی محصول..."
              rows={4}
            />
          </div>

          {/* نکات محصول */}
          <div className={formStyles.formGroup}>
            <label className={formStyles.label}>نکات محصول</label>
            <div className={formStyles.noteFields}>
              <div className={formStyles.formGroup}>
                <label className={formStyles.label}>نوع نکته</label>
                <select
                  name="noteType"
                  value={formData.noteType}
                  onChange={handleInputChange}
                  className={formStyles.input}
                >
                  <option value="">بدون نکته</option>
                  <option value="info">اطلاعات</option>
                  <option value="warning">هشدار</option>
                  <option value="note">نکته</option>
                </select>
              </div>
              {formData.noteType && (
                <div className={formStyles.formGroup}>
                  <label className={formStyles.label}>متن نکته *</label>
                  <textarea
                    name="noteText"
                    value={formData.noteText}
                    onChange={handleInputChange}
                    className={formStyles.textarea}
                    placeholder="متن نکته را وارد کنید..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          </div>

          {/* دکمه‌های فرم */}
          <div className={formStyles.formActions}>
            <button
              type="button"
              onClick={onBack}
              className={formStyles.cancelButton}
              disabled={isLoading}
            >
              انصراف
            </button>
            <button type="submit" className={formStyles.submitButton} disabled={isLoading}>
              {isLoading ? "در حال ذخیره..." : "ذخیره تغییرات"}
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
