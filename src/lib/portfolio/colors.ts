const PORTFOLIO_COLORS = [
  "var(--color-primary)",
  "var(--color-chart-5)",
  "var(--color-bull)",
  "var(--color-amber)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-bear)",
];

export function buildPortfolioColorMap(portfolioIds: readonly (string | null)[]) {
  const ids = [...new Set(portfolioIds.map((id) => id ?? "__unassigned__"))].sort();
  return new Map(ids.map((id, index) => [id, PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length]]));
}
