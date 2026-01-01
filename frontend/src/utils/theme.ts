export type ThemeMode = "auto" | "light" | "dark";

const THEME_STORAGE_KEY = "theme-mode";

/**
 * دریافت تم فعلی سیستم
 */
export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * دریافت تم مؤثر (در صورت auto بودن، تم سیستم را برمی‌گرداند)
 */
export function getEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "auto") {
    return getSystemTheme();
  }
  return mode;
}

/**
 * دریافت تم ذخیره شده از localStorage
 */
export function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  // برای سازگاری با نسخه قدیمی که theme را به جای theme-mode ذخیره می‌کرد
  if (!stored) {
    const oldTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (oldTheme) {
      // تبدیل تم قدیمی به mode جدید
      localStorage.setItem(THEME_STORAGE_KEY, oldTheme);
      localStorage.removeItem("theme");
      return oldTheme;
    }
  }
  return stored || "auto";
}

/**
 * ذخیره تم در localStorage
 */
export function setStoredThemeMode(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, mode);
}

/**
 * اعمال تم به document
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  
  const effectiveTheme = getEffectiveTheme(mode);
  const root = document.documentElement;
  
  if (effectiveTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/**
 * مقداردهی اولیه تم (قبل از hydration)
 */
export function initTheme(): void {
  const mode = getStoredThemeMode();
  applyTheme(mode);
}

/**
 * گوش دادن به تغییرات تم سیستم (برای حالت auto)
 */
export function watchSystemTheme(callback: (theme: "light" | "dark") => void): () => void {
  if (typeof window === "undefined") return () => {};
  
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  
  const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
    callback(e.matches ? "dark" : "light");
  };
  
  // برای مرورگرهای قدیمی
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  } else {
    // برای مرورگرهای قدیمی (legacy)
    mediaQuery.addListener(handleChange as any);
    return () => mediaQuery.removeListener(handleChange as any);
  }
}

