import { createContext, useContext } from "react";

export const ALL_PORTFOLIOS = "__all__";

export type WorkspacePreferences = {
  selectedPortfolioId: string;
  displayCurrency: string;
};

export type PortfolioWorkspaceValue = WorkspacePreferences & {
  setSelectedPortfolioId: (portfolioId: string) => void;
  setDisplayCurrency: (currency: string) => void;
  allPortfoliosId: string;
};

export const PortfolioWorkspaceContext = createContext<PortfolioWorkspaceValue | null>(null);

export function usePortfolioWorkspace() {
  const value = useContext(PortfolioWorkspaceContext);
  if (!value) {
    throw new Error("usePortfolioWorkspace must be used within PortfolioWorkspaceProvider");
  }
  return value;
}
