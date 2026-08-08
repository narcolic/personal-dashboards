import { useEffect, useMemo, useState } from "react";
import {
  ALL_VEHICLES,
  CarServiceWorkspaceContext,
  type CarServiceWorkspaceValue,
} from "@/routes/_authenticated/car-service/components/CarServiceWorkspaceState";

const STORAGE_KEY = "car-service-workspace-preferences-v1";

function readSelectedVehicleId() {
  if (typeof window === "undefined") return ALL_VEHICLES;
  try {
    return window.localStorage.getItem(STORAGE_KEY) || ALL_VEHICLES;
  } catch {
    return ALL_VEHICLES;
  }
}

export function CarServiceWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(readSelectedVehicleId);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, selectedVehicleId);
    } catch {
      // Storage is an enhancement; workspace state still works for this session.
    }
  }, [selectedVehicleId]);

  const value = useMemo<CarServiceWorkspaceValue>(
    () => ({ selectedVehicleId, setSelectedVehicleId, allVehiclesId: ALL_VEHICLES }),
    [selectedVehicleId],
  );

  return (
    <CarServiceWorkspaceContext.Provider value={value}>
      {children}
    </CarServiceWorkspaceContext.Provider>
  );
}
