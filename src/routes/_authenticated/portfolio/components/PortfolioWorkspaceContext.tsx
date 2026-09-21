import { useEffect, useMemo, useRef, useState } from "react";
import { useHomeCurrency } from "@/lib/profile";
import {
  ALL_PORTFOLIOS,
  PortfolioWorkspaceContext,
  type PortfolioWorkspaceValue,
  type WorkspacePreferences,
} from "@/routes/_authenticated/portfolio/components/PortfolioWorkspaceState";

const STORAGE_KEY = "portfolio-workspace-preferences-v1";
const CURRENCY_OVERRIDE_KEY = "portfolio-display-currency-override-v1";
function hasCurrencyOverride() {
  if (typeof window === "undefined") return false;
  const override = window.localStorage.getItem(CURRENCY_OVERRIDE_KEY);
  if (override === "1") return true;
  if (override === "0") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored).displayCurrency === "USD" : false;
  } catch {
    return false;
  }
}
function readPreferences(): WorkspacePreferences {
  if (typeof window === "undefined") {
    return { selectedPortfolioId: ALL_PORTFOLIOS, displayCurrency: "EUR" };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { selectedPortfolioId: ALL_PORTFOLIOS, displayCurrency: "EUR" };
    const parsed = JSON.parse(stored) as Partial<WorkspacePreferences>;
    return {
      selectedPortfolioId: parsed.selectedPortfolioId || ALL_PORTFOLIOS,
      displayCurrency: (parsed.displayCurrency || "EUR").toUpperCase(),
    };
  } catch {
    return { selectedPortfolioId: ALL_PORTFOLIOS, displayCurrency: "EUR" };
  }
}

export function PortfolioWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<WorkspacePreferences>(readPreferences);
  const homeCurrency = useHomeCurrency();
  const canUseProfileDefault = useRef(!hasCurrencyOverride());

  useEffect(() => {
    const preferred = homeCurrency.data?.homeCurrency;
    if (!canUseProfileDefault.current || (preferred !== "EUR" && preferred !== "USD")) return;
    window.localStorage.setItem(CURRENCY_OVERRIDE_KEY, "0");
    setPreferences((current) =>
      current.displayCurrency === preferred ? current : { ...current, displayCurrency: preferred },
    );
  }, [homeCurrency.data?.homeCurrency]);

  useEffect(() => {
    const onProfileCurrencyChanged = (event: Event) => {
      const currency = (event as CustomEvent<string>).detail;
      if (!canUseProfileDefault.current || (currency !== "EUR" && currency !== "USD")) return;
      window.localStorage.setItem(CURRENCY_OVERRIDE_KEY, "0");
      setPreferences((current) => ({ ...current, displayCurrency: currency }));
    };
    window.addEventListener("profile-currency-changed", onProfileCurrencyChanged);
    return () => window.removeEventListener("profile-currency-changed", onProfileCurrencyChanged);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const value = useMemo<PortfolioWorkspaceValue>(
    () => ({
      ...preferences,
      setSelectedPortfolioId: (selectedPortfolioId) =>
        setPreferences((current) => ({ ...current, selectedPortfolioId })),
      setDisplayCurrency: (displayCurrency) => {
        canUseProfileDefault.current = false;
        window.localStorage.setItem(CURRENCY_OVERRIDE_KEY, "1");
        setPreferences((current) => ({
          ...current,
          displayCurrency: displayCurrency.toUpperCase(),
        }));
      },
      allPortfoliosId: ALL_PORTFOLIOS,
    }),
    [preferences],
  );

  return (
    <PortfolioWorkspaceContext.Provider value={value}>
      {children}
    </PortfolioWorkspaceContext.Provider>
  );
}
