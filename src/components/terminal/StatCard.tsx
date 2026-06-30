type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  tone?: "bull" | "bear";
  accent?: boolean;
  onClick?: () => void;
};

export function StatCard({ label, value, sub, tone, accent, onClick }: StatCardProps) {
  const toneClass =
    tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-foreground";
  const interactive = Boolean(onClick);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`border border-border bg-card px-4 py-3 ${accent ? "border-l-2 border-l-primary" : ""} ${
        interactive ? "cursor-pointer transition-colors hover:border-primary hover:bg-secondary/30" : ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      {sub && <div className={`text-[11px] ${toneClass}`}>{sub}</div>}
    </div>
  );
}
