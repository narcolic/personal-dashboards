import { createFileRoute } from "@tanstack/react-router";
import { AppHub } from "@/components/shell/AppHub";

export const Route = createFileRoute("/")({
  component: AppHub,
});
