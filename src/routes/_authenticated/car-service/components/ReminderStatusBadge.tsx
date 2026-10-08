import type { ReminderStatus } from "@/routes/_authenticated/car-service/types";
import { useTranslation } from "react-i18next";

const statusClassMap: Record<ReminderStatus, string> = {
  OVERDUE: "text-destructive border-destructive/35 bg-destructive/10",
  "DUE SOON": "text-primary border-primary/35 bg-primary/10",
  OK: "text-bull border-bull/35 bg-bull/10",
  "NO DATA": "text-muted-foreground border-border/70 bg-secondary/20",
};

export function ReminderStatusBadge({
  status,
  variant = "default",
}: {
  status: ReminderStatus;
  variant?: "default" | "readable";
}) {
  const { t } = useTranslation();
  const labelPrefix = variant === "readable" ? "car.vehiclePage" : "car";
  const labelMap: Record<ReminderStatus, string> = {
    OVERDUE: t(`${labelPrefix}.statusOverdue`),
    "DUE SOON": t(`${labelPrefix}.statusDueSoon`),
    OK: t(`${labelPrefix}.statusOk`),
    "NO DATA": t(`${labelPrefix}.statusNoData`),
  };

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap border px-2 py-0.5 ${variant === "readable" ? "rounded-md text-[11px] font-medium" : "rounded-full text-[9px] uppercase tracking-[0.12em]"} ${statusClassMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}
