import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { dashboards } from "@/components/shell/dashboards";
import { useTranslation } from "react-i18next";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { BrandMark } from "@/components/brand/BrandMark";
import { DashboardIcon } from "@/components/shell/DashboardIcon";
import { ProfileAvatar } from "@/components/shell/ProfileAvatar";
import { profileName } from "@/lib/profile";
import type { User } from "@supabase/supabase-js";

const navItems = dashboards.filter((item) => item.path);
type SectionLink = { to: string; label: string; short: string; active: boolean };

export function TopBar({ user, sections = [] }: { user: User | null; sections?: SectionLink[] }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-14 max-w-[1600px] items-center gap-2 px-3 lg:gap-4 lg:px-5">
        <Link
          to="/"
          aria-label={t("shell.dashboards")}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto lg:px-2"
        >
          <BrandMark decorative className="size-6 lg:hidden" />
          <span className="hidden lg:inline-flex">
            <BrandLockup compact />
          </span>
        </Link>
        <div className="h-5 w-px shrink-0 bg-border/70" aria-hidden="true" />
        <AppSwitcher key={pathname} pathname={pathname} />
        {sections.length > 0 && (
          <nav
            aria-label={t("shell.appSections")}
            className="hidden min-w-0 items-center gap-1 lg:flex"
          >
            {sections.map((section) => (
              <SectionNavLink key={section.to} section={section} />
            ))}
          </nav>
        )}
        <Link
          to="/settings"
          aria-label={t("settings.openSettings")}
          className="ml-auto inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-lg text-muted-foreground transition-colors hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:w-auto xl:max-w-[200px] xl:px-2"
        >
          <ProfileAvatar user={user} className="size-7 shrink-0" />
          <span className="hidden truncate text-xs xl:inline">{profileName(user)}</span>
        </Link>
      </div>
      {sections.length > 0 && (
        <nav
          aria-label={t("shell.appSections")}
          className="grid border-t border-border/40 px-3 py-1 lg:hidden"
          style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}
        >
          {sections.map((section) => (
            <SectionNavLink key={section.to} section={section} mobile />
          ))}
        </nav>
      )}
    </header>
  );
}

function SectionNavLink({ section, mobile = false }: { section: SectionLink; mobile?: boolean }) {
  return (
    <Link
      to={section.to}
      aria-current={section.active ? "page" : undefined}
      className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-md px-2 text-[11px] font-medium transition-colors hover:bg-secondary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-3 lg:text-xs ${section.active ? "bg-primary/12 text-primary" : "text-muted-foreground"}`}
    >
      <span className="truncate">{mobile ? section.short : section.label}</span>
    </Link>
  );
}

function AppSwitcher({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    let gesture: { x: number; y: number; started: number; distance: number } | null = null;
    let animation: Animation | undefined;
    const start = (event: TouchEvent) => {
      if (
        window.matchMedia("(min-width: 1024px)").matches ||
        event.touches.length !== 1 ||
        dialog.scrollTop > 0
      )
        return;
      animation?.cancel();
      const touch = event.touches[0];
      gesture = { x: touch.clientX, y: touch.clientY, started: performance.now(), distance: 0 };
    };
    const move = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const distance = touch.clientY - gesture.y;
      if (distance < 0 || Math.abs(touch.clientX - gesture.x) > Math.abs(distance)) {
        gesture = null;
        dialog.style.transform = "";
        return;
      }
      if (distance < 6) return;
      if (event.cancelable) event.preventDefault();
      gesture.distance = distance;
      dialog.style.transform = `translateY(${distance}px)`;
    };
    const finish = (cancelled = false) => {
      if (!gesture) return;
      const { distance, started } = gesture;
      gesture = null;
      const dismiss =
        !cancelled &&
        (distance > 96 ||
          (distance > 32 && distance / Math.max(1, performance.now() - started) > 0.5));
      if (!distance) return;
      animation = dialog.animate(
        [
          { transform: `translateY(${distance}px)` },
          { transform: dismiss ? "translateY(100%)" : "translateY(0)" },
        ],
        {
          duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180,
          easing: "ease-out",
          fill: "forwards",
        },
      );
      dialog.style.transform = "";
      void animation.finished
        .then(() => {
          if (dismiss) dialog.close();
        })
        .catch(() => {});
    };
    const end = () => finish();
    const cancel = () => finish(true);
    dialog.addEventListener("touchstart", start, { passive: true });
    dialog.addEventListener("touchmove", move, { passive: false });
    dialog.addEventListener("touchend", end);
    dialog.addEventListener("touchcancel", cancel);
    return () => {
      animation?.cancel();
      dialog.style.transform = "";
      dialog.removeEventListener("touchstart", start);
      dialog.removeEventListener("touchmove", move);
      dialog.removeEventListener("touchend", end);
      dialog.removeEventListener("touchcancel", cancel);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const positionMenu = () => {
      const trigger = triggerRef.current;
      const dialog = dialogRef.current;
      if (!trigger || !dialog) return;
      const bounds = trigger.getBoundingClientRect();
      dialog.style.setProperty(
        "--switcher-left",
        `${Math.max(12, Math.min(bounds.left, window.innerWidth - 332))}px`,
      );
      dialog.style.setProperty("--switcher-top", `${bounds.bottom + 4}px`);
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", positionMenu);
    };
  }, [open]);
  const currentApp = navItems.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
  const close = () => dialogRef.current?.close();
  return (
    <div className="min-w-0 lg:max-w-64">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${t("shell.switchApp")}: ${currentApp ? t(currentApp.titleKey) : t("shell.dashboards")}`}
        onClick={() => {
          const dialog = dialogRef.current;
          const trigger = triggerRef.current;
          if (!dialog || !trigger) return;
          dialog.showModal();
          dialog.querySelector<HTMLElement>("h2")?.focus();
          setOpen(true);
        }}
        className={`inline-flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${open ? "bg-primary/10" : "hover:bg-primary/10"}`}
      >
        {currentApp ? (
          <DashboardIcon titleKey={currentApp.titleKey} className="flex shrink-0" />
        ) : null}
        <span className="truncate">
          {currentApp ? t(currentApp.titleKey) : t("shell.dashboards")}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        id={id}
        aria-labelledby={`${id}-title`}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            close();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-border bg-popover p-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-2xl backdrop:bg-black/45 lg:bottom-auto lg:left-[var(--switcher-left)] lg:right-auto lg:top-[var(--switcher-top)] lg:w-80 lg:rounded-xl lg:p-1.5 lg:backdrop:bg-transparent"
      >
        <div
          className="mx-auto mb-2 h-1 w-10 rounded-full bg-border lg:hidden"
          aria-hidden="true"
        />
        <div className="px-3 pb-2 pt-3 lg:sr-only">
          <h2
            id={`${id}-title`}
            tabIndex={-1}
            className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground outline-none"
          >
            {t("shell.switchApp")}
          </h2>
        </div>
        <nav aria-label={t("shell.switchApp")} className="space-y-1">
          {navItems.map((item) => {
            const active = currentApp?.path === item.path;
            return (
              <Link
                key={item.titleKey}
                to={item.path!}
                onClick={close}
                aria-current={active ? "location" : undefined}
                className={`flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-12 ${active ? "bg-primary/10 text-primary" : "text-foreground"}`}
              >
                <DashboardIcon
                  titleKey={item.titleKey}
                  className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"
                />
                <span className="flex-1">{t(item.titleKey)}</span>
                {active && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="size-4 shrink-0"
                  >
                    <path
                      d="m3 8 3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Link>
            );
          })}
        </nav>
      </dialog>
    </div>
  );
}
