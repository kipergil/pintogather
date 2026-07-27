import { createApiClient, throwIfResNotOk } from "../../../shared/api-client";
import { API_URL } from "./config";
import { getClerkToken } from "./token-bridge";

// Absolute baseUrl + no credentials — React Native's fetch has no
// same-origin cookie jar, auth is Bearer-token only. See
// shared/api-client.ts for the actual request/auth logic, which the web
// app's client/src/lib/queryClient.ts instantiates the same way with a
// relative baseUrl and credentials:"include" instead.
const client = createApiClient({ baseUrl: API_URL, getToken: getClerkToken, includeCredentials: false });

export const apiRequest = client.apiRequest;
export const getQueryFn = client.getQueryFn;
export const queryClient = client.queryClient;

/**
 * Uploads a single file (e.g. an expo-image-picker asset) as multipart form
 * data — mirrors client/src/lib/queryClient.ts's apiUpload, but React
 * Native's fetch needs the `{ uri, name, type }` file-object shape instead
 * of a browser File/Blob.
 */
export async function apiUpload(path: string, file: { uri: string; name: string; mimeType: string }): Promise<Response> {
  const token = await getClerkToken();
  const formData = new FormData();
  formData.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  await throwIfResNotOk(res);
  return res;
}
