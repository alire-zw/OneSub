"use client";

// Re-export from AuthContext
export { useAuth } from "@/contexts/AuthContext";
import { useAuth as useAuthContext } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook برای بررسی اینکه آیا کاربر لاگین است یا نه
 * برای استفاده در صفحاتی که نیاز به authentication دارند
 */
export const useRequireAuth = (redirectTo: string = "/login") => {
  const auth = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push(redirectTo);
    }
  }, [auth.isLoading, auth.isAuthenticated, router, redirectTo]);

  return auth;
};

/**
 * Hook برای redirect کردن کاربر لاگین شده از صفحات عمومی (مثل login)
 */
export const useRedirectIfAuthenticated = (redirectTo: string = "/profile") => {
  const auth = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      router.push(redirectTo);
    }
  }, [auth.isLoading, auth.isAuthenticated, router, redirectTo]);

  return auth;
};
