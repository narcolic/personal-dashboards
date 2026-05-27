type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  tone?: "bull" | "bear";
  accent?: boolean;
};

export function StatCard({ label, value, sub, tone, accent }: StatCardProps) {
  const toneClass =
    tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-foreground";

  return (
    <div
      className={`border border-border bg-card px-4 py-3 ${accent ? "border-l-2 border-l-primary" : ""}`}
    >
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      {sub && <div className={`text-[11px] ${toneClass}`}>{sub}</div>}
    </div>
  );
}
