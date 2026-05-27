import { AnnualSpendChart } from "@/routes/_authenticated/car-service/components/AnnualSpendChart";
import { CategorySpendChart } from "@/routes/_authenticated/car-service/components/CategorySpendChart";
import { JobFrequencyTable } from "@/routes/_authenticated/car-service/components/JobFrequencyTable";

export function ServiceAnalyticsPanel({
  annualSpend,
  categorySpend,
  topJobs,
}: {
  annualSpend: { year: string; total: number }[];
  categorySpend: { category: string; total: number }[];
  topJobs: { jobName: string; count: number; totalSpent: number }[];
}) {
  return (
    <div className="space-y-4 font-mono">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnnualSpendChart data={annualSpend} />
        <CategorySpendChart data={categorySpend} />
      </div>
      <JobFrequencyTable rows={topJobs} />
    </div>
  );
}
