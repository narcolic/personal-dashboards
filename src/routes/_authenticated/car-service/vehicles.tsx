import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import {
  createVehicle,
  deleteVehicle,
  parseVehicleMeta,
  updateVehicle,
} from "@/routes/_authenticated/car-service/hooks/useVehicleMutations";
import { useCarServiceData } from "@/routes/_authenticated/car-service/hooks/useCarServiceData";
import type { Vehicle } from "@/routes/_authenticated/car-service/types";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/car-service/vehicles")({
  component: VehiclesScreen,
});

type EditorState = {
  mode: "create" | "edit";
  vehicleId?: string;
  make: string;
  model: string;
  year: string;
  plate: string;
  colour: string;
  notes: string;
};

function VehiclesScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { vehicles, isLoading, error, refetch } = useVehicles();
  const { visits } = useCarServiceData();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const visitCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const visit of visits) {
      map.set(visit.vehicle_id, (map.get(visit.vehicle_id) ?? 0) + 1);
    }
    return map;
  }, [visits]);

  const startCreate = () => {
    setInlineError(null);
    setEditor({
      mode: "create",
      make: "",
      model: "",
      year: "",
      plate: "",
      colour: "",
      notes: "",
    });
  };

  const startEdit = (vehicle: Vehicle) => {
    const meta = parseVehicleMeta(vehicle.name);
    setInlineError(null);
    setEditor({
      mode: "edit",
      vehicleId: vehicle.id,
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      year: vehicle.year ? String(vehicle.year) : "",
      plate: vehicle.plate ?? "",
      colour: meta.colour,
      notes: meta.notes,
    });
  };

  const save = async () => {
    if (!user?.id || !editor) return;

    const make = editor.make.trim();
    const model = editor.model.trim();
    const plate = editor.plate.trim();
    const year = Number(editor.year);

    if (!make || !model || !plate || !Number.isFinite(year)) {
      setInlineError(t("car.vehicleRequired"));
      return;
    }

    setBusy(true);
    setInlineError(null);

    try {
      if (editor.mode === "create") {
        await createVehicle(supabase, user.id, {
          make,
          model,
          year,
          plate,
          colour: editor.colour,
          notes: editor.notes,
        });
      } else {
        await updateVehicle(supabase, editor.vehicleId!, {
          make,
          model,
          year,
          plate,
          colour: editor.colour,
          notes: editor.notes,
        });
      }

      await refetch();
      setEditor(null);
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : t("car.failedSaveVehicle"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (vehicleId: string) => {
    setBusy(true);
    setInlineError(null);
    try {
      await deleteVehicle(supabase, vehicleId);
      await refetch();
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : t("car.failedDeleteVehicle"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 font-mono">
      <div className="border border-border bg-card px-4 py-2">
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary">
          {t("car.vehiclesTitle")}
        </div>
      </div>

      <div className="border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("car.registeredVehicles")}
          </div>
          <button
            onClick={startCreate}
            className="text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
          >
            {t("car.addVehicle")}
          </button>
        </div>

        {error ? <div className="mb-3 text-destructive text-[11px]">{error}</div> : null}
        {inlineError ? (
          <div className="mb-3 text-destructive text-[11px]">{inlineError}</div>
        ) : null}

        <div className="overflow-x-auto border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">{t("car.make")}</th>
                <th className="px-3 py-2 text-left">{t("car.model")}</th>
                <th className="px-3 py-2 text-right">{t("car.year")}</th>
                <th className="px-3 py-2 text-left">{t("car.licensePlate")}</th>
                <th className="px-3 py-2 text-right">{t("car.visits")}</th>
                <th className="px-3 py-2 text-right">{t("car.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr className="border-t border-border/60">
                  <td colSpan={6} className="px-3 py-3 text-muted-foreground">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr className="border-t border-border/60">
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-muted-foreground uppercase tracking-[0.2em]"
                  >
                    {t("car.noVehiclesFound")}
                  </td>
                </tr>
              ) : (
                vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-t border-border/60">
                    <td className="px-3 py-2">{vehicle.make ?? "-"}</td>
                    <td className="px-3 py-2">{vehicle.model ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{vehicle.year ?? "-"}</td>
                    <td className="px-3 py-2">{vehicle.plate ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{visitCounts.get(vehicle.id) ?? 0}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => startEdit(vehicle)}
                        className="mr-3 uppercase text-primary hover:underline"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        onClick={() => void remove(vehicle.id)}
                        disabled={busy}
                        className="uppercase text-destructive hover:underline disabled:opacity-50"
                      >
                        {t("common.deleteShort")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {editor ? (
          <div className="border border-border bg-card p-4 mt-2">
            <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {editor.mode === "create" ? t("car.newVehicle") : t("car.editVehicle")}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label={t("car.make")}
                value={editor.make}
                onChange={(value) => setEditor((prev) => (prev ? { ...prev, make: value } : prev))}
              />
              <Field
                label={t("car.model")}
                value={editor.model}
                onChange={(value) => setEditor((prev) => (prev ? { ...prev, model: value } : prev))}
              />
              <Field
                label={t("car.year")}
                type="number"
                value={editor.year}
                onChange={(value) => setEditor((prev) => (prev ? { ...prev, year: value } : prev))}
              />
              <Field
                label={t("car.licensePlate")}
                value={editor.plate}
                onChange={(value) => setEditor((prev) => (prev ? { ...prev, plate: value } : prev))}
              />
              <Field
                label={t("car.colour")}
                value={editor.colour}
                onChange={(value) =>
                  setEditor((prev) => (prev ? { ...prev, colour: value } : prev))
                }
              />
              <label className="block md:col-span-2">
                <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t("portfolio.notes")}
                </div>
                <textarea
                  value={editor.notes}
                  onChange={(e) =>
                    setEditor((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                  }
                  rows={2}
                  className="w-full border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </label>
            </div>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => void save()}
                disabled={busy}
                className="bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
              >
                {busy ? t("car.savingVehicle") : t("car.saveVehicle")}
              </button>
              <button
                onClick={() => setEditor(null)}
                className="px-4 py-2 text-[11px] uppercase tracking-[0.2em] border border-border"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
      />
    </label>
  );
}
