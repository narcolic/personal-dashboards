import type { Vehicle } from "@/routes/_authenticated/car-service/types";

function vehicleLabel(vehicle: Vehicle): string {
  const make = vehicle.make?.trim() || "-";
  const model = vehicle.model?.trim() || "-";
  const year = vehicle.year ? String(vehicle.year) : "-";
  return `${make} ${model} · ${year}`.toUpperCase();
}

export function VehicleFilterBar({
  vehicles,
  selectedVehicleId,
  onSelect,
}: {
  vehicles: Vehicle[];
  selectedVehicleId: string;
  onSelect: (vehicleId: string) => void;
}) {
  const showAllVehicles = vehicles.length > 1;
  const singleVehicleId = vehicles.length === 1 ? vehicles[0]?.id : null;

  return (
    <div className="flex flex-wrap gap-2 border border-border bg-card px-3 py-2">
      {showAllVehicles ? (
        <button
          onClick={() => onSelect("all")}
          className={`text-[10px] uppercase tracking-[0.2em] px-3 py-1 border border-border ${
            selectedVehicleId === "all" ? "border-primary text-primary" : "text-muted-foreground"
          }`}
        >
          ALL VEHICLES
        </button>
      ) : null}
      {vehicles.map((vehicle) => (
        <button
          key={vehicle.id}
          onClick={() => onSelect(vehicle.id)}
          className={`text-[10px] uppercase tracking-[0.2em] px-3 py-1 border border-border ${
            selectedVehicleId === vehicle.id ||
            (singleVehicleId === vehicle.id && selectedVehicleId === "all")
              ? "border-primary text-primary"
              : "text-muted-foreground"
          }`}
        >
          {vehicleLabel(vehicle)}
        </button>
      ))}
    </div>
  );
}
