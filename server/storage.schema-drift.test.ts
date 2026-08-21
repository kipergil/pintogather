import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The outage this reproduces: a release added `discover_status` to the
 * field list every map query sends, but applying the Directus schema is a
 * separate manual step. Against an instance that hadn't had it applied,
 * Directus rejected every map read and write — the app showed no
 * collections and refused to create one, as if the database had been wiped.
 * Nothing had happened to the data at all.
 */

/** Every column map_collections had *before* the release that added discover_status. */
const OLD_SCHEMA_COLUMNS = [
  "id",
  "name",
  "description",
  "share_url",
  "owner",
  "is_public",
  "default_permission",
  "note_label",
  "note_prompt",
  "branding_logo_url",
  "show_on_profile",
  "archived",
  "default_pin_color",
  "default_pin_icon",
  "require_pin_approval",
  "item_type",
  "curated",
  "curated_category",
  "curated_country",
  "curated_city",
  "curated_order",
  "curated_tagline",
  "forked_from_map",
  "folder",
  "date_created",
];

const ROW = Object.fromEntries(OLD_SCHEMA_COLUMNS.map((c) => [c, null]));
const EXISTING_MAP = {
  ...ROW,
  id: "map-1",
  name: "Our favourite coffee spots",
  share_url: "abc123",
  owner: "user-1",
  item_type: "location",
  date_created: "2026-01-01T00:00:00Z",
};

/** Columns this Directus instance has. Swapped per test. */
let columns: string[] = [...OLD_SCHEMA_COLUMNS];
const requests: Array<{ path: string; fields: string[] }> = [];

const request = vi.fn(async (command: () => { path: string; params?: { fields?: string[] }; method: string }) => {
  const { path, params, method } = command();
  const asked = params?.fields ?? [];
  // Copied, not referenced: `asked` *is* the storage layer's own field
  // array, which this fix prunes in place — recording the reference would
  // show every request as if it had been made with the final field list.
  requests.push({ path, fields: [...asked] });

  // Directus rejects the whole request when any requested field is unknown
  // — it does not quietly ignore it, which is what made one new column
  // enough to take down every map query.
  const unknown = asked.filter((f) => !columns.includes(f));
  if (unknown.length > 0) {
    throw new Error(`Invalid query. Field "${unknown[0]}" doesn't exist in collection "map_collections".`);
  }
  return method === "GET" ? [EXISTING_MAP] : EXISTING_MAP;
});

vi.mock("./lib/directus.js", () => ({
  getServiceDirectusClient: () => ({ request }),
}));

import { storage } from "./storage.js";
import { resetSchemaDriftCacheForTests, unappliedMapFields } from "./lib/schema-drift.js";

/**
 * MAP_FIELDS is module state that a previous test's prune has already
 * shortened, so tests have to put it back to get an honest starting point:
 * a fresh process asks for every field this release knows about.
 */
async function freshProcessAgainst(schemaColumns: string[]) {
  columns = [...OLD_SCHEMA_COLUMNS, "discover_status"];
  resetSchemaDriftCacheForTests();
  await storage.getPendingSchemaFields();

  columns = schemaColumns;
  resetSchemaDriftCacheForTests();
  requests.length = 0;
  request.mockClear();
}

beforeEach(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await freshProcessAgainst([...OLD_SCHEMA_COLUMNS]);
});

