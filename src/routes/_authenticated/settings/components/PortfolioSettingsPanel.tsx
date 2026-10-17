import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { PortfolioRecord } from "@/lib/portfolio/portfolios/api";

export function PortfolioSettingsPanel({
  portfolios,
  loading,
  loadError,
  onRetry,
  onCreate,
  onDelete,
}: {
  portfolios: PortfolioRecord[];
  loading: boolean;
  loadError?: string;
  onRetry: () => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const nameId = useId();
  const headingId = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<"create" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PortfolioRecord | null>(null);
  const busy = pending !== null;

  async function addPortfolio(event: FormEvent) {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setPending("create");
    setError(null);
    try {
      await onCreate(name.trim());
      setName("");
      nameInput.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("portfolio.editor.saveFailed"));
    } finally {
      setPending(null);
    }
  }

  async function removePortfolio() {
    if (busy || !deleting) return;
    setPending("delete");
    setDeleteError(null);
    try {
      await onDelete(deleting.id);
      setDeleting(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : t("portfolio.editor.saveFailed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="max-w-3xl space-y-6" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-semibold text-foreground">
        {t("portfolio.portfolios")}
      </h2>

      <form
        onSubmit={(event) => void addPortfolio(event)}
        className="flex flex-wrap items-end gap-3 border-b border-border/40 pb-6"
      >
        <div className="min-w-0 flex-1 basis-56 space-y-2">
          <label htmlFor={nameId} className="block text-sm font-medium text-foreground">
            {t("portfolio.editor.portfolioName")}
          </label>
          <input
            ref={nameInput}
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            readOnly={busy}
            autoComplete="off"
            placeholder={t("settings.portfolioNameExample")}
            className="h-11 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20 read-only:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={busy || loading || Boolean(loadError) || !name.trim()}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {t(pending === "create" ? "portfolio.saving" : "portfolio.addPortfolio")}
        </button>
        {error ? (
          <p role="alert" className="w-full text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("common.loading")}
        </p>
      ) : loadError ? (
        <div role="alert" className="space-y-3 text-sm">
          <p className="text-destructive">{loadError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("portfolio.editor.retry")}
          </button>
        </div>
      ) : portfolios.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{t("portfolio.noPortfoliosYet")}</p>
      ) : (
        <ul className="divide-y divide-border/35">
          {portfolios.map((portfolio) => (
            <li
              key={portfolio.id}
              className="flex min-h-16 items-center justify-between gap-4 py-3"
            >
              <span className="min-w-0 break-words text-sm font-medium text-foreground">
                {portfolio.name}
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={t("settings.deletePortfolio", { name: portfolio.name })}
                onClick={() => {
                  setDeleteError(null);
                  setDeleting(portfolio);
                }}
                className="min-h-9 shrink-0 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {t("common.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("settings.deletePortfolio", { name: deleting?.name ?? "" })}
        description={
          <div className="space-y-3">
            <p>{t("settings.deletePortfolioConfirm")}</p>
            {deleteError ? (
              <p role="alert" className="text-destructive">
                {deleteError}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={t("common.delete")}
        isConfirming={pending === "delete"}
        onCancel={() => {
          if (!busy) setDeleting(null);
        }}
        onConfirm={() => void removePortfolio()}
      />
    </section>
  );
}
