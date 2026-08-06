import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/portfolio/holdings/")({
  validateSearch: (search: Record<string, unknown>) => ({
    allocationKind:
      search.allocationKind === "assetType" ||
      search.allocationKind === "region" ||
      search.allocationKind === "currency"
        ? search.allocationKind
        : undefined,
    allocationValue:
      typeof search.allocationValue === "string" ? search.allocationValue : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/portfolio",
      search: {
        allocationKind: search.allocationKind,
        allocationValue: search.allocationValue,
      },
      hash: "holdings",
      replace: true,
    });
  },
});
