import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/subscriptions/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/subscriptions" });
  },
});
