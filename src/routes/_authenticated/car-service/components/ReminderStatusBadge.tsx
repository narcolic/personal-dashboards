import type { ReminderStatus } from "@/routes/_authenticated/car-service/types";
import { useTranslation } from "react-i18next";

const statusClassMap: Record<ReminderStatus, string> = {
  OVERDUE: "text-destructive border-destructive/35 bg-destructive/10",
  "DUE SOON": "text-primary border-primary/35 bg-primary/10",
  OK: "text-bull border-bull/35 bg-bull/10",
  "NO DATA": "text-muted-foreground border-border/70 bg-secondary/20",
};

export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  const { t } = useTranslation();
  const labelMap: Record<ReminderStatus, string> = {
    OVERDUE: t("car.statusOverdue"),
    "DUE SOON": t("car.statusDueSoon"),
    OK: t("car.statusOk"),
    "NO DATA": t("car.statusNoData"),
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${statusClassMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}
