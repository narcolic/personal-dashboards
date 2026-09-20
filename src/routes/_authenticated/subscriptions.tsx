import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  component: () => (
    <div className="space-y-6 font-mono">
      <Outlet />
    </div>
  ),
});
