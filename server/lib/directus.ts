import { createDirectus, rest, staticToken, type DirectusClient, type RestClient } from "@directus/sdk";
import type { PinTogatherSchema } from "@shared/directus-schema";

export type DirectusRestClient = DirectusClient<PinTogatherSchema> & RestClient<PinTogatherSchema>;

let serviceClient: DirectusRestClient | null = null;

/**
 * Server-only client authenticated as the narrowly-scoped "PinTogather Service" role
 * (see directus/src/permissions/definitions.ts). Every request the API
 * makes to Directus goes through this client — the browser never talks to
 * Directus directly, and this token must never be sent to the client.
 */
export function getServiceDirectusClient(): DirectusRestClient {
  if (serviceClient) return serviceClient;

  const directusUrl = process.env.DIRECTUS_URL;
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!directusUrl) throw new Error("DIRECTUS_URL environment variable is required");
  if (!serviceToken) throw new Error("DIRECTUS_SERVICE_TOKEN environment variable is required");

  serviceClient = createDirectus<PinTogatherSchema>(directusUrl)
    .with(rest())
    .with(staticToken(serviceToken));
  return serviceClient;
}
