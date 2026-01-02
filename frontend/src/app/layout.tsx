import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Header from "@/components/Header";
import TelegramInit from "@/components/TelegramInit";
import MobileNavbar from "@/components/MobileNavbar";
import CookieCleaner from "@/components/CookieCleaner";
import NotificationReader from "@/components/NotificationReader";
import ErrorSuppressor from "@/components/ErrorSuppressor";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "OneSub - سیستم مدیریت اشتراک",
  description: "سیستم مدیریت اشتراک OneSub",
  icons: {
    icon: "/logo.webp",
    shortcut: "/logo.webp",
    apple: "/logo.webp",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          * {
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            touch-action: manipulation;
          }
          input, textarea, select {
            -webkit-user-select: text;
            -moz-user-select: text;
            -ms-user-select: text;
            user-select: text;
            font-size: 16px !important;
            touch-action: manipulation;
          }
        `}} />
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const THEME_STORAGE_KEY = 'theme-mode';
                const storedMode = localStorage.getItem(THEME_STORAGE_KEY);
                let effectiveTheme = 'light';
                
                if (storedMode === 'light' || storedMode === 'dark') {
                  effectiveTheme = storedMode;
                } else if (storedMode === 'auto' || !storedMode) {
                  // برای سازگاری با نسخه قدیمی
                  const oldTheme = localStorage.getItem('theme');
                  if (oldTheme === 'light' || oldTheme === 'dark') {
                    effectiveTheme = oldTheme;
                    localStorage.setItem(THEME_STORAGE_KEY, oldTheme);
                    localStorage.removeItem('theme');
                  } else {
                    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                }
                
                if (effectiveTheme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col font-onebit w-full">
        <ErrorSuppressor />
        <AuthProvider>
          <CookieCleaner />
          <TelegramInit />
          <Suspense fallback={null}>
            <NotificationReader />
          </Suspense>
          <div className="w-full max-w-[700px] mx-auto flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow w-full pb-20">
        {children}
            </main>
            <MobileNavbar />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
