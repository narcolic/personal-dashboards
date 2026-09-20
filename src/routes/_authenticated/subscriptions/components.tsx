import { Link } from "@tanstack/react-router";
import { money, type TrackerOverview } from "@/lib/subscriptions";

export const inputClass =
  "h-10 w-full rounded-md border border-border bg-background/70 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
export const buttonClass =
  "inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90 disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-border px-4 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-secondary/50";

export function PageHeading({
  title,
  action,
}: {
  title: string;
  action?: { to: "/subscriptions/new" | "/subscriptions/list"; label: string };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold uppercase tracking-[0.12em] text-foreground">
        <span className="text-primary">&gt; </span>
        {title}
      </h1>
      {action && (
        <Link to={action.to} className={buttonClass}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function LoadingState({ error, loading }: { error?: Error | null; loading: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card/70 p-6 text-sm text-muted-foreground">
      {loading ? "Loading subscriptions…" : error ? error.message : "No data available."}
    </div>
  );
}

export function Converted({
  amount,
  currency,
  overview,
}: {
  amount: number;
  currency: string;
  overview: TrackerOverview;
}) {
  const rate = overview.fx.rates[currency];
  const converted = rate && rate > 0 ? amount / rate : null;
  return (
    <span>
      {money(amount, currency)}
      {currency !== overview.state.homeCurrency && (
        <span className="ml-2 text-xs text-muted-foreground">
          ≈ {money(converted, overview.state.homeCurrency)}
        </span>
      )}
    </span>
  );
}

export function billingDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}
