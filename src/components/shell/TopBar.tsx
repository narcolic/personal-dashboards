import { Link } from "@tanstack/react-router";
import { dashboards } from "@/components/shell/dashboards";
import { useTranslation } from "react-i18next";

function GridIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
      <rect x="1" y="1" width="4" height="4" className="fill-current" />
      <rect x="7" y="1" width="4" height="4" className="fill-current" />
      <rect x="1" y="7" width="4" height="4" className="fill-current" />
      <rect x="7" y="7" width="4" height="4" className="fill-current" />
    </svg>
  );
}

export function TopBar({ userEmail, onLogout }: { userEmail?: string; onLogout: () => void }) {
  const { t } = useTranslation();
  const navItems = dashboards.filter((item) => item.path);

  return (
    <div className="sticky top-0 z-10 h-10 w-full bg-background/65 px-2 pt-1 backdrop-blur-xl">
      <div className="flex h-8 items-center justify-between gap-3 rounded-lg bg-card/45 px-3 text-xs uppercase tracking-[0.1em] shadow-[0_10px_30px_-24px_rgba(0,0,0,0.95)]">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="inline-flex h-7 shrink-0 items-center gap-2 rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <GridIcon />
            <span className="hidden sm:inline">{t("shell.hub")}</span>
          </Link>

          <nav
            aria-label={t("shell.hub")}
            className="flex min-w-0 items-center gap-1 overflow-x-auto"
          >
            {navItems.map((item) => (
              <Link
                key={item.titleKey}
                to={item.path!}
                activeOptions={{ exact: false }}
                className="inline-flex h-7 shrink-0 items-center rounded-md px-3 font-medium text-muted-foreground transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                activeProps={{
                  className:
                    "inline-flex h-7 shrink-0 items-center rounded-md bg-primary/12 px-3 font-medium text-primary shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                }}
              >
                {t(item.titleKey)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
          <span className="hidden max-w-[180px] truncate md:inline">{userEmail}</span>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md px-2 py-1 text-primary transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {t("common.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
