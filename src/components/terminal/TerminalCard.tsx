import type { ReactNode } from "react";

type TerminalCardProps = {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function TerminalCard({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "p-3 md:p-4",
}: TerminalCardProps) {
  return (
    <section className={`border border-border bg-card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-2">
          {title ? (
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-primary">&gt; {title}</h2>
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
