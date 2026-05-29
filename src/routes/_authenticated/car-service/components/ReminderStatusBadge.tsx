import type { ReminderStatus } from "@/routes/_authenticated/car-service/types";
import { useTranslation } from "react-i18next";

const statusClassMap: Record<ReminderStatus, string> = {
  OVERDUE: "text-destructive border-destructive",
  "DUE SOON": "text-primary border-primary",
  OK: "text-bull border-bull",
  "NO DATA": "text-muted-foreground border-border",
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
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${statusClassMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}
