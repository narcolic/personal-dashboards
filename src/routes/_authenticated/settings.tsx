import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsLayout });

function SettingsLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
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

  async function signOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await router.navigate({ to: "/login" });
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : t("settings.signOutFailed"));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1120px] space-y-8 font-analytics">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {t("settings.title")}
      </h1>
      <div className="grid items-start gap-8 md:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
        <aside className="min-w-0 md:min-h-72 md:border-r md:border-border/40 md:pr-5">
          <nav aria-label={t("settings.title")} className="flex gap-4 md:flex-col md:gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={link.active ? "page" : undefined}
                className={`flex min-h-10 min-w-0 shrink-0 items-center border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:border-b-0 md:border-l-2 md:px-3 ${
                  link.active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-border/40 pt-3 md:mt-8 md:pt-4">
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void signOut()}
              className="min-h-10 px-1 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:px-3"
            >
              {signingOut ? t("common.loading") : t("settings.signOut")}
            </button>
            {signOutError && (
              <p role="alert" className="mt-2 px-1 text-xs text-destructive md:px-3">
                {signOutError}
              </p>
            )}
          </div>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
