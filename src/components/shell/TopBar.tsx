import { Link } from "@tanstack/react-router";
import { dashboards } from "@/components/shell/dashboards";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

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
  const currentLanguage = i18n.resolvedLanguage === "el" || i18n.language === "el" ? "el" : "en";

  return (
    <div className="sticky top-0 z-10 h-10 w-full border-b border-border bg-card/50 backdrop-blur">
      <div className="flex h-full w-full items-center justify-between px-4 text-[10px] uppercase tracking-[0.2em]">
        <div className="flex h-full items-center">
          <Link
            to="/"
            className="inline-flex h-full items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <GridIcon />
            <span>{t("shell.hub")}</span>
          </Link>

          <span className="mx-3 text-border">|</span>

          <nav className="flex h-full items-stretch">
            {navItems.map((item) => (
              <Link
                key={item.titleKey}
                to={item.path!}
                activeOptions={{ exact: false }}
                className="inline-flex h-full items-center border-b-2 border-transparent px-3 text-muted-foreground hover:text-foreground"
                activeProps={{
                  className:
                    "inline-flex h-full items-center border-b-2 border-primary px-3 text-primary",
                }}
              >
                {t(item.titleKey)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex h-full items-center gap-3 text-muted-foreground">
          <select
            value={currentLanguage}
            onChange={(e) => {
              void i18n.changeLanguage(e.target.value).catch((error: unknown) => {
                console.error("[i18n] changeLanguage failed", error);
              });
            }}
            className="border border-border bg-card px-1 py-0.5 text-[10px] text-foreground uppercase"
            aria-label={t("common.language")}
          >
            <option value="en">EN</option>
            <option value="el">GR</option>
          </select>
          <span className="hidden md:inline truncate max-w-[180px]">{userEmail}</span>
          <button onClick={onLogout} className="text-primary hover:underline">
            {t("common.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
