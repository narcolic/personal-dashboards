import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

export type MarketSession = "OPEN" | "PRE_MARKET" | "POST_MARKET" | "CLOSED" | "UNKNOWN";

export type MarketStatusItem = {
  exchange: string;
  session: MarketSession;
  label: string;
  marketTime?: string;
  timezone?: string;
  nextOpen?: string;
  tradingHours?: {
    regular?: { start?: string; end?: string };
    preMarket?: { start?: string; end?: string };
    afterHours?: { start?: string; end?: string };
  };
};

type ApiMarket = {
  id?: string;
  exchange?: string;
  market?: string;
  timezone?: string;
  tradingHours?: MarketStatusItem["tradingHours"];
  status?: {
    isOpen?: boolean;
    status?: string;
    marketTime?: string;
    nextChangeType?: string;
    nextChange?: string;
  };
};

type ApiPayload = {
  markets?: ApiMarket[];
};

const EXCHANGE_NAMES: Record<string, string> = {
  nyse: "NYSE",
  nasdaq: "NASDAQ",
  athex: "ATHEX",
  lse: "XLON",
  xetra: "XETR",
  ams: "XAMS",
  epa: "EPA",
};

const EXCHANGE_TZ: Record<string, string> = {
  NYSE: "America/New_York",
  NASDAQ: "America/New_York",
  ATHEX: "Europe/Athens",
  XAMS: "Europe/Amsterdam",
  XLON: "Europe/London",
  XETR: "Europe/Berlin",
  EPA: "Europe/Paris",
};

const KNOWN_WINDOWS: Record<string, NonNullable<MarketStatusItem["tradingHours"]>> = {
  NYSE: {
    preMarket: { start: "04:00", end: "09:30" },
    regular: { start: "09:30", end: "16:00" },
    afterHours: { start: "16:00", end: "20:00" },
  },
  NASDAQ: {
    preMarket: { start: "04:00", end: "09:30" },
    regular: { start: "09:30", end: "16:00" },
    afterHours: { start: "16:00", end: "20:00" },
  },
  ATHEX: { regular: { start: "10:15", end: "17:20" } },
  XAMS: { regular: { start: "09:00", end: "17:30" } },
  XLON: { regular: { start: "08:00", end: "16:30" } },
  XETR: { regular: { start: "09:00", end: "17:30" } },
  EPA: { regular: { start: "09:00", end: "17:30" } },
};

function toLabel(session: MarketSession): string {
  if (session === "OPEN") return "Open";
  if (session === "PRE_MARKET") return "Pre-Market";
  if (session === "POST_MARKET") return "After-Hours";
  if (session === "CLOSED") return "Closed";
  return "Unknown";
}

function normalizeExchange(raw: string): string {
  const k = raw.trim().toLowerCase();
  return EXCHANGE_NAMES[k] ?? raw.toUpperCase();
}

function parseMinutes(hhmm?: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function inWindow(nowMin: number, start?: string, end?: string) {
  const s = parseMinutes(start);
  const e = parseMinutes(end);
  if (s === null || e === null) return false;
  if (s <= e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e;
}

function zonedParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const v = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: v("year"),
    month: v("month"),
    day: v("day"),
    hour: v("hour"),
    minute: v("minute"),
    second: v("second"),
  };
}

function zonedWeekday(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
}

function tzOffsetMs(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const zonedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return zonedAsUtc - date.getTime();
}

function zonedDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
) {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const guessDate = new Date(guessUtc);
  const offset = tzOffsetMs(guessDate, tz);
  return new Date(guessUtc - offset);
}

