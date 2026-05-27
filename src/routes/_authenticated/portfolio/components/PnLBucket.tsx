import { TerminalCard } from "@/components/terminal/TerminalCard";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import { enrich } from "@/lib/portfolio/transactions/calculations";
import { fmt, fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import { useTranslation } from "react-i18next";

export function PnLBucket({
  title,
  tone,
  total,
  rows,
}: {
  title: string;
  tone: "bull" | "bear";
  total: number;
  rows: ReturnType<typeof enrich>;
}) {
  const { t } = useTranslation();
  return (
    <TerminalCard
      title={`${title} (${rows.length})`}
      bodyClassName="p-0"
      actions={
        <span
          className={`text-sm font-bold tabular-nums ${tone === "bull" ? "text-bull" : "text-bear"}`}
        >
          {fmtCurrency(total)}
        </span>
      }
    >
      <div className={`h-1 ${tone === "bull" ? "bg-bull/40" : "bg-bear/40"}`} />
      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">{t("portfolio.nothingHere")}</div>
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
