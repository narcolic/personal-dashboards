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
        className="w-full max-w-md border border-border bg-card font-mono"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-primary">
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
            className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {description}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-destructive/40 pt-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isConfirming}
              className="border border-destructive/60 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isConfirming}
              className="px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {cancelLabel ?? t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
