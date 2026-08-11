import { supabase } from "@/integrations/supabase/client";

type ApiProblem = {
  detail?: string;
  message?: string;
  title?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:5080";

  throw new Error("VITE_API_BASE_URL is required for the .NET API.");
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);

  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Your session has expired. Please sign in again.");

  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("authorization", `Bearer ${accessToken}`);
  if (init.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let problem: ApiProblem | undefined;
    try {
      problem = (await response.json()) as ApiProblem;
    } catch {
      // The HTTP status below is still useful when a proxy returns a non-JSON body.
    }

    throw new ApiError(
      problem?.detail ??
        problem?.message ??
        problem?.title ??
        `API request failed with status ${response.status}.`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
