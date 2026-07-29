import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";

/**
 * Route-level tests: real Express, real middleware, real Zod validation,
 * real JSON round-trip — with only the true external edges (Directus, Clerk,
 * Anthropic, outbound fetch) replaced. That boundary is deliberate: the bugs
 * worth catching here live in the wiring between those layers, which a
 * pure-unit test of a handler would step straight over.
 */

/** Swapped per test to stand in for the signed-in user. */
let currentUser: { id: string; userGroup: string } | null = null;

vi.mock("./clerkAuth.js", () => ({
  setupAuth: () => {},
  isAuthenticated: (_req: unknown, res: any, next: () => void) => {
    if (!currentUser) return res.status(401).json({ message: "Unauthorized" });
    next();
  },
  getCurrentUser: async () => currentUser,
}));

vi.mock("./storage.js", () => ({
  storage: {
    getMapCollectionByShareUrl: vi.fn(),
    getMapCollectionById: vi.fn(),
    getUserProfile: vi.fn(),
    getUserMapAccess: vi.fn(),
    getPinsByMapId: vi.fn(),
    upsertPins: vi.fn(),
    uploadVenueScreenshot: vi.fn(),
    getPublishedPages: vi.fn().mockResolvedValue([]),
    getCuratedMapCollections: vi.fn().mockResolvedValue([]),
  },
}));

/**
 * The routes construct an Anthropic client at import time and 503 without a
 * key, so the tier/cap/validation branches below that check are unreachable
 * unless the SDK is stubbed. No test here asserts on model output — only on
 * the wiring around the call.
 */
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '[{"name": "Extracted place"}]' }],
      }),
    };
  },
}));

vi.mock("./services/aiUsage.js", () => ({
  checkAndIncrementAiUsage: vi.fn(),
  getAiUsageToday: vi.fn(),
}));

vi.mock("./lib/link-preview.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/link-preview.js")>();
  return { ...actual, fetchLinkPreview: vi.fn() };
});

import { storage } from "./storage.js";
import { checkAndIncrementAiUsage } from "./services/aiUsage.js";
import { fetchLinkPreview, LinkPreviewError } from "./lib/link-preview.js";
import { createApp } from "./app.js";

const mockStorage = vi.mocked(storage, true);
const mockAiUsage = vi.mocked(checkAndIncrementAiUsage);
const mockFetchPreview = vi.mocked(fetchLinkPreview);

const OWNER = { id: "user-owner", userGroup: "premium" };
const OTHER = { id: "user-other", userGroup: "freemium" };

function mapFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "map-1",
    name: "Test collection",
    shareUrl: "abc123",
    ownerId: OWNER.id,
    isPublic: true,
    itemType: "location",
    requirePinApproval: false,
    ...overrides,
  };
}

let app: Express;

beforeEach(async () => {
  vi.clearAllMocks();
  currentUser = null;
  mockStorage.getUserProfile.mockResolvedValue({ ...OWNER } as never);
  mockStorage.getPinsByMapId.mockResolvedValue([] as never);
  mockStorage.upsertPins.mockResolvedValue({ created: [], updated: [], skippedDueToLimit: 0 } as never);
  app = await createApp();
});

