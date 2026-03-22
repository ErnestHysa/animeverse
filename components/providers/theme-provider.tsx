/**
 * Theme Provider
 * Manages theme switching between dark, light, and system modes
 */

"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "animeverse-theme";

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
    if (stored && ["dark", "light", "system"].includes(stored)) {
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize theme from localStorage using lazy initializer
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  // Derive resolved theme from current theme instead of using state
  const resolvedTheme = useMemo<"dark" | "light">(() => {
    return theme === "system" ? getSystemTheme() : theme;
  }, [theme]);

  // Force re-render when system theme changes in system mode
  const [, forceUpdate] = useState({});
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => forceUpdate({});

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const effectiveTheme = resolvedTheme;

    if (effectiveTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
