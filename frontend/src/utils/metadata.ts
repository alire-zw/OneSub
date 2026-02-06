import type { Metadata } from "next";

const SITE_NAME = "وان‌ساب";
const DEFAULT_DESCRIPTION = "وان‌ساب - خرید اشتراک سرویس‌های دیجیتال با بهترین قیمت";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://onesub.ir";

interface PageMetadataOptions {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  noIndex?: boolean;
}

export function generatePageMetadata(options: PageMetadataOptions = {}): Metadata {
  const { title, description, image, imageAlt, noIndex } = options;
  
  const pageTitle = title ? `${SITE_NAME} | ${title}` : SITE_NAME;
  const pageDescription = description || DEFAULT_DESCRIPTION;
  const pageImage = image ? `${SITE_URL}${image}` : `${SITE_URL}/logo.webp`;
  const pageImageAlt = imageAlt || `${SITE_NAME} لوگو`;

  return {
    title: pageTitle,
    description: pageDescription,
    icons: {
      icon: "/logo.webp",
      shortcut: "/logo.webp",
      apple: "/logo.webp",
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: SITE_URL,
      siteName: SITE_NAME,
      images: [
        {
          url: pageImage,
          width: 1200,
          height: 630,
          alt: pageImageAlt,
        },
      ],
      locale: 'fa_IR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [pageImage],
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
    },
    metadataBase: new URL(SITE_URL),
  };
}

export function generateProductMetadata(
  productName: string,
  productDescription?: string,
  productImage?: string
): Metadata {
  return generatePageMetadata({
    title: productName,
    description: productDescription || `خرید اشتراک ${productName} با بهترین قیمت در وان‌ساب`,
    image: productImage,
    imageAlt: `${productName} - وان‌ساب`,
  });
}
