import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/portfolio/pnl")({
  beforeLoad: () => {
    throw redirect({ to: "/portfolio/insights", hash: "movers", replace: true });
  },
});
