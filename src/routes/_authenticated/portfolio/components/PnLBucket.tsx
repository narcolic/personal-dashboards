import { TerminalCard } from "@/components/terminal/TerminalCard";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import { enrich } from "@/lib/portfolio/transactions/calculations";
import { fmt, fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import { useTranslation } from "react-i18next";

export function PnLBucket({
  title,
  tone,
  totalsByCurrency,
  headerLineCount,
  rows,
}: {
  title: string;
  tone: "bull" | "bear";
  totalsByCurrency: Record<string, number>;
  headerLineCount?: number;
  rows: ReturnType<typeof enrich>;
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
            <div key={currency} className="text-[11px] font-bold">
              {fmtCurrency(value, currency)}
            </div>
          ))}
          {Array.from({ length: fillerCount }).map((_, index) => (
            <div key={`filler-${index}`} className="text-[11px] font-bold invisible">
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
        <TerminalTable>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="px-3 py-2">
                  <div className="font-bold text-primary">{r.ticker}</div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                    {r.quote?.shortName || r.name}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[11px] text-muted-foreground">
                  {fmt(r.shares, { maximumFractionDigits: 4 })} @ {fmt(r.avg_cost)}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums font-bold ${tone === "bull" ? "text-bull" : "text-bear"}`}
                >
                  <div>{fmtCurrency(r.unrealized, r.currency)}</div>
                  <div className="text-[10px]">{fmtPct(r.unrealizedPct)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </TerminalTable>
      )}
    </TerminalCard>
  );
}