function addDays(y: number, m: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

function sessionFromStatusText(statusText: string, isOpen?: boolean): MarketSession | null {
  if (isOpen === true) return "OPEN";
  if (!statusText) return null;
  if (statusText.includes("pre")) return "PRE_MARKET";
  if (statusText.includes("after") || statusText.includes("post")) return "POST_MARKET";
  if (statusText.includes("open")) return "OPEN";
  if (statusText.includes("close")) return "CLOSED";
  return null;
}

function computeSessionAndNextOpen(
  m: Omit<MarketStatusItem, "session" | "label" | "nextOpen">,
  now: Date,
) {
  const tz = m.timezone || EXCHANGE_TZ[m.exchange] || "UTC";
  const parts = zonedParts(now, tz);
  const nowMin = parts.hour * 60 + parts.minute;

  const status = (
    m as {
      _status?: { isOpen?: boolean; status?: string; nextChangeType?: string; nextChange?: string };
    }
  )._status;
  const statusText = String(status?.status ?? "").toLowerCase();

  const weekday = zonedWeekday(now, tz);
  if (weekday === "Sat" || weekday === "Sun") {
    return {
      ...m,
      session: "CLOSED" as const,
      label: toLabel("CLOSED"),
      nextOpen: status?.nextChange,
    };
  }

  const pre = m.tradingHours?.preMarket;
  const regular = m.tradingHours?.regular;
  const after = m.tradingHours?.afterHours;

  let session: MarketSession = "CLOSED";
  if (inWindow(nowMin, pre?.start, pre?.end)) session = "PRE_MARKET";
  else if (inWindow(nowMin, regular?.start, regular?.end)) session = "OPEN";
  else if (inWindow(nowMin, after?.start, after?.end)) session = "POST_MARKET";

  const starts = [pre?.start, regular?.start].filter((s): s is string => Boolean(s));
  let nextOpen: string | undefined;
  if (starts.length) {
    const candidates: Date[] = [];
    for (const start of starts) {
      const mins = parseMinutes(start);
      if (mins === null) continue;
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;

      const todayUtc = zonedDateToUtc(parts.year, parts.month, parts.day, hh, mm, tz);
      const tomorrowDate = addDays(parts.year, parts.month, parts.day, 1);
      const tomorrowUtc = zonedDateToUtc(
        tomorrowDate.year,
        tomorrowDate.month,
        tomorrowDate.day,
        hh,
        mm,
        tz,
      );
      candidates.push(todayUtc, tomorrowUtc);
    }

    const future = candidates
      .filter((d) => d.getTime() > now.getTime())
      .sort((a, b) => a.getTime() - b.getTime());
    if (future[0]) nextOpen = future[0].toISOString();
  }

  const serverSession = sessionFromStatusText(statusText, status?.isOpen);
  if (serverSession) {
    session = serverSession;
  }

  if (status?.isOpen === false || statusText.includes("close")) {
    session = "CLOSED";
  }

  if (status?.nextChangeType === "open" && status.nextChange) {
    nextOpen = status.nextChange;
  }

  return {
    ...m,
    session,
    label: toLabel(session),
    nextOpen,
  };
}

function normalizeMarket(m: ApiMarket) {
  const exchange = normalizeExchange(String(m.id ?? m.exchange ?? m.market ?? ""));
  return {
    exchange,
    marketTime: m.status?.marketTime,
    timezone: m.timezone ?? EXCHANGE_TZ[exchange],
    tradingHours: m.tradingHours ?? KNOWN_WINDOWS[exchange],
    _status: m.status,
  };
}

export function useMarketStatus(exchanges: string[]) {
  const requested = useMemo(
    () => Array.from(new Set(exchanges.map((e) => e.trim().toUpperCase()).filter(Boolean))),
    [exchanges],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const query = useQuery({
    queryKey: ["market-status", requested.join(",")],
    queryFn: async () => {
      const qs = encodeURIComponent(requested.join(","));
      const response = await fetch(`/api/market-status?exchanges=${qs}`);
      if (!response.ok) throw new Error(`Market status API error (${response.status})`);
      const json = (await response.json()) as ApiPayload;
      return (json.markets ?? []).map(normalizeMarket);
    },
    enabled: requested.length > 0,
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
    refetchIntervalInBackground: true,
  });

  const markets = useMemo(
    () => (query.data ?? []).map((m) => computeSessionAndNextOpen(m, now)),
    [query.data, now],
  );

  return {
    ...query,
    markets,
  };
}
