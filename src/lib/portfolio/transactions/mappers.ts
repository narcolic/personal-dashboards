import {
  EUROPE_COUNTRIES,
  REGION_OVERRIDES,
  REGION_PREFIX_OVERRIDES,
} from "@/lib/portfolio/constants";
import type { Enriched, HoldingRegionClassification, QuoteMeta } from "@/lib/portfolio/types";

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function classifyHolding(
  row: Enriched & { _nativeCurrency: string },
): HoldingRegionClassification {
  const symbol = row.ticker.toUpperCase();
  const symbolBase = symbol.split(/[.:]/)[0];
  const quote = row.quote as QuoteMeta | undefined;
  const hints: string[] = [];
  const name = row.name ?? quote?.shortName ?? quote?.longName ?? row.ticker;

  const exchange = quote?.exchange ?? null;
  const exchangeName = normalizeText(exchange);
  const currency = (quote?.currency ?? row.currency ?? "USD").toUpperCase();
  const country = quote?.assetProfile?.country ?? null;
  const sector = quote?.assetProfile?.sector ?? null;
  const industry = quote?.assetProfile?.industry ?? null;

  const fundCategory = normalizeText(quote?.fundProfile?.category);
  const fundFamily = normalizeText(quote?.fundProfile?.family);
  const quoteShortName = normalizeText(quote?.shortName);
  const quoteLongName = normalizeText(quote?.longName);
  const priceLongName = normalizeText(quote?.price?.longName);
  const fullName = normalizeText(
    `${fundCategory} ${fundFamily} ${quoteShortName} ${quoteLongName} ${priceLongName} ${row.name}`,
  );

  const rawQuoteType = normalizeText(
    quote?.quoteType ?? quote?.quoteSummary?.quoteType?.quoteType ?? row.asset_type,
  );
  let assetType: HoldingRegionClassification["assetType"] = "Unknown";
  if (rawQuoteType === "equity" || rawQuoteType === "common stock" || rawQuoteType === "stock")
    assetType = "Stock";
  else if (
    rawQuoteType === "etf" ||
    quoteShortName.includes("etf") ||
    quoteLongName.includes("etf")
  )
    assetType = "ETF";
  else if (
    rawQuoteType === "mutualfund" ||
    rawQuoteType === "mutual fund" ||
    rawQuoteType === "fund"
  )
    assetType = "Fund";
  else if (normalizeText(row.asset_type).includes("etf")) assetType = "ETF";
  else if (normalizeText(row.asset_type).includes("mutual")) assetType = "Fund";
  else if (normalizeText(row.asset_type).includes("stock")) assetType = "Stock";

  if (assetType === "Unknown" && exchangeName) {
    if (
      exchangeName.includes("nasdaq") ||
      exchangeName.includes("nyse") ||
      exchangeName.includes("new york") ||
      exchangeName.includes("nyse american")
    ) {
      assetType = "Stock";
    } else if (exchangeName.includes("athens") || exchangeName.includes("athex")) {
      assetType = "ETF";
    }
  }

  if (country) hints.push(`country=${country}`);
  if (sector) hints.push(`sector=${sector}`);
  if (industry) hints.push(`industry=${industry}`);
  if (exchange) hints.push(`exchange=${exchange}`);
  if (quote?.shortName) hints.push("shortName");
  if (quote?.longName) hints.push("longName");
  if (quote?.fundProfile?.category) hints.push(`fund category=${quote.fundProfile.category}`);
  if (quote?.fundProfile?.family) hints.push(`fund family=${quote.fundProfile.family}`);
  if (quote?.price?.longName) hints.push("price.longName");
  if (quote?.topHoldings?.length) hints.push("topHoldings");

  let regionCategory: HoldingRegionClassification["regionCategory"] = "Unknown";
  const overrideRegion = REGION_OVERRIDES[symbol] ?? REGION_OVERRIDES[symbolBase] ?? undefined;
  if (overrideRegion) {
    regionCategory = overrideRegion;
    hints.push("manual override");
  } else {
    const prefixOverride = REGION_PREFIX_OVERRIDES.find(
      ([prefix]) => symbol.startsWith(prefix) || symbolBase.startsWith(prefix),
    );
    if (prefixOverride) {
      regionCategory = prefixOverride[1];
      hints.push("manual prefix override");
    }
  }

  if (regionCategory === "Unknown") {
    if (assetType === "Stock") {
      const normalizedCountry = normalizeText(country);
      if (normalizedCountry === "greece") regionCategory = "Greece";
      else if (normalizedCountry === "united states") regionCategory = "United States";
      else if (EUROPE_COUNTRIES.has(country ?? "")) regionCategory = "Europe Developed";
      else if (
        exchangeName.includes("nasdaq") ||
        exchangeName.includes("nyse") ||
        exchangeName.includes("new york")
      ) {
        regionCategory = "United States";
        hints.push("exchange inferred United States");
      } else if (exchangeName.includes("athens") || exchangeName.includes("athex")) {
        regionCategory = "Greece";
        hints.push("exchange inferred Greece");
      } else if (
        exchangeName.includes("london") ||
        exchangeName.includes("lse") ||
        exchangeName.includes("xlon")
      ) {
        regionCategory = "Europe Developed";
        hints.push("exchange inferred Europe Developed");
      } else if (quoteShortName.includes("greece") || quoteLongName.includes("greece")) {
        regionCategory = "Greece";
      } else if (
        quoteShortName.includes("united states") ||
        quoteLongName.includes("united states") ||
        quoteShortName.includes("usa") ||
        quoteLongName.includes("usa")
      ) {
        regionCategory = "United States";
      } else if (quoteShortName.includes("europe") || quoteLongName.includes("europe")) {
        regionCategory = "Europe Developed";
      }
    } else {
      if (fullName.includes("greece")) {
        regionCategory = "Greece";
      } else if (
        fullName.includes("s&p 500") ||
        fullName.includes("usa") ||
        fullName.includes("us equity") ||
        fullName.includes("u.s. equity") ||
        fullName.includes("us stock")
      ) {
        regionCategory = "United States";
      } else if (fullName.includes("europe") && !fullName.includes("emerging")) {
        regionCategory = "Europe Developed";
      } else if (
        fullName.includes("emerging markets") ||
        fullName.includes("em equity") ||
        /\bem\b/.test(fullName)
      ) {
        regionCategory = "Emerging Markets";
      } else if (
        /quantum|ai|artificial intelligence|machine learning|robotics|cloud|cybersecurity|cyber security/.test(
          fullName,
        )
      ) {
        regionCategory = "Global Thematic";
      } else if (
        fullName.includes("global") ||
        fullName.includes("world") ||
        fullName.includes("developed world") ||
        fullName.includes("all world")
      ) {
        regionCategory = "Global Developed";
      }
    }
  }

  let themeCategory: HoldingRegionClassification["themeCategory"] = "Unknown";
  const sectorText = normalizeText(sector);
  const industryText = normalizeText(industry);
  if (industryText.includes("bank") || fullName.includes("bank")) themeCategory = "Bank";
  else if (industryText.includes("semiconductor") || fullName.includes("semiconductor"))
    themeCategory = "Semiconductor";
  else if (
    sectorText.includes("software") ||
    industryText.includes("software") ||
    /software|internet|application|saas|cloud/.test(fullName)
  ) {
    themeCategory = "Software";
  } else if (
    assetType !== "Stock" &&
    (fullName.includes("s&p 500") || fullName.includes("broad index") || fullName.includes("index"))
  ) {
    themeCategory = "Broad Index";
  } else if (assetType !== "Stock" && fullName.includes("europe")) {
    themeCategory = "Europe Equity";
  } else if (
    assetType !== "Stock" &&
    (fullName.includes("emerging markets") || fullName.includes("em equity"))
  ) {
    themeCategory = "EM Equity";
  } else if (
    /quantum|ai|artificial intelligence|machine learning|robotics|cloud|cybersecurity|cyber security/.test(
      fullName,
    )
  ) {
    themeCategory = "Quantum/AI";
  }

  let confidence: HoldingRegionClassification["confidence"] = "Low";
  if (regionCategory !== "Unknown" && country) confidence = "High";
  if (
    regionCategory !== "Unknown" &&
    fullName.match(/s&p 500|usa|us equity|europe|emerging markets|global|world/)
  ) {
    confidence = confidence === "High" ? "High" : "Medium";
  }
  if (
    REGION_OVERRIDES[symbol] ||
    REGION_PREFIX_OVERRIDES.some(([prefix]) => symbol.startsWith(prefix))
  ) {
    confidence = "High";
  }
  if (regionCategory === "Unknown" && fullName) {
    confidence = "Low";
  }

  return {
    symbol,
    name,
    assetType,
    exchange,
    currency,
    country,
    sector,
    industry,
    regionCategory,
    themeCategory,
    sourceHints: hints,
    confidence,
  };
}
