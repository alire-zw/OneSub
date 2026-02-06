import type { Metadata } from "next";
import { generatePageMetadata } from "@/utils/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata({
    title: "محصول",
    description: "جزئیات محصول در وان‌ساب - خرید اشتراک سرویس‌های دیجیتال با بهترین قیمت",
  });
}

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
