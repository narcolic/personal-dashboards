import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppHub } from "@/components/shell/AppHub";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AppHub,
});
