import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { savePerson, useRefreshTracker, useTracker } from "@/lib/subscriptions";
import {
  buttonClass,
  inputClass,
  LoadingState,
  secondaryButtonClass,
} from "../subscriptions/components";

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
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <TerminalCard title={t("subscriptions.people")}>
        <div className="space-y-3">
          {people.map((person) => (
            <div
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 text-sm last:border-0"
            >
              <span>
                {person.name}{" "}
                {!person.isActive && (
                  <span className="text-xs text-muted-foreground">
                    ({t("subscriptions.inactive")})
                  </span>
                )}
              </span>
              <button
                className={secondaryButtonClass}
                disabled={busy}
                onClick={() => void togglePerson(person.id, person.name, person.isActive)}
              >
                {person.isActive ? t("subscriptions.archive") : t("subscriptions.restore")}
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <input
              className={inputClass}
              placeholder={t("subscriptions.newPerson")}
              aria-label={t("subscriptions.newPerson")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button
              className={buttonClass}
              disabled={busy || !name.trim()}
              onClick={() => void addPerson()}
            >
              {t("subscriptions.addPerson")}
            </button>
          </div>
        </div>
      </TerminalCard>
    </div>
  );
}
