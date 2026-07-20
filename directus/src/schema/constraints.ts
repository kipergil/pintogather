import "dotenv/config";
import { Client } from "pg";

/**
 * Composite unique constraints Directus's schema API can't express (it only
 * supports single-column `is_unique`). Applied as raw SQL against the same
 * Postgres instance, guarded with `IF NOT EXISTS` so re-running is a no-op.
 */
const statements: string[] = [
  // map_viewers: one grant per (map, user)
  `CREATE UNIQUE INDEX IF NOT EXISTS map_viewers_map_user_uidx ON map_viewers (map, "user")`,
];

/**
 * Some managed Directus instances (e.g. Elestio) don't expose their
 * Postgres port outside the host's own internal network, so there's no
 * `DATABASE_URL` this script could reach even if one were guessed. Skip
 * with a warning rather than fail the whole schema apply — the app itself
 * still works without these composite constraints (they're a data-
 * integrity backstop; server/storage.ts already checks for an existing
 * map_viewers row before creating one).
 */
export async function applyConstraints(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn(
      "  ! DATABASE_URL is not set — skipping composite unique constraints. " +
        "The app enforces these at the application layer instead; set DATABASE_URL " +
        "(a direct Postgres connection) to also enforce them at the database level.",
    );
    return;
  }
  const client = new Client({ connectionString });
  await client.connect();

  try {
    for (const statement of statements) {
      await client.query(statement);
      console.log(`  = ${statement.match(/INDEX IF NOT EXISTS (\S+)/)?.[1]}`);
    }
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applyConstraints()
    .then(() => console.log("Constraints applied."))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
