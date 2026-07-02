type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  tone?: "bull" | "bear";
  accent?: boolean;
  onClick?: () => void;
  size?: "default" | "featured" | "compact";
};

export function StatCard({
  label,
  value,
  sub,
  tone,
  accent,
  onClick,
  size = "default",
}: StatCardProps) {
  const toneClass =
    tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-foreground";
  const interactive = Boolean(onClick);
  const sizeClasses =
    size === "featured"
      ? {
          wrapper: "px-4 py-4 md:px-5 md:py-4",
          label: "text-[10px] tracking-[0.28em]",
          value: "mt-2 text-[1.8rem] md:text-[2rem]",
          sub: "mt-1 text-[11px]",
        }
      : size === "compact"
        ? {
            wrapper: "px-3 py-2.5",
            label: "text-[9px] tracking-[0.22em]",
            value: "mt-1 text-xl",
            sub: "text-[10px]",
          }
        : {
            wrapper: "px-4 py-3",
            label: "text-[10px] tracking-[0.25em]",
            value: "mt-1 text-2xl",
            sub: "text-[11px]",
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
      className={`border border-border bg-card ${sizeClasses.wrapper} ${accent ? "border-l-2 border-l-primary" : ""} ${
        interactive
          ? "cursor-pointer transition-colors hover:border-primary hover:bg-secondary/30"
          : ""
      }`}
    >
      <div className={`${sizeClasses.label} uppercase text-muted-foreground`}>{label}</div>
      <div className={`${sizeClasses.value} font-bold ${toneClass}`}>{value}</div>
      {sub && <div className={`${sizeClasses.sub} ${toneClass}`}>{sub}</div>}
    </div>
  );
}
