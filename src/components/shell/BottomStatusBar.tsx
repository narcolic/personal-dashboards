import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useRouterState } from "@tanstack/react-router";
import i18n from "@/i18n";
import { type ThemeMode, useTheme } from "@/theme/theme-provider";
import { MarketStatusIndicator } from "@/routes/_authenticated/portfolio/components/MarketStatusIndicator";

const languages = [
  { code: "en", label: "EN" },
  { code: "el", label: "EL" },
] as const;

const themeOptions: { mode: ThemeMode; icon: string; label: string }[] = [
  { mode: "dark", icon: "🌙", label: "Dark" },
  { mode: "light", icon: "☀", label: "Light" },
  { mode: "system", icon: "◑", label: "System" },
];

export function BottomStatusBar() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const isPortfolio = useRouterState({
    select: (state) => state.location.pathname.startsWith("/portfolio"),
  });
  const [now, setNow] = useState(() => new Date());
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const languageButtonRef = useRef<HTMLButtonElement | null>(null);

  const currentLanguage = i18n.resolvedLanguage === "el" || i18n.language === "el" ? "el" : "en";
  const currentLanguageLabel = useMemo(
    () => languages.find((language) => language.code === currentLanguage)?.label ?? "EN",
    [currentLanguage],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!languageMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!languageMenuRef.current) return;
      if (!languageMenuRef.current.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
        languageButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [languageMenuOpen]);

  const onThemeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const currentIndex = themeOptions.findIndex((option) => option.mode === mode);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = themeOptions[(currentIndex + 1) % themeOptions.length];
      setMode(next.mode);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = themeOptions[(currentIndex - 1 + themeOptions.length) % themeOptions.length];
      setMode(prev.mode);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
      <div className="flex h-8 items-center justify-between px-3 text-xs uppercase tracking-[0.1em] md:px-4">
        <div className="inline-flex min-w-0 items-center gap-3">
          <span className="inline-flex items-center gap-2 text-green-500">
            <span
              className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse"
              aria-hidden="true"
            />
            <span>LIVE</span>
          </span>
          {isPortfolio ? (
            <span className="hidden items-center gap-3 text-muted-foreground sm:inline-flex">
              <span className="tabular-nums">
                {now.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                  timeZoneName: "short",
                })}
              </span>
              <MarketStatusIndicator exchanges={["ATHEX", "NYSE", "XETR"]} />
            </span>
          ) : null}
        </div>

        <div className="flex items-center text-muted-foreground">
          <div className="inline-flex items-center bg-secondary/20">
            <div className="relative" ref={languageMenuRef}>
              <button
                type="button"
                ref={languageButtonRef}
                onClick={() => setLanguageMenuOpen((open) => !open)}
                className="inline-flex h-6 items-center gap-1 px-2 text-foreground hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-haspopup="menu"
                aria-expanded={languageMenuOpen}
                aria-label={`${t("common.language")}: ${currentLanguageLabel}`}
              >
                <span aria-hidden="true">🌐</span>
                <span>{currentLanguageLabel}</span>
                <span aria-hidden="true">▾</span>
              </button>

              {languageMenuOpen ? (
                <div
                  className="absolute bottom-full right-0 mb-1 min-w-[88px] border border-border bg-card p-1"
                  role="menu"
                  aria-label={t("common.language")}
                >
                  {languages.map((language) => {
                    const isActive = language.code === currentLanguage;
                    return (
                      <button
                        key={language.code}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => {
                          void i18n.changeLanguage(language.code).catch((error: unknown) => {
                            console.error("[i18n] changeLanguage failed", error);
                          });
                          setLanguageMenuOpen(false);
                        }}
                        className={`block w-full border px-2 py-1 text-left text-xs uppercase tracking-[0.1em] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                          isActive
                            ? "border-primary text-primary"
                            : "border-transparent text-foreground hover:border-border hover:bg-secondary/50"
                        }`}
                      >
                        {language.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <span aria-hidden="true" className="h-4 w-px bg-border/80" />

            <div
              className="inline-flex h-6 items-center"
              role="radiogroup"
              aria-label="Theme mode"
              onKeyDown={onThemeKeyDown}
            >
              {themeOptions.map((option) => {
                const isActive = mode === option.mode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => setMode(option.mode)}
                    className={`h-6 w-7 text-[12px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-secondary/55 hover:text-foreground"
                    }`}
                  >
                    <span aria-hidden="true">{option.icon}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
