import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import { deleteBill, energyKey, listBills, saveBill } from "@/lib/energy/api";
import { emptyInput, type Draft, type EnergyBill, type EnergyInput } from "@/lib/energy/types";
import { BillReview } from "@/components/energy/BillReview";
import { EnergyOverview } from "@/components/energy/EnergyOverview";
import "@/components/energy/energy.css";

export const Route = createFileRoute("/_authenticated/energy")({ component: EnergyPage });
const EMPTY: EnergyBill[] = [];
type Editor = { draft: Draft; file: File | null; id?: string };
function EnergyPage() {
  const { user } = useAuth();
  return user ? <EnergyWorkspace key={user.id} userId={user.id} /> : null;
}
function EnergyWorkspace({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reading, setReading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ bill: EnergyBill; file: File } | null>(null);
  const query = useQuery({
    queryKey: energyKey(userId),
    queryFn: ({ signal }) => listBills(signal),
    staleTime: 30000,
  });
  const bills = query.data ?? EMPTY;
  useEffect(
    () => () => {
      requestId.current++;
    },
    [],
  );
  const save = useMutation({
    mutationFn: ({ values, id }: { values: EnergyInput; id?: string }) => saveBill(values, id),
    onSuccess: (bill) => {
      client.setQueryData<EnergyBill[]>(energyKey(userId), (old = []) => [
        bill,
        ...old.filter((row) => row.id !== bill.id),
      ]);
      void client.invalidateQueries({ queryKey: energyKey(userId) });
      setEditor(null);
      toast.success(t("energy.saved"));
    },
  });
  const remove = useMutation({
    mutationFn: deleteBill,
    onSuccess: (_, id) => {
      client.setQueryData<EnergyBill[]>(energyKey(userId), (old = []) =>
        old.filter((bill) => bill.id !== id),
      );
      void client.invalidateQueries({ queryKey: energyKey(userId) });
      toast.success(t("energy.deleted"));
    },
  });
  const open = (bill: EnergyBill, file: File | null = null) => {
    save.reset();
    setDuplicate(null);
    setEditor({ draft: { values: bill.summary, warnings: [] }, file, id: bill.id });
  };
  const upload = async (file: File) => {
    const current = ++requestId.current;
    setImportError(null);
    setDuplicate(null);
    setReading(true);
    try {
      const { extractBill } = await import("@/lib/energy/pdf");
      const draft = await extractBill(file);
      if (current !== requestId.current) return;
      const same = bills.find(
        ({ summary: b }) =>
          b.documentHash === draft.values.documentHash ||
          (draft.values.invoiceNumber &&
            b.invoiceNumber?.toLocaleLowerCase() ===
              draft.values.invoiceNumber.toLocaleLowerCase() &&
            b.provider.toLocaleLowerCase() === draft.values.provider?.toLocaleLowerCase() &&
            b.supplyNumber === draft.values.supplyNumber),
      );
      if (same) {
        setDuplicate({ bill: same, file });
        return;
      }
      save.reset();
      setEditor({ draft, file });
    } catch (error) {
      if (current !== requestId.current) return;
      const code = error instanceof Error ? error.message : "";
      setImportError(
        t(
          `energy.importErrors.${["fileSize", "notPdf", "pageLimit"].includes(code) ? code : "failed"}`,
        ),
      );
    } finally {
      if (current === requestId.current) setReading(false);
    }
  };
  const apiError = (error: Error | null) =>
    error instanceof ApiError && error.status === 409
      ? t("energy.duplicate")
      : (error?.message ?? null);
  if (editor)
    return (
      <BillReview
        key={editor.id ?? "new"}
        draft={editor.draft}
        file={editor.file}
        existing={Boolean(editor.id)}
        busy={save.isPending}
        error={apiError(save.error)}
        onSave={(values) => save.mutate({ values, id: editor.id })}
        onCancel={() => {
          if (!save.isPending) setEditor(null);
        }}
      />
    );
  return (
    <section className="energy-workspace">
      <header className="energy-row">
        <div>
          <p className="energy-eyebrow">{t("energy.eyebrow")}</p>
          <h1>{t("dashboards.energyTitle")}</h1>
        </div>
        <div className="energy-actions">
          <button
            className="energy-button"
            disabled={reading || query.isPending || Boolean(query.error)}
            onClick={() => {
              save.reset();
              setEditor({ draft: { values: emptyInput(), warnings: [] }, file: null });
            }}
            type="button"
          >
            {t("energy.addManual")}
          </button>
          <button
            className="energy-button energy-primary"
            disabled={reading || query.isPending || Boolean(query.error)}
            onClick={() => input.current?.click()}
            type="button"
          >
            + {t("energy.upload")}
          </button>
        </div>
      </header>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label={t("energy.upload")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {reading && (
        <div className="energy-notice energy-row" role="status">
          <span>{t("energy.reading")}</span>
          <button
            className="energy-button"
            type="button"
            onClick={() => {
              requestId.current++;
              setReading(false);
            }}
          >
            {t("energy.cancel")}
          </button>
        </div>
      )}
      {importError && (
        <p className="energy-errors" role="alert">
          {importError}
        </p>
      )}
      {duplicate && (
        <div className="energy-notice energy-row" role="status">
          <p>{t("energy.duplicate")}</p>
          <button
            className="energy-button"
            onClick={() => open(duplicate.bill, duplicate.file)}
            type="button"
          >
            {t("energy.openExisting")}
          </button>
        </div>
      )}
      {remove.error && (
        <p className="energy-errors" role="alert">
          {apiError(remove.error)}
        </p>
      )}
      {query.isPending ? (
        <p role="status">{t("energy.loading")}</p>
      ) : query.error ? (
        <div className="energy-notice" role="alert">
          <p>{query.error.message}</p>
          <button className="energy-button mt-3" onClick={() => void query.refetch()} type="button">
            {t("energy.retry")}
          </button>
        </div>
      ) : bills.length === 0 ? (
        <section className="energy-panel energy-empty">
          <span className="energy-badge">ΖeniΘ · PDF</span>
          <h2>{t("energy.emptyTitle")}</h2>
          <p className="energy-muted">{t("energy.emptyDescription")}</p>
          <button
            className="energy-button energy-primary"
            disabled={reading}
            onClick={() => input.current?.click()}
            type="button"
          >
            {t("energy.uploadFirst")}
          </button>
          <p className="energy-muted text-xs">{t("energy.localOnly")}</p>
        </section>
      ) : (
        <EnergyOverview
          bills={bills}
          onOpen={(bill) => open(bill)}
          onDelete={(bill) => {
            if (!remove.isPending) remove.mutate(bill.id);
          }}
        />
      )}
    </section>
  );
}
