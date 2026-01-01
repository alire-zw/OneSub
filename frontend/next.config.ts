import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // کاهش استفاده از حافظه و کوکی‌ها
  onDemandEntries: {
    // مدت زمان نگه‌داری صفحات در حافظه (میلی‌ثانیه) - کاهش یافته
    maxInactiveAge: 25 * 1000,
    // تعداد صفحاتی که همزمان در حافظه نگه داشته می‌شوند - کاهش یافته
    pagesBufferLength: 2,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'osa.mirall.ir',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;
