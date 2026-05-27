const HOURS_URL = "https://markethours.io/api/markets/hours";
const STATUS_URL = "https://markethours.io/api/markets/status";

type ApiRequest = {
  method?: string;
  query?: {
    exchanges?: string | string[];
  };
};

type ApiResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

type AnyObj = Record<string, unknown>;

function normalizeList(raw: string | string[] | undefined): string[] {
  const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.join(",") : "";
  return Array.from(
    new Set(
      value
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function normalizeCode(code: string): string {
  const c = code.trim().toLowerCase();
  if (c === "xams") return "ams";
  if (c === "xetr") return "xetra";
  if (c === "xlon") return "lse";
  if (c === "nyse") return "nyse";
  if (c === "nasdaq") return "nasdaq";
  if (c === "athex") return "athex";
  return c;
}

function asArray(v: unknown): AnyObj[] {
  if (Array.isArray(v)) return v.filter((x): x is AnyObj => typeof x === "object" && x !== null);
  return [];
}

function readMarketsPayload(json: unknown): AnyObj[] {
  if (typeof json !== "object" || json === null) return [];
  const obj = json as AnyObj;
  const data = obj.data;
  if (Array.isArray(data)) return asArray(data);
  if (typeof data === "object" && data !== null) {
    const dataObj = data as AnyObj;
    if (Array.isArray(dataObj.markets)) return asArray(dataObj.markets);
  }
  if (Array.isArray(obj.markets)) return asArray(obj.markets);
  return [];
}

function marketId(m: AnyObj): string {
  return String(m.id ?? m.exchange ?? m.market ?? "").toLowerCase();
}

function pickTradingHours(m: AnyObj): AnyObj | undefined {
  const direct = m.tradingHours;
  if (typeof direct === "object" && direct !== null) return direct as AnyObj;
  const hours = m.hours;
  if (typeof hours === "object" && hours !== null) return hours as AnyObj;
  return undefined;
}

function pickTimezone(m: AnyObj): string | undefined {
  const tz = m.timezone;
  return typeof tz === "string" ? tz : undefined;
}

function pickStatus(m: AnyObj): AnyObj | undefined {
  const s = m.status;
  return typeof s === "object" && s !== null ? (s as AnyObj) : undefined;
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const r = await fetch(url, { headers });
  if (!r.ok) {
    return { ok: false as const, status: r.status, json: null as unknown };
  }
  return { ok: true as const, status: r.status, json: (await r.json()) as unknown };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const requested = normalizeList(req.query?.exchanges).map(normalizeCode);

  try {
    const key = process.env.MARKETHOURS_API_KEY;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "portfolio-terminal/1.0",
      ...(key
        ? {
            "X-API-Key": key,
            Authorization: `Bearer ${key}`,
          }
        : {}),
    };

    const hoursUrl = `${HOURS_URL}?markets=${encodeURIComponent(requested.join(","))}`;
    const [hoursResp, statusResp] = await Promise.all([
      fetchJson(hoursUrl, headers),
      fetchJson(`${STATUS_URL}?markets=${encodeURIComponent(requested.join(","))}`, headers),
    ]);

    if (!hoursResp.ok && !statusResp.ok) {
      const code = hoursResp.status || statusResp.status || 500;
      res.status(code).json({ error: `Market API error (${code})` });
      return;
    }

    const hoursMarkets = hoursResp.ok ? readMarketsPayload(hoursResp.json) : [];
    const statusMarkets = statusResp.ok ? readMarketsPayload(statusResp.json) : [];

    const byId = new Map<string, AnyObj>();

    for (const m of hoursMarkets) {
      const id = marketId(m);
      if (!id) continue;
      byId.set(id, {
        id,
        exchange: m.exchange,
        market: m.market,
        timezone: pickTimezone(m),
        tradingHours: pickTradingHours(m),
      });
    }

    for (const m of statusMarkets) {
      const id = marketId(m);
      if (!id) continue;
      const prev = byId.get(id) ?? { id };
      byId.set(id, {
        ...prev,
        exchange: prev.exchange ?? m.exchange,
        market: prev.market ?? m.market,
        timezone: prev.timezone ?? pickTimezone(m),
        status: pickStatus(m),
      });
    }

    const merged = Array.from(byId.values());
    const filtered =
      requested.length === 0
        ? merged
        : merged.filter((m) => requested.includes(String(m.id ?? "").toLowerCase()));

    res.status(200).json({ markets: filtered, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch market status";
    res.status(500).json({ error: message });
  }
}
