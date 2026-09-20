import { useState, type FormEvent } from "react";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import {
  memberShare,
  money,
  savePerson,
  saveSubscription,
  useRefreshTracker,
  type Member,
  type Person,
  type Subscription,
  type SubscriptionInput,
} from "@/lib/subscriptions";
import { buttonClass, inputClass, secondaryButtonClass } from "./components";
import { useTranslation } from "react-i18next";

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function SubscriptionEditor({
  initial,
  homeCurrency,
  people,
  onSaved,
  onCancel,
}: {
  initial?: Subscription;
  homeCurrency?: string;
  people: Person[];
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const refresh = useRefreshTracker();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [amount, setAmount] = useState(initial?.amount.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? homeCurrency ?? "EUR");
  const [intervalMonths, setIntervalMonths] = useState(initial?.intervalMonths ?? 1);
  const [nextBillingDate, setNextBillingDate] = useState(initial?.nextBillingDate ?? localToday());
  const [splitMode, setSplitMode] = useState<"equal" | "fixed">(initial?.splitMode ?? "equal");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [trackCurrentPeriod, setTrackCurrentPeriod] = useState(false);
  const [members, setMembers] = useState<Member[]>(initial?.members ?? []);
  const [newPerson, setNewPerson] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMember(personId: string) {
    setMembers((current) =>
      current.some((member) => member.personId === personId)
        ? current.filter((member) => member.personId !== personId)
        : [...current, { personId, paymentBehavior: "manual", fixedAmount: null }],
    );
  }
  function changeMember(personId: string, patch: Partial<Member>) {
    setMembers((current) =>
      current.map((member) => (member.personId === personId ? { ...member, ...patch } : member)),
    );
  }
  async function addPerson() {
    if (!newPerson.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const person = await savePerson(newPerson.trim());
      await refresh();
      setMembers((current) => [
        ...current,
        { personId: person.id, paymentBehavior: "manual", fixedAmount: null },
      ]);
      setNewPerson("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("subscriptions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!name.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !nextBillingDate) {
      setError(t("subscriptions.requiredFields"));
      return;
    }
    const payload: SubscriptionInput = {
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      notes: notes.trim() || null,
      amount: parsedAmount,
      currency,
      intervalMonths,
      nextBillingDate,
      splitMode,
      isActive,
      trackCurrentPeriod: !initial && trackCurrentPeriod,
      members: members.map((member) => ({
        ...member,
        fixedAmount: splitMode === "fixed" ? member.fixedAmount : null,
      })),
    };
    setBusy(true);
    setError(null);
    try {
      const saved = await saveSubscription(payload, initial?.id);
      await refresh();
      onSaved(saved.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("subscriptions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  const projected = {
    amount: Number(amount) || 0,
    splitMode,
    members,
  } as Subscription;

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <TerminalCard title={t("subscriptions.details")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("subscriptions.name")}>
            <input
              className={inputClass}
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label={t("subscriptions.category")}>
            <input
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </Field>
          <Field label={t("subscriptions.description")}>
            <input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label={t("subscriptions.notes")}>
            <input
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </TerminalCard>
      <TerminalCard title={t("subscriptions.billing")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("subscriptions.fullCost")}>
            <input
              className={inputClass}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label={t("subscriptions.currency")}>
            <select
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {["EUR", "GBP", "USD", "TRY"].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </Field>
          <Field label={t("subscriptions.frequency")}>
            <select
              className={inputClass}
              value={intervalMonths === 1 || intervalMonths === 12 ? intervalMonths : "custom"}
              onChange={(e) =>
                setIntervalMonths(e.target.value === "custom" ? 3 : Number(e.target.value))
              }
            >
              <option value={1}>{t("subscriptions.monthly")}</option>
              <option value={12}>{t("subscriptions.yearly")}</option>
              <option value="custom">{t("subscriptions.custom")}</option>
            </select>
          </Field>
          {intervalMonths !== 1 && intervalMonths !== 12 && (
            <Field label={t("subscriptions.everyMonths")}>
              <input
                className={inputClass}
                type="number"
                min="1"
                max="120"
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(Number(e.target.value))}
              />
            </Field>
          )}
          <Field label={t("subscriptions.nextBilling")}>
            <input
              className={inputClass}
              type="date"
              value={nextBillingDate}
              onChange={(e) => setNextBillingDate(e.target.value)}
              required
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t("subscriptions.active")}
          </label>
          {!initial && (
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={trackCurrentPeriod}
                onChange={(e) => setTrackCurrentPeriod(e.target.checked)}
              />
              {t("subscriptions.trackCurrent")}
            </label>
          )}
        </div>
      </TerminalCard>
      <TerminalCard title={t("subscriptions.members")}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("subscriptions.splitMode")}>
              <select
                className={inputClass}
                value={splitMode}
                onChange={(e) => setSplitMode(e.target.value as "equal" | "fixed")}
              >
                <option value="equal">{t("subscriptions.equal")}</option>
                <option value="fixed">{t("subscriptions.fixed")}</option>
              </select>
            </Field>
            <span className="pb-2 text-xs text-primary">
              {t("subscriptions.myShare")}:{" "}
              {money(
                Math.max(
                  0,
                  projected.amount -
                    members.reduce((sum, member) => sum + memberShare(projected, member), 0),
                ),
                currency,
              )}
            </span>
          </div>
          <div className="space-y-2">
            {people
              .filter(
                (person) =>
                  person.isActive || members.some((member) => member.personId === person.id),
              )
              .map((person) => {
                const member = members.find((item) => item.personId === person.id);
                return (
                  <div
                    key={person.id}
                    className="grid gap-2 rounded-md border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-center"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(member)}
                        onChange={() => toggleMember(person.id)}
                      />
                      {person.name}
                    </label>
                    {member && (
                      <select
                        aria-label={`${person.name} payment behavior`}
                        className={inputClass}
                        value={member.paymentBehavior}
                        onChange={(e) =>
                          changeMember(person.id, {
                            paymentBehavior: e.target.value as "manual" | "auto",
                          })
                        }
                      >
                        <option value="manual">{t("subscriptions.manual")}</option>
                        <option value="auto">{t("subscriptions.autoPay")}</option>
                      </select>
                    )}
                    {member &&
                      (splitMode === "fixed" ? (
                        <input
                          aria-label={`${person.name} contribution`}
                          className={inputClass}
                          type="number"
                          min="0"
                          step="0.01"
                          value={member.fixedAmount ?? ""}
                          onChange={(e) =>
                            changeMember(person.id, {
                              fixedAmount: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          required
                        />
                      ) : (
                        <span className="text-sm">
                          {money(memberShare(projected, member), currency)}
                        </span>
                      ))}
                  </div>
                );
              })}
          </div>
          <div className="flex gap-2">
            <input
              aria-label={t("subscriptions.newPerson")}
              placeholder={t("subscriptions.newPerson")}
              className={inputClass}
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
            />
            <button
              className={secondaryButtonClass}
              type="button"
              disabled={busy || !newPerson.trim()}
              onClick={() => void addPerson()}
            >
              {t("subscriptions.addPerson")}
            </button>
          </div>
        </div>
      </TerminalCard>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className={buttonClass} disabled={busy} type="submit">
          {busy ? t("common.loading") : t("common.save")}
        </button>
        {onCancel && (
          <button className={secondaryButtonClass} type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 text-xs uppercase tracking-wider text-muted-foreground">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
