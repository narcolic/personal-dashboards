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
      className={`border border-border bg-card ${interactive ? "cursor-pointer transition-colors hover:border-primary hover:bg-secondary/20" : ""} ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-2">
          {title ? (
            <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-foreground">
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
