import { readItems } from "@directus/sdk";
import type { DirectusRestClient } from "./directus.js";

/**
 * Tolerates a deployment running ahead of the Directus schema.
 *
 * Applying the schema (`npm run directus:schema:apply`) is a separate,
 * manual step from deploying the app, so the two can land out of order.
 * That used to be catastrophically bad: `MAP_FIELDS` names every column the
 * server asks Directus for, and Directus rejects the whole request when one
 * of them doesn't exist yet. A single new column therefore took out every
 * map read and every map write at once — the app looked like it had lost
 * its database, when in fact not a row had been touched.
 *
 * So: a column added by a newer release is listed here as optional. If a
 * request fails, we check whether these actually exist, drop the ones that
 * don't, and let the caller retry. The new feature stays dormant until the
 * schema catches up; everything that predates it keeps working.
 */

/**
 * Columns of `map_collections` a Directus instance may not have yet.
 *
 * Add a field here in the same commit that adds it to MAP_FIELDS, and
 * remove it once the schema has been applied everywhere that matters — a
 * field left here forever costs nothing but says something untrue about
 * what this app requires.
 */
export const OPTIONAL_MAP_FIELDS = ["discover_status"] as const;

/**
 * How long a check holds before the schema is worth looking at again.
 *
 * Long enough that a burst of failures costs one probe, short enough that
 * applying the schema takes effect without a restart — which matters
 * because this app is served both as long-lived Node processes and as
 * serverless functions, and only the latter recycle on their own.
 */
const RECHECK_AFTER_MS = 5 * 60 * 1000;

let inFlight: Promise<boolean> | null = null;
let checkedAt = 0;
let absentFields: string[] = [];

/** Whether this process has established what the schema has. False until the first check runs. */
export function hasCheckedSchema(): boolean {
  return checkedAt > 0;
}

/** Fields this process has established the Directus schema doesn't have. Empty until something has actually failed. */
export function unappliedMapFields(): string[] {
  return [...absentFields];
}

/**
 * Whether a field is safe to *write*. Reads recover by pruning the
 * projection and retrying; a write can't, since its payload is already
 * built by the time anything fails — so the write side asks first.
 */
export function isMapFieldApplied(field: string): boolean {
  return !absentFields.includes(field);
}

/**
 * Whether Directus will accept `field` in a query against
 * `map_collections`. Deliberately probes with an ordinary item read rather
 * than the `/fields` metadata endpoint: this needs exactly the permissions
 * the failing request already had, so it can't itself fail for a reason
 * that has nothing to do with the schema.
 */
async function fieldExists(client: DirectusRestClient, field: string): Promise<boolean> {
  try {
    await client.request(readItems("map_collections", { fields: ["id", field] as never, limit: 1 }));
    return true;
  } catch {
    return false;
  }
}

async function probeAndPrune(client: DirectusRestClient, fields: string[]): Promise<boolean> {
  const absent: string[] = [];
  let pruned = false;

  for (const field of OPTIONAL_MAP_FIELDS) {
    if (await fieldExists(client, field)) {
      // The schema has caught up since an earlier check pruned this.
      if (!fields.includes(field)) fields.push(field);
      continue;
    }
    absent.push(field);
    const at = fields.indexOf(field);
    if (at >= 0) {
      // Mutated in place on purpose: every Directus command is a thunk that
      // reads this array when the request is serialised, so pruning here is
      // enough for the caller's retry to go out with the shorter list.
      fields.splice(at, 1);
      pruned = true;
    }
  }

  absentFields = absent;
  checkedAt = Date.now();

  if (absent.length > 0) {
    console.warn(
      `[schema] map_collections has no ${absent.join(", ")} — serving without ${absent.length === 1 ? "it" : "them"}. ` +
        `Run "npm run directus:schema:apply" to apply the pending schema.`,
    );
  }
  return pruned;
}

/**
 * Runs at most once per recheck window, and (except where the write path
 * and health endpoint ask outright) only after something has already failed
 * — the happy path never pays for it. Resolves true when the field list was
 * shortened, meaning the failed request is worth retrying.
 */
export function reconcileOptionalMapFields(client: DirectusRestClient, fields: string[]): Promise<boolean> {
  if (checkedAt > 0 && Date.now() - checkedAt < RECHECK_AFTER_MS) return Promise.resolve(false);
  inFlight ??= probeAndPrune(client, fields).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Forces the check to run now rather than after a failure. Used by the
 * write path, which has no second chance, and by the health endpoint,
 * whose whole job is to notice this.
 */
export async function ensureOptionalMapFieldsChecked(client: DirectusRestClient, fields: string[]): Promise<void> {
  await reconcileOptionalMapFields(client, fields);
}

/** Test seam — this module's whole point is that it remembers, which tests need to undo. */
export function resetSchemaDriftCacheForTests(): void {
  inFlight = null;
  checkedAt = 0;
  absentFields = [];
}
