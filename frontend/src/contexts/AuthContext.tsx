"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/config/api";

const TOKEN_KEY = "auth_token";

interface User {
  id: number;
  phoneNumber?: string;
  userName?: string;
  userEmail?: string;
  isPremium: boolean;
  loginInfo: string;
  telegramID?: number;
  role?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    isLoading: boolean;
    user: User | null;
    token: string | null;
  }>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,
  });
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch user data from Redis cache (via /me endpoint)
  const fetchUserData = useCallback(async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 1 && data.data) {
          setAuthState((prev) => ({
            ...prev,
            isAuthenticated: true,
            user: data.data,
            isLoading: false,
          }));
          return;
        }
      }

      // If token is invalid, clear auth
      localStorage.removeItem(TOKEN_KEY);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        token: null,
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    if (isInitialized) return;

    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
      setAuthState((prev) => ({
        ...prev,
        token,
        isLoading: true,
      }));
      fetchUserData(token).finally(() => {
        setIsInitialized(true);
      });
    } else {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        token: null,
      });
      setIsInitialized(true);
    }
  }, [fetchUserData, isInitialized]);

  const setAuth = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    setAuthState({
      isAuthenticated: true,
      isLoading: false,
      user,
      token,
    });
    // Cache user data in state - no need to fetch again
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      token: null,
    });
    router.push("/login");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return;
    }

    await fetchUserData(token);
  }, [fetchUserData]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        setAuth,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