describe("POST /api/maps/:shareUrl/pins/bulk", () => {
  it("401s an anonymous request", async () => {
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture() as never);
    const res = await request(app)
      .post("/api/maps/abc123/pins/bulk")
      .send({ pins: [{ title: "X", latitude: "51.5", longitude: "-0.1" }] });
    expect(res.status).toBe(401);
    expect(mockStorage.upsertPins).not.toHaveBeenCalled();
  });

  it("404s an unknown collection", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(undefined as never);
    const res = await request(app).post("/api/maps/nope/pins/bulk").send({ pins: [{ title: "X" }] });
    expect(res.status).toBe(404);
  });

  it("creates location pins that carry coordinates", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture() as never);
    const res = await request(app)
      .post("/api/maps/abc123/pins/bulk")
      .send({ pins: [{ title: "Dishoom", latitude: "51.5246", longitude: "-0.0781" }] });

    expect(res.status).toBe(201);
    const [, pins] = mockStorage.upsertPins.mock.calls[0];
    expect(pins[0]).toMatchObject({ title: "Dishoom", itemType: "location", mapId: "map-1" });
  });

  it("rejects location pins with no coordinates", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture() as never);
    const res = await request(app).post("/api/maps/abc123/pins/bulk").send({ pins: [{ title: "Nowhere" }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Latitude and longitude are required/);
    expect(mockStorage.upsertPins).not.toHaveBeenCalled();
  });

  it.each(["link", "recommendation"] as const)(
    "accepts %s items with no coordinates — the regression this route used to fail",
    async (itemType) => {
      // itemType is stamped on *before* validation now. When it was applied
      // after, the schema's geo refinement defaulted to "location" and threw
      // out the whole batch with a coordinates error.
      currentUser = OWNER;
      mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture({ itemType }) as never);
      const res = await request(app)
        .post("/api/maps/abc123/pins/bulk")
        .send({ pins: [{ title: "An item", url: "https://example.com", note: "why" }] });

      expect(res.status).toBe(201);
      const [, pins] = mockStorage.upsertPins.mock.calls[0];
      expect(pins[0]).toMatchObject({ title: "An item", itemType, url: "https://example.com" });
    },
  );

  it("forces each pin's itemType to the collection's, ignoring what the client sends", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture({ itemType: "recommendation" }) as never);
    const res = await request(app)
      .post("/api/maps/abc123/pins/bulk")
      .send({ pins: [{ title: "Sneaky", itemType: "location" }] });

    expect(res.status).toBe(201);
    const [, pins] = mockStorage.upsertPins.mock.calls[0];
    expect(pins[0].itemType).toBe("recommendation");
  });

  it("never trusts a client-supplied userId or mapId", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture({ itemType: "recommendation" }) as never);
    await request(app)
      .post("/api/maps/abc123/pins/bulk")
      .send({ pins: [{ title: "X", userId: "someone-else", mapId: "another-map" }] });

    const [, pins] = mockStorage.upsertPins.mock.calls[0];
    expect(pins[0].userId).toBe(OWNER.id);
    expect(pins[0].mapId).toBe("map-1");
  });

  it("auto-approves the owner's own pins", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(
      mapFixture({ itemType: "recommendation", requirePinApproval: true }) as never,
    );
    await request(app).post("/api/maps/abc123/pins/bulk").send({ pins: [{ title: "X" }] });

    const [, pins] = mockStorage.upsertPins.mock.calls[0];
    expect(pins[0].approved).toBe(true);
  });

  it("marks a non-owner's pins pending when the collection requires approval", async () => {
    currentUser = OTHER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(
      mapFixture({ itemType: "recommendation", requirePinApproval: true }) as never,
    );
    await request(app).post("/api/maps/abc123/pins/bulk").send({ pins: [{ title: "X" }] });

    const [, pins] = mockStorage.upsertPins.mock.calls[0];
    expect(pins[0].approved).toBe(false);
  });

  it("passes the owner's remaining pin headroom to upsertPins", async () => {
    currentUser = OWNER;
    // A basic-tier owner caps at 200 pins per map; 3 already exist.
    mockStorage.getUserProfile.mockResolvedValue({ id: OWNER.id, userGroup: "basic" } as never);
    mockStorage.getPinsByMapId.mockResolvedValue([{}, {}, {}] as never);
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture({ itemType: "recommendation" }) as never);

    await request(app).post("/api/maps/abc123/pins/bulk").send({ pins: [{ title: "X" }] });

    const [, , options] = mockStorage.upsertPins.mock.calls[0];
    expect(options).toEqual({ maxNewPins: 197 });
  });

  it("404s a private collection the caller can't reach", async () => {
    currentUser = OTHER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture({ isPublic: false }) as never);
    mockStorage.getUserMapAccess.mockResolvedValue(undefined as never);

    const res = await request(app).post("/api/maps/abc123/pins/bulk").send({ pins: [{ title: "X" }] });
    expect(res.status).toBe(404);
    expect(mockStorage.upsertPins).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture() as never);
    const res = await request(app).post("/api/maps/abc123/pins/bulk").send({ pins: "not an array" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/link-preview", () => {
  it("returns the fetched preview", async () => {
    mockFetchPreview.mockResolvedValue({
      title: "A page",
      description: "About it",
      imageUrl: "https://example.com/i.png",
    });
    const res = await request(app).post("/api/link-preview").send({ url: "https://example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "A page" });
  });

  it("surfaces a guard rejection as a 4xx with its message, not a 500", async () => {
    mockFetchPreview.mockImplementation(() => {
      throw new LinkPreviewError("That URL points to a private address.");
    });
    const res = await request(app).post("/api/link-preview").send({ url: "http://169.254.169.254/" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.message).toMatch(/private address/);
  });

  it("rejects a request with no url", async () => {
    const res = await request(app).post("/api/link-preview").send({});
    expect(res.status).toBe(400);
    expect(mockFetchPreview).not.toHaveBeenCalled();
  });
});

describe("POST /api/maps/:shareUrl/extract-items", () => {
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  it("401s an anonymous request", async () => {
    const res = await request(app)
      .post("/api/maps/abc123/extract-items")
      .attach("files", onePixelPng, { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("does not spend AI budget when no image is attached", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture() as never);
    const res = await request(app).post("/api/maps/abc123/extract-items").field("prompt", "ramen");
    expect(res.status).toBe(400);
    expect(mockAiUsage).not.toHaveBeenCalled();
  });

  it("rejects a non-image upload", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture() as never);
    const res = await request(app)
      .post("/api/maps/abc123/extract-items")
      .attach("files", Buffer.from("plain text"), { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
    expect(mockAiUsage).not.toHaveBeenCalled();
  });

  it("stops at the daily AI cap with a 429", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture() as never);
    mockAiUsage.mockResolvedValue({ allowed: false, used: 3, limit: 3 } as never);

    const res = await request(app)
      .post("/api/maps/abc123/extract-items")
      .attach("files", onePixelPng, { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/all 3 AI generations/);
  });

  it("is reachable on the legacy from-screenshot path too", async () => {
    currentUser = OWNER;
    mockStorage.getMapCollectionByShareUrl.mockResolvedValue(mapFixture() as never);
    mockAiUsage.mockResolvedValue({ allowed: false, used: 3, limit: 3 } as never);

    const res = await request(app)
      .post("/api/maps/abc123/venue-suggestions/from-screenshot")
      .attach("file", onePixelPng, { filename: "a.png", contentType: "image/png" });

    // 429 rather than 404 proves the alias resolves to the same handler.
    expect(res.status).toBe(429);
  });
});
