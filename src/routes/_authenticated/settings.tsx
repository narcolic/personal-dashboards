import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsLayout });

function SettingsLayout() {
  const { t } = useTranslation();
  const pathname =
    useRouterState({ select: (state) => state.location.pathname }).replace(/\/+$/, "") || "/";
  const links = [
    { to: "/settings", label: t("settings.profile"), active: pathname === "/settings" },
    {
      to: "/settings/subscriptions",
      label: t("dashboards.subscriptionsTitle"),
      active: pathname.startsWith("/settings/subscriptions"),
    },
  ] as const;
  return (
    <div className="space-y-5 font-mono">
      <h1 className="text-xl font-bold uppercase tracking-[0.12em] text-foreground">
        <span className="text-primary">&gt; </span>
        {t("settings.title")}
      </h1>
      <div className="grid items-start gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
        <nav
          aria-label={t("settings.title")}
          className="flex gap-1 overflow-x-auto rounded-lg border border-border/60 bg-card/50 p-1.5 md:flex-col"
        >
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={link.active ? "page" : undefined}
              className={`shrink-0 rounded-md px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${link.active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
