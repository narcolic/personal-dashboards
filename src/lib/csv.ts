// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines, doubled quotes).
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        /* skip */
      } else field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const ALIASES: Record<string, string> = {
  symbol: "ticker",
  code: "ticker",
  isin: "ticker",
  security: "ticker",
  qty: "shares",
  quantity: "shares",
  units: "shares",
  position: "shares",
  cost: "price",
  avg_cost: "price",
  "avg cost": "price",
  "average cost": "price",
  "cost basis": "price",
  "buy price": "price",
  "unit price": "price",
  type: "asset_type",
  category: "asset_type",
  "asset type": "asset_type",
  ccy: "currency",
  description: "name",
  label: "name",
  portfolio: "portfolio",
  broker: "portfolio",
  account: "portfolio",
  platform: "portfolio",
  date: "transaction_date",
  "trade date": "transaction_date",
  "transaction date": "transaction_date",
  trade_date: "transaction_date",
  transactiondate: "transaction_date",
};

type CsvTransactionRow = {
  ticker: string;
  name?: string;
  asset_type?: string;
  currency?: string;
  shares: number;
  price: number;
  transaction_date: string; // YYYY-MM-DD
  notes?: string;
  portfolio?: string;
};

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // DD/MM/YYYY or DD-MM-YYYY (assume day first for European exports)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // Fallback Date.parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return null;
}

export function mapCsvRows(rows: string[][]): {
  rows: CsvTransactionRow[];
  errors: string[];
} {
  if (rows.length < 2) return { rows: [], errors: ["CSV is empty or missing header row"] };
  const header = rows[0].map((h) => {
    const k = h.trim().toLowerCase();
    return ALIASES[k] ?? k.replace(/\s+/g, "_");
  });
  const idx = (k: string) => header.indexOf(k);
  const required = ["ticker", "shares", "price", "portfolio"];
  const missing = required.filter((k) => idx(k) === -1);
  if (missing.length)
    return { rows: [], errors: [`Missing required column(s): ${missing.join(", ")}`] };

  const errors: string[] = [];
  const out: CsvTransactionRow[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (k: string) => {
      const i = idx(k);
      return i === -1 ? "" : (cells[i] ?? "").trim();
    };
    const ticker = get("ticker").toUpperCase();
    const portfolio = get("portfolio");
    const sharesN = Number(get("shares").replace(/,/g, ""));
    const priceN = Number((get("price") || "0").replace(/,/g, "")) || 0;
    const rawDate = get("transaction_date");
    const date = rawDate ? normalizeDate(rawDate) : today;
    if (!ticker) {
      errors.push(`Row ${r + 1}: missing ticker`);
      continue;
    }
    if (!Number.isFinite(sharesN) || sharesN <= 0) {
      errors.push(`Row ${r + 1}: invalid shares "${get("shares")}"`);
      continue;
    }
    if (!portfolio) {
      errors.push(`Row ${r + 1}: missing portfolio`);
      continue;
    }
    if (!date) {
      errors.push(`Row ${r + 1}: invalid date "${rawDate}"`);
      continue;
    }
    out.push({
      ticker,
      name: get("name") || undefined,
      asset_type: (get("asset_type") || "stock").toLowerCase(),
      currency: (get("currency") || "USD").toUpperCase(),
      shares: sharesN,
      price: priceN,
      transaction_date: date,
      notes: get("notes") || undefined,
      portfolio,
    });
  }
  return { rows: out, errors };
}
