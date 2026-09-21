import { Link, useRouterState } from "@tanstack/react-router";
import { dashboards } from "@/components/shell/dashboards";
import { useTranslation } from "react-i18next";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { ProfileAvatar } from "@/components/shell/ProfileAvatar";
import { profileName } from "@/lib/profile";
import type { User } from "@supabase/supabase-js";

const navItems = dashboards.filter((item) => item.path);

export function TopBar({ user }: { user: User | null }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentApp = navItems.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );

  return (
    <div className="sticky top-0 z-10 h-10 w-full bg-background/65 px-2 pt-1 backdrop-blur-xl">
      <div className="flex h-8 items-center justify-between gap-1 rounded-lg bg-card/45 px-1 text-[10px] uppercase tracking-[0.06em] shadow-[0_10px_30px_-24px_rgba(0,0,0,0.95)] md:gap-3 md:px-3 md:text-xs md:tracking-[0.1em]">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-3">
          <Link
            to="/"
            aria-label={t("brand.name")}
            title={t("shell.dashboards")}
            className="inline-flex h-7 shrink-0 items-center rounded-md px-1 text-muted-foreground transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:px-2"
          >
            <BrandLockup compact />
          </Link>

          {currentApp ? (
            <span
              aria-current="location"
              title={t(currentApp.titleKey)}
              className="inline-flex h-7 min-w-0 items-center rounded-md bg-primary/12 px-2 text-[9px] font-medium tracking-[0.04em] text-primary md:hidden"
            >
              <span className="truncate">{t(currentApp.titleKey)}</span>
            </span>
          ) : null}

          <nav
            aria-label={t("shell.hub")}
            className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex"
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
          <Link
            to="/settings"
            aria-label={t("settings.openSettings")}
            title={t("settings.openSettings")}
            className="inline-flex h-8 max-w-[210px] items-center gap-2 rounded-md px-1 transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:px-2"
          >
            <ProfileAvatar user={user} className="size-6" />
            <span className="hidden truncate md:inline">{profileName(user)}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
