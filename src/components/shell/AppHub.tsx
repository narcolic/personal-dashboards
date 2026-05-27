import { Link } from "@tanstack/react-router";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { dashboards } from "@/components/shell/dashboards";
import { useTranslation } from "react-i18next";

export function AppHub() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground grid-bg px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-primary">{t("shell.hub")}</div>
            <h1 className="mt-2 text-2xl font-bold uppercase tracking-[0.2em]">{t("shell.dashboards")}</h1>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((dashboard) => (
            dashboard.path ? (
              <Link key={dashboard.titleKey} to={dashboard.path} className="block">
                <TerminalCard bodyClassName="p-4" className="h-full hover:border-primary">
                  <div className="mt-2 text-lg font-bold text-primary">{t(dashboard.titleKey)}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{t(dashboard.descriptionKey)}</p>
                  <div className="mt-4 text-[10px] uppercase tracking-[0.25em] text-foreground">{t("shell.open")}</div>
                </TerminalCard>
              </Link>
            ) : (
              <TerminalCard key={dashboard.titleKey} bodyClassName="p-4" className="h-full opacity-80 border-border/60">
                <div className="mt-2 text-lg font-bold text-primary">{t(dashboard.titleKey)}</div>
                <p className="mt-2 text-sm text-muted-foreground">{t(dashboard.descriptionKey)}</p>
                <div className="mt-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{t("shell.comingSoon")}</div>
              </TerminalCard>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