describe("against a Directus that hasn't had the new schema applied", () => {
  it("still lists the owner's existing collections", async () => {
    const maps = await storage.getMapCollectionsByUserId("user-1");

    expect(maps).toHaveLength(1);
    expect(maps[0]).toMatchObject({ id: "map-1", name: "Our favourite coffee spots" });
  });

  it("reads the missing column as 'not submitted' rather than failing", async () => {
    const [map] = await storage.getMapCollectionsByUserId("user-1");
    expect(map.discoverStatus).toBe("none");
  });

  it("still creates a new collection, first time", async () => {
    const map = await storage.createMapCollection({ name: "New collection", ownerId: "user-1" });
    expect(map.id).toBe("map-1");
  });

  it("never sends the create twice", async () => {
    // Directus may insert the row and only then reject the response
    // projection, so a retried create could leave two collections behind.
    await storage.createMapCollection({ name: "New collection", ownerId: "user-1" });

    const creates = request.mock.calls.filter(([command]) => (command as () => { method: string })().method === "POST");
    expect(creates).toHaveLength(1);
  });

  it("retries once, without the column the schema hasn't got", async () => {
    await storage.getMapCollectionsByUserId("user-1");

    const mapQueries = requests.filter((r) => r.path === "/items/map_collections");
    expect(mapQueries[0].fields).toContain("discover_status");
    expect(mapQueries.at(-1)!.fields).not.toContain("discover_status");
  });

  it("doesn't pay the price again on the next call", async () => {
    await storage.getMapCollectionsByUserId("user-1");
    const afterFirst = request.mock.calls.length;

    await storage.getMapCollectionsByUserId("user-1");

    // One request, not a failure plus a probe plus a retry.
    expect(request.mock.calls.length).toBe(afterFirst + 1);
  });

  it("reports the pending field for the health endpoint", async () => {
    expect(await storage.getPendingSchemaFields()).toEqual(["discover_status"]);
  });

  it("leaves the submission out of a write rather than failing the whole save", async () => {
    const updated = await storage.updateMapDetails("map-1", {
      name: "Renamed",
      discoverStatus: "pending",
    });

    expect(updated).toBeDefined();
    expect(request).toHaveBeenCalled();
  });

  it("keeps admin curation working", async () => {
    const curated = await storage.updateMapCuration("map-1", {
      curated: true,
      curatedCategory: "food-drink",
      curatedCountry: "uk",
      curatedCity: "London",
    });

    expect(curated).toBeDefined();
  });
});

describe("once the schema has been applied", () => {
  beforeEach(async () => {
    await freshProcessAgainst([...OLD_SCHEMA_COLUMNS, "discover_status"]);
  });

  it("asks for the column and keeps it", async () => {
    await storage.getMapCollectionsByUserId("user-1");

    expect(requests.every((r) => r.path !== "/items/map_collections" || r.fields.includes("discover_status"))).toBe(
      true,
    );
    expect(unappliedMapFields()).toEqual([]);
  });

  it("makes exactly one request — no probing, no retry", async () => {
    await storage.getMapCollectionsByUserId("user-1");
    expect(request.mock.calls.length).toBe(1);
  });

  it("writes the submission through", async () => {
    await storage.updateMapDetails("map-1", { discoverStatus: "pending" });

    const write = request.mock.calls.at(-1)![0] as () => { body?: string };
    expect(JSON.parse(write().body ?? "{}")).toMatchObject({ discover_status: "pending" });
  });
});

describe("a failure that isn't schema drift", () => {
  it("is reported, not retried away", async () => {
    await freshProcessAgainst([...OLD_SCHEMA_COLUMNS, "discover_status"]);
    request.mockRejectedValueOnce(new Error("Directus is down"));

    await expect(storage.getMapCollectionsByUserId("user-1")).rejects.toThrow(/Directus is down/);
  });
});

describe("when the schema is applied while the server is running", () => {
  it("picks the column back up without a restart", async () => {
    await storage.getMapCollectionsByUserId("user-1");
    expect(await storage.getPendingSchemaFields()).toEqual(["discover_status"]);

    // The operator runs directus:schema:apply. Nothing restarts.
    columns = [...OLD_SCHEMA_COLUMNS, "discover_status"];
    resetSchemaDriftCacheForTests();

    expect(await storage.getPendingSchemaFields()).toEqual([]);
    requests.length = 0;
    await storage.getMapCollectionsByUserId("user-1");
    expect(requests.at(-1)!.fields).toContain("discover_status");
  });
});
