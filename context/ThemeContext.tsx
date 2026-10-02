"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ro_intel_theme";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(theme: Theme) {
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

/**
 * Deliberately just light/dark, no "system" option — the user asked for
 * "the option to use dark or light mode," not auto-switching, and skipping
 * a prefers-color-scheme lane keeps this to one source of truth instead of
 * a toggle that can disagree with the OS.
 *
 * The real flash-of-wrong-theme prevention is the inline blocking script
 * in layout.tsx's <head>, which sets the `data-theme` attribute on <html>
 * before this component ever mounts — this provider's initial "light"
 * state only has to agree with that attribute once its own effect reads
 * localStorage, not render the right value on the first paint.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // The blocking script already applied this to the DOM; this only
      // syncs React's own state so the settings toggle renders correctly.
      if (saved === "dark" || saved === "light") setThemeState(saved);
    } catch {
      /* corrupt/unavailable localStorage — stay on the light default */
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* best-effort only — the theme still applied live even if this fails */
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
