"use client";

import { useState, useEffect } from "react";
import type { ThemeMode } from "@/utils/theme";
import {
  getStoredThemeMode,
  setStoredThemeMode,
  applyTheme,
  getEffectiveTheme,
  watchSystemTheme,
} from "@/utils/theme";

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // بارگذاری تم ذخیره شده
    const storedMode = getStoredThemeMode();
    setThemeMode(storedMode);
    
    const effective = getEffectiveTheme(storedMode);
    setEffectiveTheme(effective);
    applyTheme(storedMode);

    // اگر حالت auto است، به تغییرات تم سیستم گوش ده
    let unwatchSystemTheme: (() => void) | undefined;
    if (storedMode === "auto") {
      unwatchSystemTheme = watchSystemTheme((newTheme) => {
        setEffectiveTheme(newTheme);
        applyTheme("auto");
      });
    }
    
    return () => {
      if (unwatchSystemTheme) {
        unwatchSystemTheme();
      }
    };
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setStoredThemeMode(mode);
    const effective = getEffectiveTheme(mode);
    setEffectiveTheme(effective);
    applyTheme(mode);
  };

  // گوش دادن به تغییرات تم سیستم برای حالت auto
  useEffect(() => {
    if (themeMode === "auto" && mounted) {
      const unwatch = watchSystemTheme((newTheme) => {
        setEffectiveTheme(newTheme);
        applyTheme("auto");
      });
      return () => unwatch();
    }
  }, [themeMode, mounted]);

  return {
    themeMode,
    effectiveTheme,
    setTheme,
    mounted,
  };
}

