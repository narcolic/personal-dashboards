import type { ReactNode } from "react";

type TerminalCardProps = {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  onClick?: () => void;
};

export function TerminalCard({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "p-3 md:p-4",
  onClick,
}: TerminalCardProps) {
  const interactive = Boolean(onClick);
  return (
    <section
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
      className={`analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card/80 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] ${interactive ? "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_20px_50px_-34px_rgba(0,0,0,0.95)]" : ""} ${className}`}
    >
      {(title || actions) && (
        <div className="flex min-h-11 items-center justify-between border-b border-border/60 bg-secondary/25 px-4 py-2.5">
          {title ? (
            <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-foreground">
              <span className="text-primary">&gt;</span>
              <span className="text-muted-foreground">{title}</span>
            </h2>
          ) : (
            <span />
          )}
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
