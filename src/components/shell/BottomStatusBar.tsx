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
    <div className="fixed inset-x-0 bottom-0 z-20 px-2">
      <div className="flex h-9 items-center justify-between rounded-lg bg-card/70 px-3 text-xs uppercase tracking-[0.1em] shadow-[0_-12px_30px_-26px_rgba(0,0,0,0.95)] backdrop-blur-xl md:px-4">
        <div className="inline-flex min-w-0 items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-bull/10 px-2 py-1 text-bull">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-bull animate-pulse"
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
          <div className="inline-flex items-center rounded-lg bg-secondary/30 p-1 shadow-inner">
            <div className="relative" ref={languageMenuRef}>
              <button
                type="button"
                ref={languageButtonRef}
                onClick={() => setLanguageMenuOpen((open) => !open)}
                className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-foreground transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                  className="absolute bottom-full right-0 mb-2 min-w-[104px] rounded-lg border border-border/70 bg-popover/95 p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl"
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
                        className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                          isActive
                            ? "bg-primary/12 text-primary"
                            : "text-foreground hover:bg-secondary/55"
                        }`}
                      >
                        <span>{language.label}</span>
                        {isActive ? (
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <span aria-hidden="true" className="h-4 w-px bg-border/45" />

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
                    className={`h-6 w-7 rounded-md text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      isActive
                        ? "bg-primary/12 text-primary"
                        : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
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
