import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * A platform-agnostic fetch-based API client + TanStack Query wiring, shared
 * between the web app (relative URLs, same-origin cookies as a fallback) and
 * the mobile app (an absolute API base URL, no concept of same-origin
 * cookies — Bearer token only). Both platforms get the exact same request/
 * error/auth-header behavior; only `baseUrl`/`getToken`/`includeCredentials`
 * differ per platform.
 */
export interface ApiClientConfig {
  /** Prepended to every request path — "" for the web app (relative, same-origin), or an absolute origin (e.g. EXPO_PUBLIC_API_URL) for the mobile app. */
  baseUrl: string;
  /** Resolves the current auth token (a Clerk session JWT), or null when signed out. */
  getToken: () => Promise<string | null>;
  /** Send `credentials: "include"` so the session cookie (if any) rides along too. Web-only — React Native's fetch has no same-origin cookie jar to include. */
  includeCredentials?: boolean;
}

export async function throwIfResNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.message === "string") message = parsed.message;
    } catch {
      // body wasn't JSON — fall back to the raw text as-is
    }
    const error = new Error(message) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
}

export type UnauthorizedBehavior = "returnNull" | "throw";

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, getToken, includeCredentials = false } = config;

  async function authHeaders(hasBody: boolean): Promise<HeadersInit> {
    const headers: Record<string, string> = hasBody ? { "Content-Type": "application/json" } : {};
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async function apiRequest(method: string, path: string, data?: unknown): Promise<Response> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: await authHeaders(data !== undefined),
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...(includeCredentials ? { credentials: "include" as const } : {}),
    });
    await throwIfResNotOk(res);
    return res;
  }

  const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
    ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const path = queryKey[0] as string;
      const res = await fetch(`${baseUrl}${path}`, {
        headers: await authHeaders(false),
        ...(includeCredentials ? { credentials: "include" as const } : {}),
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: getQueryFn({ on401: "throw" }),
        refetchInterval: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return { apiRequest, getQueryFn, queryClient, authHeaders };
}
