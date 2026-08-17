import type { TFunction } from "i18next";

type TitleRule = {
  matches: (pathname: string) => boolean;
  translationKey: string;
};

const TITLE_RULES: TitleRule[] = [
  { matches: (path) => path === "/login", translationKey: "pageTitles.login" },
  { matches: (path) => path === "/oauth/consent", translationKey: "pageTitles.authorize" },
  {
    matches: (path) => /^\/portfolio\/holdings\/[^/]+$/.test(path),
    translationKey: "pageTitles.holding",
  },
  { matches: (path) => path === "/portfolio/holdings", translationKey: "pageTitles.holdings" },
  {
    matches: (path) => path === "/portfolio/transactions",
    translationKey: "pageTitles.transactions",
  },
  { matches: (path) => path === "/portfolio/pnl", translationKey: "pageTitles.performance" },
  {
    matches: (path) => path === "/portfolio/analytics",
    translationKey: "pageTitles.portfolioAnalytics",
  },
  {
    matches: (path) => path === "/portfolio/insights",
    translationKey: "pageTitles.portfolioInsights",
  },
  {
    matches: (path) => path === "/portfolio/activity",
    translationKey: "pageTitles.portfolioActivity",
  },
  { matches: (path) => path === "/portfolio", translationKey: "pageTitles.portfolio" },
  {
    matches: (path) => path === "/car-service/add",
    translationKey: "pageTitles.addServiceVisit",
  },
  {
    matches: (path) => path === "/car-service/analytics",
    translationKey: "pageTitles.serviceAnalytics",
  },
  {
    matches: (path) => path === "/car-service/history",
    translationKey: "pageTitles.serviceHistory",
  },
  { matches: (path) => path === "/car-service/vehicles", translationKey: "pageTitles.vehicles" },
  {
    matches: (path) => /^\/car-service\/[^/]+$/.test(path),
    translationKey: "pageTitles.editServiceVisit",
  },
  { matches: (path) => path === "/car-service", translationKey: "pageTitles.carService" },
];

function normalizePathname(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function getPageTitle(pathname: string, t: TFunction) {
  const normalizedPathname = normalizePathname(pathname);
  if (normalizedPathname === "/") return "Terminal Hub";

  const rule = TITLE_RULES.find(({ matches }) => matches(normalizedPathname));
  return rule ? t(rule.translationKey) : t("pageTitles.notFound");
}
