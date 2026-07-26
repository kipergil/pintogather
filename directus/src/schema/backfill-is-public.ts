import { readItems, updateField, updateItems } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";

/**
 * One-time historical fix: `map_collections.is_public` has defaulted to
 * `false` since the column was created, but no UI ever wrote `true` to it
 * (dead code until the server started enforcing it — see server/routes.ts's
 * canAccessMap). That means every pre-existing map is `is_public: false`
 * purely as a schema artifact, not because anyone chose privacy for it.
 * Enforcing the flag as real access control without first backfilling
 * these rows to `true` would silently lock out anonymous/guest viewers on
 * every map created before this script ran — this script (and the
 * `is_public` default flip in definitions.ts/storage.ts) is what makes
 * enforcement safe to turn on. Safe to re-run: it only ever finds rows
 * still sitting at `false` and has nothing left to do once none remain.
 */
async function main() {
  const client = await getSchemaClient();

  console.log("Updating map_collections.is_public column default to true...");
  await client.request(updateField("map_collections", "is_public", { schema: { default_value: true } }));

  console.log("Finding existing maps with is_public: false...");
  const rows = (await client.request(
    readItems("map_collections", {
      filter: { is_public: { _eq: false } },
      fields: ["id"],
      limit: -1,
    }),
  )) as { id: string }[];

  if (rows.length === 0) {
    console.log("No maps to backfill — done.");
    return;
  }

  console.log(`Backfilling ${rows.length} map(s) to is_public: true...`);
  await client.request(updateItems("map_collections", rows.map((r) => r.id), { is_public: true }));
  console.log(`Backfill complete — ${rows.length} map(s) updated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
