import { useEffect, useMemo, useState } from "react";
import {
  ALL_PORTFOLIOS,
  PortfolioWorkspaceContext,
  type PortfolioWorkspaceValue,
  type WorkspacePreferences,
} from "@/routes/_authenticated/portfolio/components/PortfolioWorkspaceState";

const STORAGE_KEY = "portfolio-workspace-preferences-v1";
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

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const value = useMemo<PortfolioWorkspaceValue>(
    () => ({
      ...preferences,
      setSelectedPortfolioId: (selectedPortfolioId) =>
        setPreferences((current) => ({ ...current, selectedPortfolioId })),
      setDisplayCurrency: (displayCurrency) =>
        setPreferences((current) => ({
          ...current,
          displayCurrency: displayCurrency.toUpperCase(),
        })),
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
