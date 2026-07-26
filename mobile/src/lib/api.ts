import { createApiClient } from "../../../shared/api-client";
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
