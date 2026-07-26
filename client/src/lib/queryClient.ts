import { createApiClient, throwIfResNotOk } from "@shared/api-client";
import { getClerkToken } from "./clerkTokenStore";

// Relative baseUrl ("") + credentials:"include" — the web app talks to its
// own same-origin Express server. See shared/api-client.ts for the actual
// request/auth logic, which the mobile app instantiates with an absolute
// baseUrl and no credentials instead.
const client = createApiClient({ baseUrl: "", getToken: getClerkToken, includeCredentials: true });

export const apiRequest = client.apiRequest;
export const getQueryFn = client.getQueryFn;
export const queryClient = client.queryClient;

/** Multipart file upload — no Content-Type header, the browser sets the multipart boundary itself. Web-only (uses the DOM File type), so it stays here rather than in the shared factory. */
export async function apiUpload(url: string, file: File, fields?: Record<string, string>): Promise<Response> {
  const token = await getClerkToken();
  const formData = new FormData();
  formData.append("file", file);
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}
