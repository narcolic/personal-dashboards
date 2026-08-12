const defaultNumberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatters = new Map<string, Intl.NumberFormat>();
const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function fmt(n: number, opts: Intl.NumberFormatOptions = {}) {
  if (Object.keys(opts).length === 0) return defaultNumberFormatter.format(n);

  const key = JSON.stringify(opts);
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...opts,
    });
    numberFormatters.set(key, formatter);
  }

  return formatter.format(n);
}

export function fmtCurrency(n: number, currency = "USD") {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, formatter);
  }

  return formatter.format(n);
}

export function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
