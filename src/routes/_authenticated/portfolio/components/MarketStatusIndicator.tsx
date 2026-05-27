import { useMemo } from "react";
import {
  useMarketStatus,
  type MarketSession,
  type MarketStatusItem,
} from "@/routes/_authenticated/portfolio/hooks/useMarketStatus";

type DotTone = "open" | "amber" | "closed" | "neutral";

const DISPLAY_ORDER = ["ATHEX", "NYSE", "XETR"] as const;
const EXCHANGE_TZ: Record<string, string> = {
  ATHEX: "Europe/Athens",
  NYSE: "America/New_York",
  XETR: "Europe/Berlin",
};

function statusTone(session: MarketSession): DotTone {
  if (session === "OPEN") return "open";
  if (session === "PRE_MARKET" || session === "POST_MARKET") return "amber";
  if (session === "CLOSED") return "closed";
  return "neutral";
}

function dotClass(tone: DotTone, pulse: boolean) {
  const base = "inline-block h-2 w-2 rounded-full";
  const color =
    tone === "open"
      ? "bg-bull"
      : tone === "amber"
        ? "bg-amber-400"
        : tone === "closed"
          ? "bg-bear"
          : "bg-muted-foreground";
  return `${base} ${color} ${pulse ? "animate-pulse" : ""}`;
}

function toLabel(session: MarketSession): string {
  if (session === "OPEN") return "Open";
  if (session === "PRE_MARKET") return "Pre-Market";
  if (session === "POST_MARKET") return "After-Hours";
  if (session === "CLOSED") return "Closed";
  return "Unknown";
}

function getOffsetMs(date: Date, tz: string) {
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

  const val = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const y = val("year");
  const m = val("month");
  const d = val("day");
  const hh = val("hour");
  const mm = val("minute");
  const ss = val("second");

  const zonedAsUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  return zonedAsUtc - date.getTime();
}

function convertLocalTime(hhmm: string | undefined, fromTz: string, toTz: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return "N/A";
  const [h, m] = hhmm.split(":").map(Number);

  const now = new Date();
  const fromParts = new Intl.DateTimeFormat("en-US", {
    timeZone: fromTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const val = (type: string) => Number(fromParts.find((p) => p.type === type)?.value ?? "0");
  const y = val("year");
  const mo = val("month");
  const d = val("day");

  const utcGuess = Date.UTC(y, mo - 1, d, h, m, 0);
  const guessDate = new Date(utcGuess);
  const offset = getOffsetMs(guessDate, fromTz);
  const actualUtc = new Date(utcGuess - offset);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: toTz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(actualUtc);
}

function currentWindowHours(m: MarketStatusItem, localTz: string) {
  const sourceTz = m.timezone || EXCHANGE_TZ[m.exchange] || "UTC";
  const window =
    m.session === "PRE_MARKET"
      ? m.tradingHours?.preMarket
      : m.session === "POST_MARKET"
        ? m.tradingHours?.afterHours
        : m.tradingHours?.regular;

  const label =
    m.session === "PRE_MARKET" ? "Pre" : m.session === "POST_MARKET" ? "Post" : "Regular";

  const start = convertLocalTime(window?.start, sourceTz, localTz);
  const end = convertLocalTime(window?.end, sourceTz, localTz);
  return `${label}: ${start} - ${end}`;
}

function byExchange(markets: MarketStatusItem[]) {
  const map = new Map<string, MarketStatusItem>();
  for (const m of markets) {
    map.set(m.exchange.toUpperCase(), m);
  }
  return map;
}

export function MarketStatusIndicator({ exchanges }: { exchanges: string[] }) {
  const requested = useMemo(() => {
    const fixed = DISPLAY_ORDER.map((e) => e.toUpperCase());
    if (exchanges.length === 0) return fixed;
    return fixed;
  }, [exchanges]);

  const { isLoading, isError, markets } = useMarketStatus(requested);
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Athens";
  const marketMap = useMemo(() => byExchange(markets), [markets]);

  return (
    <div className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {DISPLAY_ORDER.map((code) => {
        const m = marketMap.get(code);
        const session: MarketSession = isError
          ? "UNKNOWN"
          : (m?.session ?? (isLoading ? "UNKNOWN" : "CLOSED"));
        const tone = statusTone(session);
        const pulse = session === "OPEN";
        const marker =
          session === "PRE_MARKET"
            ? "PRE"
            : session === "POST_MARKET"
              ? "POST"
              : session === "OPEN"
                ? "OPEN"
                : session === "CLOSED"
                  ? "--"
                  : "--";
        const statusLabel = isError ? "Status Unavailable" : toLabel(session);
        const hoursLine = m ? currentWindowHours(m, localTz) : `Regular: N/A`;

        return (
          <div key={code} className="group relative inline-flex items-center gap-2">
            <span className={dotClass(tone, pulse)} />
            <span>{code}</span>
            <span className="text-[9px] text-foreground/80">{marker}</span>

            <div className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-max max-w-[260px] border border-border bg-card p-2 text-[10px] uppercase tracking-[0.12em] text-foreground shadow-md group-hover:block">
              <div className="font-bold text-primary">
                {code} {statusLabel}
              </div>
              <div className="mt-1 text-muted-foreground">{hoursLine}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
