import { authentication, createDirectus, customEndpoint, rest, type RestClient } from "@directus/sdk";
import { env } from "./env.js";

/**
 * Loosely-typed client used only by the schema/permissions bootstrap
 * scripts, which operate on Directus's own system collections
 * (directus_collections, directus_fields, directus_relations, ...).
 * Application code (the Express server) uses its own typed client — see
 * server/lib/directus.ts.
 */
export type SchemaClient = ReturnType<typeof createDirectus<Record<string, unknown[]>>> &
  RestClient<Record<string, unknown[]>>;

let cachedSchemaClient: SchemaClient | null = null;

async function login<
  T extends {
    login: (email: string, password: string) => Promise<unknown>;
    request: RestClient<never>["request"];
  },
>(client: T): Promise<T> {
  await client.login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  // These tooling scripts do read-then-write idempotency checks across
  // separate process runs — start from a clean cache rather than trusting
  // invalidation across runs (Directus's Redis-backed query cache can
  // otherwise serve a stale "not found" for a row a previous run just
  // created).
  await client.request(customEndpoint({ path: "/utils/cache/clear", method: "POST" }));
  return client;
}

/** Admin-authenticated client for schema/permissions bootstrapping scripts. */
export async function getSchemaClient(): Promise<SchemaClient> {
  if (cachedSchemaClient) return cachedSchemaClient;
  const client = createDirectus<Record<string, unknown[]>>(env.DIRECTUS_URL)
    .with(authentication("json"))
    .with(rest());
  cachedSchemaClient = (await login(client)) as SchemaClient;
  return cachedSchemaClient;
}
