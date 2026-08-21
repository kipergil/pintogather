import { describe, it, expect, beforeEach, vi } from "vitest";
import { readItems } from "@directus/sdk";
import type { DirectusRestClient } from "./directus.js";
import type { MapCollection as DirectusMapCollection, PinGatherSchema } from "../../shared/directus-schema.js";
import {
  ensureOptionalMapFieldsChecked,
  isMapFieldApplied,
  reconcileOptionalMapFields,
  resetSchemaDriftCacheForTests,
  unappliedMapFields,
} from "./schema-drift.js";

/**
 * The failure this guards against took down every map read and write at
 * once: a release named a column in its field projection that the Directus
 * schema didn't have yet, and Directus rejects the whole request when one
 * field is unknown. The app looked like it had lost its database.
 */

const FULL_FIELDS: (keyof DirectusMapCollection)[] = ["id", "name", "curated", "discover_status", "date_created"];

/** A Directus stand-in that rejects any query naming a field it doesn't have. */
function directusWith(knownFields: string[]) {
  const request = vi.fn(async (command: () => { params?: { fields?: string[] } }) => {
    const asked = command().params?.fields ?? [];
    const unknown = asked.filter((f) => !knownFields.includes(f));
    if (unknown.length > 0) {
      throw new Error(`Invalid query. Field "${unknown[0]}" doesn't exist in collection "map_collections".`);
    }
    return [{ id: "map-1" }];
  });
  return { client: { request } as unknown as DirectusRestClient, request };
}

beforeEach(() => resetSchemaDriftCacheForTests());

describe("a Directus schema that has caught up", () => {
  it("changes nothing and reports nothing pending", async () => {
    const fields = [...FULL_FIELDS];
    const { client } = directusWith(FULL_FIELDS);

    expect(await reconcileOptionalMapFields(client, fields)).toBe(false);
    expect(fields).toEqual(FULL_FIELDS);
    expect(unappliedMapFields()).toEqual([]);
    expect(isMapFieldApplied("discover_status")).toBe(true);
  });
});

describe("a deployment running ahead of the schema", () => {
  const OLD_SCHEMA = FULL_FIELDS.filter((f) => f !== "discover_status");

  it("drops the column the schema hasn't got, and asks to be retried", async () => {
    const fields = [...FULL_FIELDS];
    const { client } = directusWith(OLD_SCHEMA);

    expect(await reconcileOptionalMapFields(client, fields)).toBe(true);
    expect(fields).toEqual(OLD_SCHEMA);
  });

  it("reports what's missing, so it can be seen from outside", async () => {
    const { client } = directusWith(OLD_SCHEMA);
    await reconcileOptionalMapFields(client, [...FULL_FIELDS]);

    expect(unappliedMapFields()).toEqual(["discover_status"]);
    expect(isMapFieldApplied("discover_status")).toBe(false);
  });

  it("says so out loud", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = directusWith(OLD_SCHEMA);
    await reconcileOptionalMapFields(client, [...FULL_FIELDS]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("directus:schema:apply"));
    warn.mockRestore();
  });

  it("lets a command built before the prune go back out without the field", async () => {
    // The mechanism the whole recovery rests on: a Directus command is a
    // thunk that reads the field list when the request is serialised, so
    // pruning the array in place is enough for the caller's retry.
    const fields = [...FULL_FIELDS];
    const command = readItems<PinGatherSchema, "map_collections", { fields: (keyof DirectusMapCollection)[]; limit: number }>(
      "map_collections",
      { fields, limit: 1 },
    );
    const { client, request } = directusWith(OLD_SCHEMA);

    await expect(client.request(command)).rejects.toThrow(/discover_status/);
    await reconcileOptionalMapFields(client, fields);

    await expect(client.request(command)).resolves.toEqual([{ id: "map-1" }]);
    expect(request).toHaveBeenCalled();
  });
});

describe("how often it checks", () => {
  it("checks once per process, however many failures follow", async () => {
    const fields = [...FULL_FIELDS];
    const { client, request } = directusWith(FULL_FIELDS);

    await reconcileOptionalMapFields(client, fields);
    const afterFirst = request.mock.calls.length;
    await reconcileOptionalMapFields(client, fields);
    await reconcileOptionalMapFields(client, fields);

    expect(request.mock.calls.length).toBe(afterFirst);
  });

  it("only offers a retry to the caller that discovered the drift", async () => {
    // A later failure is a real failure — retrying it would just double
    // every error the app ever hits.
    const fields = [...FULL_FIELDS];
    const { client } = directusWith(FULL_FIELDS.filter((f) => f !== "discover_status"));

    expect(await reconcileOptionalMapFields(client, fields)).toBe(true);
    expect(await reconcileOptionalMapFields(client, fields)).toBe(false);
  });

  it("shares one check between concurrent callers", async () => {
    const fields = [...FULL_FIELDS];
    const { client, request } = directusWith(FULL_FIELDS);

    await Promise.all([
      reconcileOptionalMapFields(client, fields),
      reconcileOptionalMapFields(client, fields),
      reconcileOptionalMapFields(client, fields),
    ]);

    expect(request.mock.calls.length).toBe(1);
  });

  it("costs nothing until something has failed", async () => {
    // ensureOptionalMapFieldsChecked is the deliberate exception — the write
    // path and the health endpoint ask for the check up front.
    const { request } = directusWith(FULL_FIELDS);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("ensureOptionalMapFieldsChecked", () => {
  it("settles the question without waiting for a failure", async () => {
    const fields = [...FULL_FIELDS];
    const { client } = directusWith(FULL_FIELDS.filter((f) => f !== "discover_status"));

    await ensureOptionalMapFieldsChecked(client, fields);

    expect(isMapFieldApplied("discover_status")).toBe(false);
  });
});
