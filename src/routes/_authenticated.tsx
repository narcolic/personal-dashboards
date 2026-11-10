import { createFileRoute, redirect, Outlet, useRouterState } from "@tanstack/react-router";
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const isPortfolio = pathname.startsWith("/portfolio");
  const isCarService = pathname.startsWith("/car-service");
  const isSubscriptions = pathname.startsWith("/subscriptions");

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
      : isSubscriptions
        ? [
            {
              to: "/subscriptions",
              label: t("subscriptions.overview"),
              short: t("subscriptions.overview"),
              active: pathname === "/subscriptions",
            },
            {
              to: "/subscriptions/list",
              label: t("subscriptions.subscriptions"),
              short: t("subscriptions.subscriptions"),
              active:
                pathname.startsWith("/subscriptions/list") ||
                pathname.startsWith("/subscriptions/new") ||
                /^\/subscriptions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  pathname,
                ),
            },
            {
              to: "/subscriptions/owed",
              label: t("subscriptions.owed"),
              short: t("subscriptions.owed"),
              active: pathname.startsWith("/subscriptions/owed"),
            },
          ]
        : [];

  return (
    <div
      className={`min-h-screen overflow-x-clip bg-background text-foreground ${
        isPortfolio ||
        isCarService ||
        isSubscriptions ||
        pathname === "/travel" ||
        pathname === "/energy"
          ? "workspace-ambient-bg"
          : ""
      }`}
    >
      <TopBar user={user} sections={desktopLinks} />
      <main className="mx-auto w-full max-w-[1400px] p-4 pb-12 md:p-6 md:pb-14">
        <Outlet />
      </main>
      <BottomStatusBar />
    </div>
  );
}
