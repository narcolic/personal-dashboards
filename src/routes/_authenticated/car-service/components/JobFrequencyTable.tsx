import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";

type Row = {
  jobName: string;
  count: number;
  totalSpent: number;
};

export function JobFrequencyTable({ rows }: { rows: Row[] }) {
  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        TOP JOBS BY FREQUENCY
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">RANK</th>
              <th className="px-3 py-2 text-left">JOB / TASK</th>
              <th className="px-3 py-2 text-right">TIMES PERFORMED</th>
              <th className="px-3 py-2 text-right">TOTAL SPENT ON THIS JOB</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={`${row.jobName}-${idx}`}
                className="border-t border-border/60 hover:bg-secondary/30"
              >
                <td className="px-3 py-2 font-bold text-primary">{idx + 1}</td>
                <td className="px-3 py-2">{row.jobName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(row.totalSpent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
