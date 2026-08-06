import type { ReactNode } from "react";

type TerminalTableProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "panel";
};

export function TerminalTable({
  children,
  className = "",
  variant = "default",
}: TerminalTableProps) {
  const frameClass =
    variant === "panel"
      ? "overflow-hidden rounded-[10px] border border-border/70 bg-card/80 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]"
      : "";

  return (
    <div className={`overflow-x-auto ${frameClass}`}>
      <table className={`w-full text-[13px] ${className}`}>{children}</table>
    </div>
  );
}

type TerminalThProps = {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function TerminalTh({ children, className = "", onClick }: TerminalThProps) {
  return (
    <th
      className={`px-3 py-3 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring ${className}`}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </th>
  );
}

type TerminalTdProps = {
  children: ReactNode;
  tone?: "bull" | "bear";
  className?: string;
};

export function TerminalTd({ children, tone, className = "" }: TerminalTdProps) {
  return (
    <td
      className={`px-3 py-3 text-right tabular-nums ${
        tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
