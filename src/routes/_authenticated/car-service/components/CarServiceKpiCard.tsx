type CarServiceKpiCardProps = {
  label: string;
  value: string;
  sub?: string;
};

export function CarServiceKpiCard({ label, value, sub }: CarServiceKpiCardProps) {
  return (
    <div className="border border-border bg-card px-4 py-3 font-mono">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
      {sub ? <div className="text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
