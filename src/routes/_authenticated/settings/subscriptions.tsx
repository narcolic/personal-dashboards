import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { savePerson, useRefreshTracker, useTracker } from "@/lib/subscriptions";
import { LoadingState } from "../subscriptions/components";

export const Route = createFileRoute("/_authenticated/settings/subscriptions")({
  component: SubscriptionSettings,
});

function SubscriptionSettings() {
  const { t } = useTranslation();
  const tracker = useTracker();
  const refresh = useRefreshTracker();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!tracker.data) return <LoadingState loading={tracker.isPending} error={tracker.error} />;
  const people = tracker.data.state.people;

  async function addPerson() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await savePerson(name.trim());
      setName("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("subscriptions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function togglePerson(id: string, personName: string, isActive: boolean) {
    setBusy(true);
    setError(null);
    try {
      await savePerson(personName, !isActive, id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("subscriptions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-3xl space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t("subscriptions.people")}</h2>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void addPerson();
        }}
        className="flex flex-wrap gap-3 border-b border-border/40 pb-6"
      >
        <input
          className="h-11 min-w-48 flex-1 rounded-lg border border-border/60 bg-background/40 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
          placeholder={t("subscriptions.newPerson")}
          aria-label={t("subscriptions.newPerson")}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={busy || !name.trim()}
        >
          {t("subscriptions.addPerson")}
        </button>
      </form>
      <div className="divide-y divide-border/35">
        {people.map((person) => (
          <div
            key={person.id}
            className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-3 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium text-foreground">{person.name}</span>
              {!person.isActive && (
                <span className="ml-3 text-xs text-muted-foreground">
                  {t("subscriptions.inactive")}
                </span>
              )}
            </div>
            <button
              type="button"
              className="text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              disabled={busy}
              onClick={() => void togglePerson(person.id, person.name, person.isActive)}
            >
              {person.isActive ? t("subscriptions.archive") : t("subscriptions.restore")}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
