export type SecurityMetadata = {
  listingId: string;
  securityId: string;
  symbol: string;
  name: string;
  securityType: string;
  exchangeMic: string | null;
  exchangeName: string | null;
  tradingCurrency: string | null;
  companyName: string | null;
  countryCode: string | null;
  countryName: string | null;
  regionCode: string | null;
  regionName: string | null;
  sectorCode: string | null;
  sectorName: string | null;
  industryCode: string | null;
  industryName: string | null;
  primaryMarketCountryCode: string | null;
  primaryMarketCountryName: string | null;
  geographicExposureCode: string | null;
  geographicExposureName: string | null;
  marketExposureCode: string | null;
  marketExposureName: string | null;
  metadataStatus:
    | "pending"
    | "processing"
    | "succeeded"
    | "incomplete"
    | "not_found"
    | "failed"
    | "rate_limited";
  metadataUpdatedAt: string | null;
  isOverridden: boolean;
  effectiveGeography: string | null;
  geographySource: "company_country" | "company_region" | "etf_geographic_exposure" | null;
  metadataSource: "provider" | "manual" | "mixed";
};

export type TransactionRow = {
  id: string;
  ticker: string;
  action: "buy" | "sell" | "dividend" | "fee";
  name: string | null;
  asset_type: string;
  market: string | null;
  currency: string;
  shares: number;
  price: number;
  transaction_date: string;
  notes: string | null;
  portfolio_id: string | null;
  security_listing_id: string;
  security: SecurityMetadata;
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
  security_listing_id: string;
  security: SecurityMetadata;
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
}
