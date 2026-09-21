import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type ColorPalette = "terminal" | "ocean" | "violet" | "emerald" | "magenta" | "graphite";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  palette: ColorPalette;
  setPalette: (palette: ColorPalette) => void;
};

const STORAGE_KEY = "portfolio-theme-mode";
const PALETTE_STORAGE_KEY = "terminal-color-palette";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyResolvedTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") return "dark";
    return mode === "system" ? resolveSystemTheme() : mode;
  });
  const [palette, setPaletteState] = useState<ColorPalette>(() => {
    if (typeof window === "undefined") return "terminal";
    const saved = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    return saved === "ocean" ||
      saved === "violet" ||
      saved === "emerald" ||
      saved === "magenta" ||
      saved === "graphite"
      ? saved
      : "terminal";
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const update = () => {
      const nextResolved = mode === "system" ? (media.matches ? "dark" : "light") : mode;
      setResolvedTheme(nextResolved);
      applyResolvedTheme(nextResolved);
    };

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
  }, [palette]);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
  };
  const setPalette = (nextPalette: ColorPalette) => {
    setPaletteState(nextPalette);
    window.localStorage.setItem(PALETTE_STORAGE_KEY, nextPalette);
  };

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      setMode,
      palette,
      setPalette,
    }),
    [mode, resolvedTheme, palette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// The hook shares the provider's private context and is intentionally colocated.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
