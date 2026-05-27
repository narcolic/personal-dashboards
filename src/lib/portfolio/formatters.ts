export function fmt(n: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(n);
}

export function fmtCurrency(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
