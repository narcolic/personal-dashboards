import { createContext, useContext } from "react";

export const ALL_VEHICLES = "all";

export type CarServiceWorkspaceValue = {
  selectedVehicleId: string;
  setSelectedVehicleId: (vehicleId: string) => void;
  allVehiclesId: string;
};

export const CarServiceWorkspaceContext = createContext<CarServiceWorkspaceValue | null>(null);

export function useCarServiceWorkspace() {
  const value = useContext(CarServiceWorkspaceContext);
  if (!value) {
    throw new Error("useCarServiceWorkspace must be used within CarServiceWorkspaceProvider");
  }
  return value;
}
