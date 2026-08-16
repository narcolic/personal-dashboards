import { CategorySpendChart } from "@/routes/_authenticated/car-service/components/CategorySpendChart";
import { HighestCostVisits } from "@/routes/_authenticated/car-service/components/HighestCostVisits";
import { JobFrequencyTable } from "@/routes/_authenticated/car-service/components/JobFrequencyTable";
import { SpendTrendChart } from "@/routes/_authenticated/car-service/components/SpendTrendChart";
import { VehicleComparison } from "@/routes/_authenticated/car-service/components/VehicleComparison";
import type { Vehicle } from "@/routes/_authenticated/car-service/types";

export function ServiceAnalyticsPanel({
  spendTrend,
  categorySpend,
  topJobs,
  expensiveVisits,
  vehicleComparison,
  vehicles,
  showComparison,
}: {
  spendTrend: { bucketStart: string; total: number; previousTotal: number | null }[];
  categorySpend: { category: string; total: number }[];
  topJobs: { jobName: string; count: number; totalSpent: number }[];
  expensiveVisits: {
    id: string;
    vehicleId: string;
    serviceDate: string;
    workshop: string | null;
    totalAmount: number;
  }[];
  vehicleComparison: {
    vehicleId: string;
    visitCount: number;
    totalSpend: number;
    averageVisitCost: number;
    costPer1000Km: number | null;
  }[];
  vehicles: Vehicle[];
  showComparison: boolean;
}) {
  const vehicleNames = new Map(
    vehicles.map((vehicle) => [vehicle.id, `${vehicle.make ?? "—"} ${vehicle.model ?? ""}`.trim()]),
  );

  return (
    <div className="space-y-5">
      <SpendTrendChart data={spendTrend} />
      {showComparison ? (
        <VehicleComparison vehicles={vehicles} comparisons={vehicleComparison} />
      ) : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CategorySpendChart data={categorySpend} />
        <HighestCostVisits visits={expensiveVisits} vehicleNames={vehicleNames} />
      </div>
      <JobFrequencyTable rows={topJobs} />
    </div>
  );
}
