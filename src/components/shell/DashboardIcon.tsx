const DASHBOARD_ICON_PATHS: Record<string, string> = {
  "dashboards.portfolioTitle": "M3 3v18h18 M7 14l4-4 4 3 6-8 M16 5h5v5",
  "dashboards.carServiceTitle":
    "M5 7l2-4h10l2 4 M3 11l2-4h14l2 4v7H3z M3 18v3h3v-3 M18 18v3h3v-3 M6 12h2 M16 12h2",
  "dashboards.subscriptionsTitle":
    "M20 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5 M2 8h18 M6 13h3 M14 14a4 4 0 0 1 7 1 M21 12v3h-3 M22 18a4 4 0 0 1-7 1 M15 22v-3h3",
  "dashboards.energyTitle": "M13 2L3 14h8l-1 8 11-13h-8z",
  "travel.title":
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2a20 20 0 0 1 0 20 20 20 0 0 1 0-20",
};

export function DashboardIcon({
  titleKey,
  className = "flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5",
}: {
  titleKey: string;
  className?: string;
}) {
  return (
    <span className={className}>
      <svg
        aria-hidden="true"
        className="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={DASHBOARD_ICON_PATHS[titleKey]} />
      </svg>
    </span>
  );
}
