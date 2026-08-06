import { useTranslation } from "react-i18next";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { fmt, fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import { enrich } from "@/lib/portfolio/transactions/calculations";

export function PnLBucket({
  title,
  tone,
  totalsByCurrency,
  headerLineCount,
  rows,
  onRowClick,
}: {
  title: string;
  tone: "bull" | "bear";
  totalsByCurrency: Record<string, number>;
  headerLineCount?: number;
  rows: ReturnType<typeof enrich>;
  onRowClick?: (row: ReturnType<typeof enrich>[number]) => void;
}) {
  const { t } = useTranslation();
  const totalEntries = Object.entries(totalsByCurrency).sort((a, b) => a[0].localeCompare(b[0]));
  const targetLines = Math.max(headerLineCount ?? totalEntries.length, totalEntries.length, 1);
  const fillerCount = Math.max(0, targetLines - totalEntries.length);

  return (
    <TerminalCard
      title={`${title} (${rows.length})`}
      bodyClassName="p-0"
      actions={
        <div className={`text-right tabular-nums ${tone === "bull" ? "text-bull" : "text-bear"}`}>
          {totalEntries.map(([currency, value]) => (
            <div key={currency} className="text-xs font-bold">
              {fmtCurrency(value, currency)}
            </div>
          ))}
          {Array.from({ length: fillerCount }).map((_, index) => (
            <div key={`filler-${index}`} className="invisible text-xs font-bold">
              0
            </div>
          ))}
        </div>
      }
    >
      <div className={`h-1 ${tone === "bull" ? "bg-bull/40" : "bg-bear/40"}`} />
      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          {t("portfolio.nothingHere")}
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {rows.map((row) => (
            <div
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring ${onRowClick ? "cursor-pointer hover:bg-secondary/25" : ""}`}
            >
              <div className="min-w-0">
                <div className="font-bold text-primary">{row.ticker}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {row.quote?.shortName || row.name}
                </div>
                <div className="mt-1 text-xs tabular-nums text-muted-foreground/80">
                  {fmt(row.shares, { maximumFractionDigits: 4 })} @ {fmt(row.avg_cost)}
                </div>
              </div>
              <div
                className={`whitespace-nowrap text-right font-bold tabular-nums ${tone === "bull" ? "text-bull" : "text-bear"}`}
              >
                <div>
                  {tone === "bull" ? "▲ +" : "▼ −"}
                  {fmtCurrency(Math.abs(row.unrealized), row.currency)}
                </div>
                <div className="mt-1 text-xs">{fmtPct(Math.abs(row.unrealizedPct))}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </TerminalCard>
  );
}
