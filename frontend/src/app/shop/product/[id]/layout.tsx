import type { Metadata } from "next";
import { generateProductMetadata, generatePageMetadata } from "@/utils/metadata";
import { API_BASE_URL } from "@/config/api";

type Props = {
  params: Promise<{ id: string }>;
};

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      next: { revalidate: 60 },
    });
    
    if (!res.ok) {
      console.error(`Failed to fetch product ${id} for metadata: ${res.status}`);
      return null;
    }
    
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.error("Error fetching product for metadata:", error);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return generatePageMetadata({
      title: "محصول یافت نشد",
      description: "محصول مورد نظر یافت نشد - وان‌ساب"
    });
  }

  // تولید توضیحات در صورت خالی بودن
  let description = product.additionalInfo;
  if (!description || description.trim().length === 0) {
      const parts = [];
      if (product.category) parts.push(product.category);
      if (product.accountType) parts.push(product.accountType);
      if (product.duration) parts.push(`${product.duration} روزه`);
      description = `خرید اشتراک ${product.productName} - ${parts.join(' | ')}`;
  }

  // تولید لینک تصویر
  let imageUrl = undefined;
  if (product.imagePath) {
      if (product.imagePath.startsWith('http')) {
          imageUrl = product.imagePath;
      } else {
          // حذف اسلش‌های اضافی و نرمال‌سازی مسیر
          const baseUrl = API_BASE_URL.replace(/\/$/, '');
          const cleanPath = product.imagePath.startsWith('/') 
            ? product.imagePath 
            : `/${product.imagePath}`;
          
          imageUrl = `${baseUrl}${cleanPath}`;
      }
  }

  return generateProductMetadata(
    product.productName,
    description,
    imageUrl
  );
}

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
