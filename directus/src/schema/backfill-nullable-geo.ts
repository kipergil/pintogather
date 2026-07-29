import { updateField } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";

/**
 * One-time historical fix: `pins.latitude`/`pins.longitude` were created
 * NOT NULL back when every pin was a map location. `apply.ts`'s field
 * bootstrapping is create-only — it never updates an already-existing
 * field's schema — so flipping `definitions.ts`'s decimalField calls to
 * `nullable: true` had no effect on an already-provisioned instance until
 * this script drops the live column's NOT NULL constraint directly. Needed
 * before "link"/"recommendation" item types (which never have coordinates)
 * can be added to pins on that instance. Safe to re-run: dropping an
 * already-dropped NOT NULL constraint is a no-op.
 */
async function main() {
  const client = await getSchemaClient();

  console.log("Dropping NOT NULL on pins.latitude...");
  await client.request(updateField("pins", "latitude", { schema: { is_nullable: true } }));

  console.log("Dropping NOT NULL on pins.longitude...");
  await client.request(updateField("pins", "longitude", { schema: { is_nullable: true } }));

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
