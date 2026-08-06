type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  tone?: "bull" | "bear";
  accent?: boolean;
  onClick?: () => void;
  size?: "default" | "featured" | "compact";
  surface?: "raised" | "flat";
};

export function StatCard({
  label,
  value,
  sub,
  tone,
  accent,
  onClick,
  size = "default",
  surface = "raised",
}: StatCardProps) {
  const toneClass =
    tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-foreground";
  const interactive = Boolean(onClick);
  const sizeClasses =
    size === "featured"
      ? {
          wrapper: "px-4 py-4 md:px-5 md:py-5",
          label: "text-xs tracking-[0.14em]",
          value: "mt-3 text-[1.8rem] tracking-tight md:text-[2.1rem]",
          sub: "mt-1.5 text-xs",
        }
      : size === "compact"
        ? {
            wrapper: "px-3 py-3",
            label: "text-xs tracking-[0.12em]",
            value: "mt-1.5 text-xl tracking-tight",
            sub: "mt-1 text-xs",
          }
        : {
            wrapper: "px-4 py-4",
            label: "text-xs tracking-[0.12em]",
            value: "mt-2 text-2xl tracking-tight",
            sub: "mt-1 text-xs",
          };

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
      className={`relative overflow-hidden rounded-[10px] border ${
        surface === "flat"
          ? "border-transparent bg-secondary/20 shadow-none"
          : "analytics-panel border-border/70 bg-card/80 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]"
      } ${sizeClasses.wrapper} ${accent && surface === "raised" ? "border-primary/30 ring-1 ring-inset ring-primary/10" : ""} ${
        interactive
          ? "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_20px_50px_-34px_rgba(0,0,0,0.95)]"
          : ""
      }`}
    >
      {accent ? <div className="absolute inset-y-4 left-0 w-0.5 rounded-r bg-primary" /> : null}
      <div className={`${sizeClasses.label} uppercase text-muted-foreground`}>{label}</div>
      <div className={`${sizeClasses.value} font-bold ${toneClass}`}>{value}</div>
      {sub && <div className={`${sizeClasses.sub} ${toneClass}`}>{sub}</div>}
    </div>
  );
}
