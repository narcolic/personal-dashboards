import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/shell/TopBar";
import { BottomStatusBar } from "@/components/shell/BottomStatusBar";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const logout = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  const isPortfolio = pathname.startsWith("/portfolio");
  const isCarService = pathname.startsWith("/car-service");

  const desktopLinks = isPortfolio
    ? [
        {
          to: "/portfolio",
          label: t("header.overview"),
          short: t("header.overview"),
          active: pathname === "/portfolio" || pathname.startsWith("/portfolio/holdings/"),
        },
        {
          to: "/portfolio/insights",
          label: t("header.insights"),
          short: t("header.insights"),
          active: pathname.startsWith("/portfolio/insights"),
        },
        {
          to: "/portfolio/activity",
          label: t("header.activity"),
          short: t("header.activity"),
          active: pathname.startsWith("/portfolio/activity"),
        },
      ]
    : isCarService
      ? [
          {
            to: "/car-service",
            label: t("header.overview"),
            short: t("header.overview"),
            active: pathname === "/car-service",
          },
          {
            to: "/car-service/history",
            label: t("header.history"),
            short: t("header.history"),
            active: pathname.startsWith("/car-service/history"),
          },
          {
            to: "/car-service/analytics",
            label: t("header.analytics"),
            short: t("header.analytics"),
            active: pathname.startsWith("/car-service/analytics"),
          },
          {
            to: "/car-service/vehicles",
            label: t("header.vehicles"),
            short: t("header.vehicles"),
            active: pathname.startsWith("/car-service/vehicles"),
          },
        ]
      : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar userEmail={user?.email} onLogout={logout} />
      <header className="sticky top-10 z-[9] bg-background/55 px-4 py-2 backdrop-blur-xl md:px-2">
        <div className="mx-auto hidden max-w-[1400px] px-2 md:block md:px-4">
          {desktopLinks.length > 0 ? (
            <nav
              aria-label={isPortfolio ? t("header.portfolio") : t("header.carService")}
              className="inline-flex items-center gap-1 rounded-xl bg-card/45 p-1 text-xs uppercase tracking-[0.1em] text-muted-foreground shadow-[0_12px_32px_-28px_rgba(0,0,0,0.9)]"
            >
              {desktopLinks.map((link) => (
                <RowNavLink key={link.to} to={link.to} active={link.active}>
                  {link.label}
                </RowNavLink>
              ))}
            </nav>
          ) : null}
        </div>
        {desktopLinks.length > 0 ? (
          <div className="mx-auto md:hidden">
            <nav
              aria-label={isPortfolio ? t("header.portfolio") : t("header.carService")}
              className="grid w-full rounded-xl bg-card/45 p-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground shadow-[0_12px_32px_-28px_rgba(0,0,0,0.9)]"
              style={{ gridTemplateColumns: `repeat(${desktopLinks.length}, minmax(0, 1fr))` }}
            >
              {desktopLinks.map((link) => (
                <RowNavLink key={link.to} to={link.to} active={link.active} fill>
                  {link.short}
                </RowNavLink>
              ))}
            </nav>
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-[1400px] p-4 pb-12 md:p-6 md:pb-14">
        <Outlet />
      </main>
      <BottomStatusBar />
    </div>
  );
}

function RowNavLink({
  to,
  active,
  fill = false,
  children,
}: {
  to: string;
  active: boolean;
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 min-w-0 items-center rounded-md font-medium transition-colors hover:bg-secondary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        fill ? "w-full justify-center px-1" : "shrink-0 px-4"
      } ${active ? "bg-primary/12 text-primary shadow-sm" : "text-muted-foreground"}`}
    >
      {children}
    </Link>
  );
}
