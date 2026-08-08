import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import { CarServiceWorkspaceProvider } from "@/routes/_authenticated/car-service/components/CarServiceWorkspace";
import {
  ALL_VEHICLES,
  useCarServiceWorkspace,
} from "@/routes/_authenticated/car-service/components/CarServiceWorkspaceState";

export const Route = createFileRoute("/_authenticated/car-service")({
  component: CarServiceLayout,
});

function CarServiceLayout() {
  return (
    <CarServiceWorkspaceProvider>
      <div className="relative isolate overflow-x-clip md:overflow-x-visible">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full bg-primary/[0.045] blur-3xl"
        />
        <CarServiceContextBar />
        <Outlet />
      </div>
    </CarServiceWorkspaceProvider>
  );
}

function CarServiceContextBar() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { vehicles, isLoading } = useVehicles();
  const { selectedVehicleId, setSelectedVehicleId } = useCarServiceWorkspace();
  const showContext =
    pathname === "/car-service" ||
    pathname === "/car-service/history" ||
    pathname === "/car-service/analytics";

  useEffect(() => {
    if (isLoading) return;
    if (
      selectedVehicleId !== ALL_VEHICLES &&
      !vehicles.some((vehicle) => vehicle.id === selectedVehicleId)
    ) {
      setSelectedVehicleId(ALL_VEHICLES);
    }
  }, [isLoading, selectedVehicleId, setSelectedVehicleId, vehicles]);

  if (!showContext || vehicles.length < 2) return null;

  const choices = [
    { id: ALL_VEHICLES, label: t("car.allVehicles") },
    ...vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: `${vehicle.make ?? "-"} ${vehicle.model ?? "-"}`.trim(),
    })),
  ];
  const showSegments = choices.length <= 4;

  return (
    <div className="mb-6 grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border/50 bg-card/35 p-2 sm:mb-5 sm:flex sm:border-0 sm:bg-transparent sm:p-0 sm:px-1">
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]">
        {t("car.vehicleScope")}:
      </span>
      {showSegments ? (
        <div
          className="grid min-w-0 flex-1 gap-1 rounded-md bg-secondary/25 p-0.5 sm:flex sm:max-w-full sm:flex-none sm:overflow-x-auto"
          style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
          role="group"
          aria-label={t("car.vehicleScope")}
        >
          {choices.map((choice) => {
            const active = choice.id === selectedVehicleId;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setSelectedVehicleId(choice.id)}
                aria-pressed={active}
                title={choice.label}
                className={`h-8 min-w-0 truncate rounded px-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:shrink-0 sm:px-3 sm:text-xs sm:tracking-[0.1em] ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/45 hover:text-foreground"
                }`}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
      ) : (
        <TerminalSelect
          value={selectedVehicleId}
          onChange={setSelectedVehicleId}
          ariaLabel={t("car.vehicleScope")}
          options={choices.map((choice) => ({ value: choice.id, label: choice.label }))}
          size="sm"
          className="w-full sm:max-w-xs"
        />
      )}
    </div>
  );
}
