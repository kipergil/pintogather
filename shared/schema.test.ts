import { describe, it, expect } from "vitest";
import { insertPinSchema, bulkInsertPinsSchema, updatePinSchema } from "./schema.js";

const LOCATION_PIN = {
  mapId: "map-1",
  title: "Dishoom Shoreditch",
  latitude: "51.5246",
  longitude: "-0.0781",
};

describe("insertPinSchema — geo requirement by item type", () => {
  it("accepts a location item with coordinates", () => {
    const result = insertPinSchema.safeParse({ ...LOCATION_PIN, itemType: "location" });
    expect(result.success).toBe(true);
  });

  it("rejects a location item without coordinates", () => {
    const result = insertPinSchema.safeParse({ mapId: "map-1", title: "Nowhere", itemType: "location" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/Latitude and longitude are required/);
      expect(result.error.errors[0].path).toEqual(["latitude"]);
    }
  });

  it("treats a missing itemType as location, so it still needs coordinates", () => {
    // This default is what made the bulk route's ordering bug possible —
    // pinning it down here so the behaviour can't drift unnoticed.
    expect(insertPinSchema.safeParse({ mapId: "map-1", title: "Nowhere" }).success).toBe(false);
  });

  it.each(["link", "recommendation"] as const)("accepts a %s item with no coordinates", (itemType) => {
    const result = insertPinSchema.safeParse({ mapId: "map-1", title: "An item", itemType });
    expect(result.success).toBe(true);
  });

  it("rejects a half-specified coordinate pair on a location item", () => {
    const result = insertPinSchema.safeParse({
      mapId: "map-1",
      title: "Half",
      itemType: "location",
      latitude: "51.5",
    });
    expect(result.success).toBe(false);
  });

  it("coerces numeric coordinates to strings", () => {
    const result = insertPinSchema.safeParse({
      mapId: "map-1",
      title: "Numeric",
      itemType: "location",
      latitude: 51.5246,
      longitude: -0.0781,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.latitude).toBe("51.5246");
      expect(result.data.longitude).toBe("-0.0781");
    }
  });

  it("requires a non-empty title", () => {
    expect(insertPinSchema.safeParse({ ...LOCATION_PIN, title: "   " }).success).toBe(false);
  });

  it("rejects an unknown itemType", () => {
    expect(insertPinSchema.safeParse({ ...LOCATION_PIN, itemType: "podcast" }).success).toBe(false);
  });
});

describe("bulkInsertPinsSchema", () => {
  const linkItems = [
    { title: "An article", url: "https://example.com/a", note: "worth reading" },
    { title: "Another", url: "https://example.com/b" },
  ];

  it("rejects link items when itemType is absent — the exact failure the bulk route used to hit", () => {
    // Regression guard: the route validated the payload *before* stamping
    // itemType on, so the geo refinement defaulted to "location" and threw
    // out every link/recommendation batch for missing coordinates.
    const result = bulkInsertPinsSchema.safeParse({ pins: linkItems });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/Latitude and longitude are required/);
    }
  });

  it("accepts link items once itemType is stamped on, as the route now does", () => {
    const result = bulkInsertPinsSchema.safeParse({
      pins: linkItems.map((pin) => ({ ...pin, itemType: "link" })),
    });
    expect(result.success).toBe(true);
  });

  it("accepts recommendation items with neither url nor coordinates", () => {
    const result = bulkInsertPinsSchema.safeParse({
      pins: [{ title: "Dune", note: "the novel", itemType: "recommendation" }],
    });
    expect(result.success).toBe(true);
  });

  it("still rejects a location item with no coordinates", () => {
    const result = bulkInsertPinsSchema.safeParse({
      pins: [{ title: "Somewhere", itemType: "location" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a location item with coordinates", () => {
    const result = bulkInsertPinsSchema.safeParse({
      pins: [{ title: "Somewhere", itemType: "location", latitude: "51.5", longitude: "-0.12" }],
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one pin and caps the batch at 200", () => {
    expect(bulkInsertPinsSchema.safeParse({ pins: [] }).success).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => ({ title: `Item ${i}`, itemType: "recommendation" }));
    expect(bulkInsertPinsSchema.safeParse({ pins: many }).success).toBe(false);
    expect(bulkInsertPinsSchema.safeParse({ pins: many.slice(0, 200) }).success).toBe(true);
  });

  it("does not accept mapId or userId from the client", () => {
    const result = bulkInsertPinsSchema.safeParse({
      pins: [{ title: "X", itemType: "recommendation", mapId: "other-map", userId: "someone-else" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pins[0]).not.toHaveProperty("mapId");
      expect(result.data.pins[0]).not.toHaveProperty("userId");
    }
  });
});

describe("updatePinSchema", () => {
  it("allows a partial edit without coordinates, whatever the item type", () => {
    // Editing just a note shouldn't fail for lacking coordinates it never touched.
    const result = updatePinSchema.safeParse({ note: "a new note" });
    expect(result.success).toBe(true);
  });

  it("never accepts an approved flag from the client", () => {
    const result = updatePinSchema.safeParse({ note: "x", approved: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("approved");
  });
});
