export type AssetType = "Stock" | "ETF" | "Fund" | "Unknown";
export type RegionCategory =
  | "Greece"
  | "United States"
  | "Europe Developed"
  | "Emerging Markets"
  | "Global Developed"
  | "Global Thematic"
  | "Unknown";
export type ThemeCategory =
  | "Broad Index"
  | "Bank"
  | "Semiconductor"
  | "Software"
  | "Europe Equity"
  | "EM Equity"
  | "Quantum/AI"
  | "Unknown";

export type HoldingRegionClassification = {
  symbol: string;
  name: string;
  assetType: AssetType;
  exchange: string | null;
  currency: string | null;
  country: string | null;
  sector: string | null;
  industry: string | null;
  regionCategory: RegionCategory;
  themeCategory: ThemeCategory;
  sourceHints: string[];
  confidence: "High" | "Medium" | "Low";
};

export type TransactionRow = {
  id: string;
  ticker: string;
  name: string | null;
  asset_type: string;
  market: string | null;
  currency: string;
  shares: number;
  price: number;
  transaction_date: string;
  notes: string | null;
  portfolio_id: string | null;
};

export type HoldingRow = {
  id: string;
  ticker: string;
  name: string | null;
  asset_type: string;
  market: string | null;
  currency: string;
  shares: number;
  avg_cost: number;
  notes: string | null;
  portfolio_id: string | null;
  tx_count: number;
  first_date: string | null;
  last_date: string | null;
};

export type Enriched = HoldingRow & {
  price: number;
  prevClose: number;
  dayChange: number;
  dayChangePct: number;
  marketValue: number;
  costBasis: number;
  unrealized: number;
  unrealizedPct: number;
  quote?: Quote;
};

export type QuoteMeta = NonNullable<Enriched["quote"]> & {
  quoteType?: string;
  longName?: string;
  assetProfile?: { country?: string; sector?: string; industry?: string };
  fundProfile?: { category?: string; family?: string };
  price?: { longName?: string };
  quoteSummary?: { quoteType?: { quoteType?: string } };
  topHoldings?: Array<{ symbol?: string; weight?: number }>;
};

export interface Quote {
  symbol: string;
  inputSymbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketPreviousClose: number;
  currency: string;
  exchange?: string;
  marketState?: string;
  quoteType?: string;
  assetProfile?: {
    country?: string;
    sector?: string;
    industry?: string;
  };
  fundProfile?: {
    category?: string;
    family?: string;
  };
  price?: {
    longName?: string;
  };
  quoteSummary?: {
    quoteType?: {
      quoteType?: string;
    };
  };
  topHoldings?: Array<{ symbol?: string; weight?: number }>;
}
