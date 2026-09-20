import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { saveHomeCurrency, savePerson, useRefreshTracker, useTracker } from "@/lib/subscriptions";
import {
  buttonClass,
  inputClass,
  LoadingState,
  PageHeading,
  secondaryButtonClass,
} from "./components";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/subscriptions/settings")({
  component: SubscriptionSettings,
});

function SubscriptionSettings() {
  const { t } = useTranslation();
  const tracker = useTracker();
  const refresh = useRefreshTracker();
  const [currency, setCurrency] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!tracker.data) return <LoadingState loading={tracker.isPending} error={tracker.error} />;
  const state = tracker.data.state;
  async function updateCurrency() {
    setBusy(true);
    setError(null);
    try {
      await saveHomeCurrency(currency ?? state.homeCurrency);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("subscriptions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function addPerson() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await savePerson(name.trim());
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("subscriptions.saveFailed"));
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
    } catch (e) {
      setError(e instanceof Error ? e.message : t("subscriptions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <PageHeading title={t("subscriptions.settings")} />
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <TerminalCard title={t("subscriptions.homeCurrency")}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-muted-foreground">
            {t("subscriptions.homeCurrency")}
            <select
              className={`${inputClass} mt-1`}
              value={currency ?? state.homeCurrency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {["EUR", "GBP", "USD", "TRY"].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
          <button
            className={buttonClass}
            disabled={busy || (currency ?? state.homeCurrency) === state.homeCurrency}
            onClick={() => void updateCurrency()}
          >
            {t("common.save")}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("subscriptions.fxExplanation")}</p>
      </TerminalCard>
      <TerminalCard title={t("subscriptions.people")}>
        <div className="space-y-3">
          {state.people.map((person) => (
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
              onChange={(e) => setName(e.target.value)}
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
