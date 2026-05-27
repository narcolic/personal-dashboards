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
  const frameClass = variant === "panel" ? "border border-border bg-card" : "";

  return (
    <div className={`overflow-x-auto ${frameClass}`}>
      <table className={`w-full text-[12px] ${className}`}>{children}</table>
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
    <th className={`px-2 py-2 font-normal ${className}`} onClick={onClick}>
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
      className={`px-2 py-2 text-right tabular-nums ${
        tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
