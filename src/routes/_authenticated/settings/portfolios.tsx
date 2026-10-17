import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { createPortfolio, deletePortfolio, listPortfolios } from "@/lib/portfolio/portfolios/api";
import { invalidatePortfolioData, portfolioQueryKeys } from "@/lib/portfolio/queries";
import { ApiError } from "@/lib/api/client";
import { PortfolioSettingsPanel } from "./components/PortfolioSettingsPanel";

export const Route = createFileRoute("/_authenticated/settings/portfolios")({
  component: PortfolioSettings,
});

function PortfolioSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const portfolios = useQuery({
    queryKey: portfolioQueryKeys.portfolios,
    queryFn: ({ signal }) => listPortfolios(signal),
  });

  return (
    <PortfolioSettingsPanel
      portfolios={portfolios.data ?? []}
      loading={portfolios.isPending}
      loadError={portfolios.error?.message}
      onRetry={() => void portfolios.refetch()}
      onCreate={async (name) => {
        await createPortfolio({ name });
        invalidatePortfolioData(queryClient);
        await portfolios.refetch({ cancelRefetch: false });
        toast.success(t("portfolio.portfolioAdded"));
      }}
      onDelete={async (id) => {
        try {
          await deletePortfolio(id);
        } catch (cause) {
          if (cause instanceof ApiError && cause.status === 409) {
            throw new Error(t("settings.portfolioHasTransactions"));
          }
          throw cause;
        }
        invalidatePortfolioData(queryClient);
        await portfolios.refetch({ cancelRefetch: false });
        toast.success(t("portfolio.portfolioRemoved"));
      }}
    />
  );
}
