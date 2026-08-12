import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type ConsentDetails = {
  authorization_id: string;
  client: { id: string; name: string; uri: string; logo_uri: string };
  user: { id: string; email: string };
  scope: string;
  redirect_uri: string;
};

export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search.authorization_id === "string" ? search.authorization_id : undefined,
  }),
  component: OAuthConsentPage,
});

function OAuthConsentPage() {
  const { authorization_id: authorizationId } = Route.useSearch();
  const { user, loading } = useAuth();
  const [details, setDetails] = useState<ConsentDetails>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !authorizationId) return;
    if (!user) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    let active = true;
    void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) {
        setError(error?.message ?? "The authorization request is no longer valid.");
        return;
      }
      if ("redirect_url" in data) {
        window.location.assign(data.redirect_url);
        return;
      }
      setDetails(data);
    });
    return () => {
      active = false;
    };
  }, [authorizationId, loading, user]);

  const decide = async (decision: "approve" | "deny") => {
    if (!authorizationId) return;
    setBusy(true);
    setError(undefined);
    const response =
      decision === "approve"
        ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
            skipBrowserRedirect: true,
          })
        : await supabase.auth.oauth.denyAuthorization(authorizationId, {
            skipBrowserRedirect: true,
          });
    if (response.error || !response.data) {
      setError(response.error?.message ?? "Authorization could not be completed.");
      setBusy(false);
      return;
    }
    window.location.assign(response.data.redirect_url);
  };

  if (!authorizationId) {
    return <ConsentShell message="Missing authorization request." />;
  }
  if (loading || (!details && !error)) {
    return <ConsentShell message="Loading authorization request..." />;
  }
  if (error) {
    return <ConsentShell message={error} destructive />;
  }

  return (
    <div className="relative min-h-screen bg-background grid-bg flex items-center justify-center px-4">
      <div className="absolute inset-0 scanline pointer-events-none" />
      <section
        className="relative w-full max-w-lg border border-border bg-card"
        aria-labelledby="consent-title"
      >
        <div className="border-b border-border bg-secondary/40 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-primary">
          &gt; AUTH // OAUTH CONSENT
        </div>
        <div className="space-y-5 p-6">
          <div>
            <h1 id="consent-title" className="text-xl font-semibold text-foreground">
              Connect {details?.client.name || "this application"}?
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This connection can read and analyze your Portfolio Terminal portfolios. It cannot
              create, edit, import, or delete portfolios or transactions, and it has no access to
              Car Service data.
            </p>
          </div>

          <dl className="grid gap-3 border border-border bg-background/50 p-4 text-xs">
            <div>
              <dt className="uppercase tracking-widest text-muted-foreground">Application</dt>
              <dd className="mt-1 text-foreground">{details?.client.name}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-widest text-muted-foreground">Signed in as</dt>
              <dd className="mt-1 text-foreground">{details?.user.email}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-widest text-muted-foreground">Identity scope</dt>
              <dd className="mt-1 text-foreground">{details?.scope || "openid"}</dd>
            </div>
          </dl>

          <p className="text-xs leading-5 text-muted-foreground">
            Portfolio access is enforced separately by the API and database row-level security. You
            can revoke this connection from your Supabase OAuth grants.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide("deny")}
              className="border border-border bg-secondary py-2 text-xs uppercase tracking-[0.2em] text-foreground hover:border-destructive disabled:opacity-50"
            >
              Deny
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide("approve")}
              className="bg-primary py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Approve read access
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ConsentShell({
  message,
  destructive = false,
}: {
  message: string;
  destructive?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center px-4">
      <div
        className={`border bg-card px-6 py-5 text-sm ${destructive ? "border-destructive text-destructive" : "border-border text-muted-foreground"}`}
      >
        {message}
      </div>
    </div>
  );
}
