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

export async function applyConstraints(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. A silent localhost fallback here would risk applying these " +
        "constraints to the wrong database — set DATABASE_URL explicitly to the target Postgres.",
    );
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
