import { describe, it, expect } from "vitest";
import { hasCoordinates, haversineDistanceKm, totalRouteDistanceKm, sortPinsForRoute } from "./geo.js";

describe("hasCoordinates", () => {
  it("accepts a point with both coordinates", () => {
    expect(hasCoordinates({ latitude: "51.5", longitude: "-0.12" })).toBe(true);
  });

  it.each([
    ["neither", { latitude: null, longitude: null }],
    ["longitude missing", { latitude: "51.5", longitude: null }],
    ["latitude missing", { latitude: null, longitude: "-0.12" }],
  ] as const)("rejects a point with %s", (_label, point) => {
    expect(hasCoordinates(point)).toBe(false);
  });

  it("treats \"0\" as present, not falsy — the null island case", () => {
    expect(hasCoordinates({ latitude: "0", longitude: "0" })).toBe(true);
  });
});

describe("haversineDistanceKm", () => {
  it("is zero for a point against itself", () => {
    expect(haversineDistanceKm({ latitude: "51.5", longitude: "-0.12" }, { latitude: "51.5", longitude: "-0.12" })).toBe(0);
  });

  it("matches a known distance (London to Paris, ~344km)", () => {
    const km = haversineDistanceKm({ latitude: "51.5074", longitude: "-0.1278" }, { latitude: "48.8566", longitude: "2.3522" });
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(350);
  });

  it("is symmetric", () => {
    const a = { latitude: "51.5074", longitude: "-0.1278" };
    const b = { latitude: "40.7128", longitude: "-74.006" };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 6);
  });

  it("handles crossing the antimeridian without blowing up", () => {
    const km = haversineDistanceKm({ latitude: "0", longitude: "179.9" }, { latitude: "0", longitude: "-179.9" });
    expect(km).toBeLessThan(50);
  });
});

describe("totalRouteDistanceKm", () => {
  it("is zero for fewer than two points", () => {
    expect(totalRouteDistanceKm([])).toBe(0);
    expect(totalRouteDistanceKm([{ latitude: "51.5", longitude: "-0.12" }])).toBe(0);
  });

  it("sums each consecutive leg", () => {
    const a = { latitude: "0", longitude: "0" };
    const b = { latitude: "0", longitude: "1" };
    const c = { latitude: "0", longitude: "2" };
    expect(totalRouteDistanceKm([a, b, c])).toBeCloseTo(
      haversineDistanceKm(a, b) + haversineDistanceKm(b, c),
      6,
    );
  });
});

describe("sortPinsForRoute", () => {
  const pin = (id: string, sequence: number | null, createdAt: string) => ({ id, sequence, createdAt });

  it("orders by sequence when every pin has one", () => {
    const pins = [pin("c", 3, "2026-01-01"), pin("a", 1, "2026-01-03"), pin("b", 2, "2026-01-02")];
    expect(sortPinsForRoute(pins).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("falls back to creation order when no pin has a sequence", () => {
    const pins = [pin("second", null, "2026-01-02"), pin("first", null, "2026-01-01")];
    expect(sortPinsForRoute(pins).map((p) => p.id)).toEqual(["first", "second"]);
  });

  it("treats a null sequence as 0, matching the schema default", () => {
    // Never-explicitly-ordered pins all share the stored default of 0, so a
    // null sequence has to sort the same way or the two would interleave
    // inconsistently.
    const pins = [pin("unsequenced", null, "2026-01-01"), pin("sequenced-1", 1, "2026-01-05")];
    expect(sortPinsForRoute(pins).map((p) => p.id)).toEqual(["unsequenced", "sequenced-1"]);
  });

  it("breaks a null-vs-zero sequence tie on creation order", () => {
    const pins = [pin("newer", 0, "2026-01-09"), pin("older", null, "2026-01-02")];
    expect(sortPinsForRoute(pins).map((p) => p.id)).toEqual(["older", "newer"]);
  });

  it("does not mutate its input", () => {
    const pins = [pin("b", 2, "2026-01-01"), pin("a", 1, "2026-01-02")];
    const before = pins.map((p) => p.id);
    sortPinsForRoute(pins);
    expect(pins.map((p) => p.id)).toEqual(before);
  });

  it("accepts Date objects as well as ISO strings for createdAt", () => {
    const pins = [
      { id: "later", sequence: null, createdAt: new Date("2026-01-02") },
      { id: "earlier", sequence: null, createdAt: new Date("2026-01-01") },
    ];
    expect(sortPinsForRoute(pins).map((p) => p.id)).toEqual(["earlier", "later"]);
  });

  it("returns an empty array unchanged", () => {
    expect(sortPinsForRoute([])).toEqual([]);
  });
});
