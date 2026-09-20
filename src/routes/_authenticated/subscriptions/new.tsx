import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTracker } from "@/lib/subscriptions";
import { LoadingState, PageHeading } from "./components";
import { SubscriptionEditor } from "./-SubscriptionEditor";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/subscriptions/new")({
  component: NewSubscription,
});

function NewSubscription() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tracker = useTracker();
  if (!tracker.data) return <LoadingState loading={tracker.isPending} error={tracker.error} />;
  return (
    <div className="space-y-5">
      <PageHeading title={t("subscriptions.add")} />
      <SubscriptionEditor
        homeCurrency={tracker.data.state.homeCurrency}
        people={tracker.data.state.people}
        onSaved={(id) =>
          void navigate({ to: "/subscriptions/$subscriptionId", params: { subscriptionId: id } })
        }
      />
    </div>
  );
}
