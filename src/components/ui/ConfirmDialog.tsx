import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isConfirming = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !isConfirming) onCancel();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isConfirming, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-background/80 p-4 backdrop-blur md:items-center"
      onClick={() => {
        if (!isConfirming) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="analytics-panel w-full max-w-md overflow-hidden rounded-xl border border-border/70 bg-card font-mono shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-secondary/25 px-5 py-4 text-xs uppercase tracking-[0.12em] text-primary">
          <span id="confirm-dialog-title">{title}</span>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label={t("common.cancel")}
          >
            x
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div
            id="confirm-dialog-description"
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {description}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-destructive/40 pt-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isConfirming}
              className="rounded-lg border border-destructive/60 px-4 py-2.5 text-xs uppercase tracking-[0.12em] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isConfirming}
              className="rounded-lg px-4 py-2.5 text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:opacity-50"
            >
              {cancelLabel ?? t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
