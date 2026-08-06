import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { ActivityPage } from "@/routes/_authenticated/portfolio/transactions";

export const Route = createFileRoute("/_authenticated/portfolio/activity")({
  validateSearch: (search: Record<string, unknown>) => ({
    add: search.add === true || search.add === "true" ? true : undefined,
  }),
  component: PortfolioActivity,
});

function PortfolioActivity() {
  const navigate = useNavigate();
  const { add } = Route.useSearch();
  const clearAddIntent = useCallback(() => {
    void navigate({ to: "/portfolio/activity", search: {}, replace: true });
  }, [navigate]);

  return (
    <ActivityPage
      key={add ? "add-transaction" : "activity"}
      openAddTransaction={Boolean(add)}
      onAddHandled={clearAddIntent}
    />
  );
}
