import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { StorageKeys } from "./storageKeys";

export type Theme = "light" | "dark";
const STORAGE_KEY = StorageKeys.theme;

type ThemeContext = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const ThemeCtx = createContext<ThemeContext | null>(null);

function detectInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(detectInitialTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !mounted) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, mounted]);

  const value = useMemo<ThemeContext>(
    () => ({
      theme,
      setTheme: (t) => {
        setThemeState(t);
        if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, t);
      },
      toggle: () =>
        setThemeState((prev) => {
          const next: Theme = prev === "dark" ? "light" : "dark";
          if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
          return next;
        }),
    }),
    [theme],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
