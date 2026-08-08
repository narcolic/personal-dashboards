type CarServiceKpiCardProps = {
  label: string;
  value: string;
  sub?: string;
};

export function CarServiceKpiCard({ label, value, sub }: CarServiceKpiCardProps) {
  return (
    <div className="border-t border-border/50 px-3 py-4 text-center font-mono even:border-l md:border-l md:border-t-0 md:px-5 md:py-5 md:text-left md:first:border-l-0">
      <div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground md:text-[10px] md:tracking-[0.14em]">
        {label}
      </div>
      <div className="mt-1.5 text-lg font-bold leading-tight tabular-nums text-foreground md:text-xl">
        {value}
      </div>
      {sub ? <div className="mt-1 text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
