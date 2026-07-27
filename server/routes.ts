import type { Express } from "express";
import { storage } from "./storage.js";
import {
  bulkInsertPinsSchema,
  curateMapSchema,
  insertMapCollectionSchema,
  insertPinSchema,
  updateMapDetailsSchema,
  updateProfileSchema,
  USERNAME_PATTERN,
} from "../shared/schema.js";
import type { MapCollection, Pin, PublicProfile, User } from "../shared/schema.js";
import { z } from "zod";
import { nanoid } from "nanoid";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { setupAuth, isAuthenticated, getCurrentUser } from "./clerkAuth.js";
import { getUserByUsername } from "./services/users.js";
import { USER_GROUP } from "../shared/enums.js";
import { TIER_LIMITS } from "../shared/limits.js";
import { stripe, STRIPE_PRICE_IDS } from "./lib/stripe.js";
import { checkAndIncrementAiUsage, getAiUsageToday } from "./services/aiUsage.js";
import { sensitiveWriteRateLimiter } from "./lib/security.js";
import { APP_NAME, CURATED_MAPS_SYSTEM_USERNAME } from "./lib/branding.js";

// SVG deliberately excluded: it's an XML format that can carry <script>,
// and this app has no server-side SVG sanitizer — an uploaded SVG would be
// served back byte-for-byte at /api/uploads/:fileId (unauthenticated, so
// anyone can open it directly) and execute in this origin as a stored XSS.
const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
// Anthropic's vision API only accepts these four raster formats (no SVG).
const ALLOWED_SCREENSHOT_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
const VENUE_SUGGESTIONS_MODEL = "claude-haiku-4-5-20251001";
const VENUE_SUGGESTIONS_SYSTEM_PROMPT =
  "You suggest real, specific, well-known venues or places for a collaborative map-pinning app. " +
  "Given the user's theme, respond with ONLY a JSON array of up to 15 strings — no explanation, no markdown fences. " +
  "Each string must be a real place specific enough to find on Google Maps; include the city or neighborhood in " +
  "the name if it helps disambiguate (e.g. \"Ichiran Ramen Shibuya\" rather than just \"Ichiran\").";
const VENUE_SCREENSHOT_SYSTEM_PROMPT =
  "You extract real, specific, well-known venues or places mentioned or shown in an image for a collaborative " +
  "map-pinning app. The image may be a screenshot of a text conversation, a social media post, a list, or a photo " +
  "with visible signage — find every distinct venue or place name in it. Respond with ONLY a JSON array of up to 15 " +
  "strings — no explanation, no markdown fences. Each string must be a real place specific enough to find on Google " +
  "Maps; include the city or neighborhood in the name if it helps disambiguate (e.g. \"Ichiran Ramen Shibuya\" rather " +
  "than just \"Ichiran\"). If the image contains no identifiable venues or places, respond with an empty JSON array.";

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_LOGO_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type — please upload a PNG, JPEG, WebP, or GIF image."));
      return;
    }
    cb(null, true);
  },
});

const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB — leaves headroom under Anthropic's ~5MB base64 image limit
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_SCREENSHOT_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type — please upload a PNG, JPEG, WebP, or GIF image."));
      return;
    }
    cb(null, true);
  },
});

/**
 * The pins-per-map cap is the *map owner's* limit, not whoever happens to be
 * adding a pin (an anonymous visitor or a different contributor) — it's the
 * owner's plan that determines how much their map can hold. Defaults to the
 * freemium limit for the rare case of an orphaned map with no owner.
 */
async function getMapOwnerMaxPins(mapCollection: MapCollection): Promise<number> {
  const owner = mapCollection.ownerId ? await storage.getUserProfile(mapCollection.ownerId) : undefined;
  return TIER_LIMITS[owner?.userGroup ?? "freemium"].maxPinsPerMap;
}

/**
 * Whether a map's owner is currently on a tier that includes custom public
 * branding — checked at *display* time (not just when the logo was set) so
 * a downgrade takes the perk away immediately even though brandingLogoUrl
 * is still sitting in the row.
 */
async function getMapOwnerHasCustomBranding(mapCollection: MapCollection): Promise<boolean> {
  const owner = mapCollection.ownerId ? await storage.getUserProfile(mapCollection.ownerId) : undefined;
  return TIER_LIMITS[owner?.userGroup ?? "freemium"].customBranding;
}

/** Display name for the map's owner — used on the share-image card. Null for an orphaned map. */
async function getMapOwnerName(mapCollection: MapCollection): Promise<string | null> {
  const owner = mapCollection.ownerId ? await storage.getUserProfile(mapCollection.ownerId) : undefined;
  return owner?.fullName || [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") || null;
}

/**
 * Whether a map's owner is currently on a tier that includes custom pin
 * colors/icons — checked at *display* time, same reasoning as custom
 * branding above, so a downgrade takes the perk away immediately.
 */
async function getMapOwnerHasPinCustomization(mapCollection: MapCollection): Promise<boolean> {
  const owner = mapCollection.ownerId ? await storage.getUserProfile(mapCollection.ownerId) : undefined;
  return TIER_LIMITS[owner?.userGroup ?? "freemium"].pinCustomization;
}

/**
 * A "seat" on a map is an accepted collaborator (map_viewers row) or an
 * invitation still pending — pending invites count too so the cap can't be
 * dodged by sending a pile of invites that never get revoked. Gated on the
 * MAP OWNER's tier, same pattern as pins/branding above.
 */
async function getMapSeatUsage(mapCollection: MapCollection): Promise<{ used: number; limit: number }> {
  const owner = mapCollection.ownerId ? await storage.getUserProfile(mapCollection.ownerId) : undefined;
  const limit = TIER_LIMITS[owner?.userGroup ?? "freemium"].maxCollaboratorsPerMap;
  const [viewers, invitations] = await Promise.all([
    storage.getMapViewers(mapCollection.id),
    storage.getMapInvitations(mapCollection.id),
  ]);
  const pendingInvites = invitations.filter((invitation) => invitation.status === "pending").length;
  return { used: viewers.length + pendingInvites, limit };
}

/**
 * A pin may be modified by the owner of its map, by the user who created
 * it, or — for a pin that was created anonymously on a map whose default
 * permission is "editable" — by anyone, preserving the "share the link,
 * anyone can contribute" flow for public collaborative maps.
 */
async function isPinModifiable(pin: Pin, user: User | null): Promise<boolean> {
  if (user) {
    const ownedMaps = await storage.getMapCollectionsByUserId(user.id);
    if (ownedMaps.some((m) => m.id === pin.mapId)) return true;
    if (pin.userId === user.id) return true;
  }

  if (pin.userId) return false;

  const map = await storage.getMapCollectionById(pin.mapId);
  return map?.defaultPermission === "editable";
}

/**
 * A non-public map (isPublic: false) is only viewable/contributable by its
 * owner or an invited collaborator (a row in map_viewers) — everyone else,
 * signed in or not, gets treated as if the map doesn't exist. A public map
 * (the default — see the `isPublic ?? true` fallback in storage.ts's
 * createMapCollection) keeps the original "anyone with the link" behavior.
 */
async function canAccessMap(map: MapCollection, user: User | null): Promise<boolean> {
  if (map.isPublic) return true;
  if (!user) return false;
  if (user.id === map.ownerId) return true;
  const access = await storage.getUserMapAccess(user.id, map.id);
  return !!access;
}

export async function registerRoutes(app: Express): Promise<void> {
  setupAuth(app);

  // --- Health & configuration -------------------------------------------------

  app.get("/api/config", (_req, res) => {
    res.json({ googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null });
  });

  app.get("/api/healthcheck", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({
      timestamp: new Date().toISOString(),
      endpoints: {
        overall: `${baseUrl}/api/app-status`,
        directus: `${baseUrl}/api/directus-health`,
        discovery: `${baseUrl}/api/healthcheck`,
      },
      description: "Public health monitoring endpoints for production deployment monitoring",
    });
  });

  app.get("/api/directus-health", async (_req, res) => {
    const directusUrl = process.env.DIRECTUS_URL;
    if (!directusUrl || !process.env.DIRECTUS_SERVICE_TOKEN) {
      return res.status(503).json({
        status: "error",
        errors: ["Missing DIRECTUS_URL or DIRECTUS_SERVICE_TOKEN environment variables"],
      });
    }

    try {
      await storage.getAllMapCollections();
      res.json({ status: "healthy", directusUrl, timestamp: new Date().toISOString() });
    } catch (error: any) {
      res.status(503).json({ status: "error", errors: [error.message] });
    }
  });

  app.get("/api/app-status", async (_req, res) => {
    const errors: string[] = [];
    try {
      await storage.getAllMapCollections();
    } catch (error: any) {
      errors.push(`Directus error: ${error.message}`);
    }

    const status = errors.length > 0 ? "error" : "healthy";
    res.status(errors.length > 0 ? 503 : 200).json({
      timestamp: new Date().toISOString(),
      status,
      uptime: process.uptime(),
      errors,
    });
  });

  // --- Auth & profile ----------------------------------------------------------

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Lightweight usage summary for proactive "X of Y used" nudges (dashboard,
  // header plan badge, AI-suggestions counter) — kept separate from the
  // heavier per-map cap checks (pins, seats), which depend on a specific
  // map's owner rather than the signed-in user.
  app.get("/api/usage", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const limits = TIER_LIMITS[user.userGroup];
      const [ownedMapCount, aiUsage] = await Promise.all([
        storage.getMapCollectionsByUserId(user.id, { archived: false }).then((maps) => maps.length),
        getAiUsageToday(user.id, user.userGroup),
      ]);

      res.json({
        userGroup: user.userGroup,
        maps: { used: ownedMapCount, limit: limits.maxMaps },
        aiSuggestions: { used: aiUsage.used, limit: aiUsage.limit },
      });
    } catch (error) {
      console.error("Error fetching usage summary:", error);
      res.status(500).json({ message: "Failed to fetch usage summary" });
    }
  });

  app.put("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const data = updateProfileSchema.parse(req.body);

      if (data.username && data.username !== user.username) {
        const existing = await getUserByUsername(data.username);
        if (existing && existing.id !== user.id) {
          return res.status(400).json({ message: "That username is already taken" });
        }
      }

      const updated = await storage.updateProfile(user.id, data);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // --- Billing (Stripe) --------------------------------------------------------------

  app.post("/api/billing/checkout", isAuthenticated, async (req, res) => {
    try {
      if (!stripe) {
        return res
          .status(503)
          .json({ message: "Billing isn't configured yet — ask an admin to set STRIPE_SECRET_KEY." });
      }

      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      // A user with an active/trialing subscription already has a live Stripe
      // subscription; starting a fresh Checkout session in that state creates
      // a SECOND concurrent subscription (double billing) rather than
      // switching plans. Send them to the billing portal instead, which
      // handles plan changes and proration against their existing subscription.
      const hasActiveSubscription =
        !!user.stripeSubscriptionId &&
        (user.stripeSubscriptionStatus === "active" || user.stripeSubscriptionStatus === "trialing");
      if (hasActiveSubscription) {
        return res.status(400).json({
          message: "You already have an active plan — use \"Manage billing\" to switch or cancel it.",
        });
      }

      const { tier } = z.object({ tier: z.enum(["basic", "premium"]) }).parse(req.body);
      const priceId = STRIPE_PRICE_IDS[tier];
      if (!priceId) {
        return res.status(503).json({ message: `Pricing for the ${tier} plan isn't configured yet.` });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: user.fullName ?? undefined,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await storage.updateStripeSubscription(user.id, { stripeCustomerId: customerId });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/pricing?checkout=success`,
        cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
        metadata: { userId: user.id, tier },
        subscription_data: { metadata: { userId: user.id, tier } },
      });

      if (!session.url) return res.status(500).json({ message: "Failed to create checkout session" });
      res.json({ url: session.url });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to start checkout" });
    }
  });

  app.post("/api/billing/portal", isAuthenticated, async (req, res) => {
    try {
      if (!stripe) {
        return res
          .status(503)
          .json({ message: "Billing isn't configured yet — ask an admin to set STRIPE_SECRET_KEY." });
      }

      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "You don't have a billing account yet — subscribe to a plan first." });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/pricing`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ message: "Failed to open billing portal" });
    }
  });

  // --- Public profiles --------------------------------------------------------------

  // Live availability check while a user is claiming/changing their username.
  app.get("/api/users/:username/availability", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const username = req.params.username.toLowerCase();
      if (!USERNAME_PATTERN.test(username)) {
        return res.json({ available: false, reason: "invalid" });
      }

      const existing = await getUserByUsername(username);
      const available = !existing || existing.id === user.id;
      res.json({ available });
    } catch (error) {
      console.error("Error checking username availability:", error);
      res.status(500).json({ message: "Failed to check username availability" });
    }
  });

  // Public, unauthenticated: a user's curated public profile — their info
  // plus only the maps they've chosen to show (showOnProfile === true).
  app.get("/api/profile/:username", async (req, res) => {
    try {
      const user = await getUserByUsername(req.params.username);
      if (!user || !user.username) return res.status(404).json({ message: "Profile not found" });

      const viewer = await getCurrentUser(req);

      const hasCustomBranding = TIER_LIMITS[user.userGroup].customBranding;
      const maps = await storage.getPublicMapsByUserId(user.id);
      const mapIds = maps.map((map) => map.id);

      const [followerCount, followingCount, isFollowedByViewer, likeCounts, viewerLikedMapIds] = await Promise.all([
        storage.getFollowerCount(user.id),
        storage.getFollowingCount(user.id),
        viewer && viewer.id !== user.id ? !!(await storage.getFollowRelation(viewer.id, user.id)) : false,
        storage.getMapLikeCounts(mapIds),
        viewer ? storage.getUserLikedMapIds(viewer.id, mapIds) : Promise.resolve(new Set<string>()),
      ]);

      const mapsWithPinCount = await Promise.all(
        maps.map(async (map) => {
          const pins = await storage.getPinsByMapId(map.id);
          const approvedCount = pins.filter((pin) => pin.approved).length;
          return {
            id: map.id,
            name: map.name,
            description: map.description,
            shareUrl: map.shareUrl,
            brandingLogoUrl: hasCustomBranding ? map.brandingLogoUrl : null,
            pinCount: approvedCount,
            likeCount: likeCounts[map.id] ?? 0,
            likedByViewer: viewerLikedMapIds.has(map.id),
            createdAt: map.createdAt,
          };
        }),
      );

      const profile: PublicProfile = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
        twitterHandle: user.twitterHandle,
        instagramHandle: user.instagramHandle,
        linkedinHandle: user.linkedinHandle,
        followerCount,
        followingCount,
        isFollowedByViewer,
        maps: mapsWithPinCount,
      };
      res.json(profile);
    } catch (error) {
      console.error("Error fetching public profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Follow/unfollow another user by username. Self-follows are rejected.
  app.post("/api/users/:username/follow", isAuthenticated, async (req, res) => {
    try {
      const viewer = await getCurrentUser(req);
      if (!viewer) return res.status(401).json({ message: "Unauthorized" });

      const target = await getUserByUsername(req.params.username);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.id === viewer.id) return res.status(400).json({ message: "You can't follow yourself" });

      const existing = await storage.getFollowRelation(viewer.id, target.id);
      if (!existing) await storage.followUser(viewer.id, target.id);

      const followerCount = await storage.getFollowerCount(target.id);
      res.json({ following: true, followerCount });
    } catch (error) {
      console.error("Error following user:", error);
      res.status(500).json({ message: "Failed to follow user" });
    }
  });

  app.delete("/api/users/:username/follow", isAuthenticated, async (req, res) => {
    try {
      const viewer = await getCurrentUser(req);
      if (!viewer) return res.status(401).json({ message: "Unauthorized" });

      const target = await getUserByUsername(req.params.username);
      if (!target) return res.status(404).json({ message: "User not found" });

      await storage.unfollowUser(viewer.id, target.id);

      const followerCount = await storage.getFollowerCount(target.id);
      res.json({ following: false, followerCount });
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ message: "Failed to unfollow user" });
    }
  });

  // Recently added maps from accounts the viewer follows, plus the curated-
  // maps system account — a simple reverse-chronological feed, no ranking
  // logic beyond recency. Only maps the owner has chosen to show on their
  // profile (show_on_profile) are eligible, same visibility rule as the
  // public profile page itself.
  app.get("/api/feed", isAuthenticated, async (req, res) => {
    try {
      const viewer = await getCurrentUser(req);
      if (!viewer) return res.status(401).json({ message: "Unauthorized" });

      const [followingIds, systemAccount] = await Promise.all([
        storage.getFollowingIds(viewer.id),
        getUserByUsername(CURATED_MAPS_SYSTEM_USERNAME),
      ]);
      const ownerIds = Array.from(new Set([...followingIds, ...(systemAccount ? [systemAccount.id] : [])]));

      const maps = await storage.getPublicMapsByOwnerIds(ownerIds);
      const mapIds = maps.map((map) => map.id);
      const [likeCounts, viewerLikedMapIds] = await Promise.all([
        storage.getMapLikeCounts(mapIds),
        storage.getUserLikedMapIds(viewer.id, mapIds),
      ]);

      const items = await Promise.all(
        maps.map(async (map) => {
          const [pins, owner] = await Promise.all([
            storage.getPinsByMapId(map.id),
            map.ownerId ? storage.getUserProfile(map.ownerId) : Promise.resolve(undefined),
          ]);
          const hasCustomBranding = owner ? TIER_LIMITS[owner.userGroup].customBranding : false;
          return {
            id: map.id,
            name: map.name,
            description: map.description,
            shareUrl: map.shareUrl,
            brandingLogoUrl: hasCustomBranding ? map.brandingLogoUrl : null,
            pinCount: pins.filter((pin) => pin.approved).length,
            likeCount: likeCounts[map.id] ?? 0,
            likedByViewer: viewerLikedMapIds.has(map.id),
            ownerId: map.ownerId,
            ownerName: owner?.fullName || [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") || null,
            ownerUsername: owner?.username ?? null,
            ownerAvatarUrl: owner?.profileImageUrl ?? null,
            createdAt: map.createdAt,
          };
        }),
      );

      res.json({ items, followingCount: followingIds.length });
    } catch (error) {
      console.error("Error fetching feed:", error);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  // --- Discover (curated maps) -------------------------------------------------------

  // Public, unauthenticated: this app's editorially curated map collection.
  // Freemium/anonymous visitors get every curated map back (so the page can
  // show what exists as a teaser) but only the top curatedOrder maps
  // (TIER_LIMITS.maxCuratedMapsVisible) come with a shareUrl — the rest are
  // marked `locked: true` with shareUrl omitted, so the UI can't render a
  // working link to them even if it tried. Basic/Premium get everything
  // unlocked. Filter facets (categories/countries/cities) are derived from
  // whatever is actually curated right now, not the full fixed enum, so the
  // UI never offers a filter that dead-ends on zero results.
  app.get("/api/discover", async (req, res) => {
    try {
      const allCurated = await storage.getCuratedMapCollections();

      const categories = Array.from(new Set(allCurated.map((m) => m.curatedCategory).filter((v): v is NonNullable<typeof v> => !!v))).sort();
      const countries = Array.from(new Set(allCurated.map((m) => m.curatedCountry).filter((v): v is NonNullable<typeof v> => !!v))).sort();
      const citiesByCountry: Record<string, string[]> = {};
      for (const map of allCurated) {
        if (!map.curatedCountry || !map.curatedCity) continue;
        const existing = citiesByCountry[map.curatedCountry] ?? [];
        if (!existing.includes(map.curatedCity)) existing.push(map.curatedCity);
        citiesByCountry[map.curatedCountry] = existing;
      }
      for (const country of Object.keys(citiesByCountry)) citiesByCountry[country].sort();

      const { category, country, city } = req.query;
      const filtered = allCurated.filter((map) => {
        if (typeof category === "string" && map.curatedCategory !== category) return false;
        if (typeof country === "string" && map.curatedCountry !== country) return false;
        if (typeof city === "string" && map.curatedCity !== city) return false;
        return true;
      });

      const user = await getCurrentUser(req);
      const maxVisible = TIER_LIMITS[user?.userGroup ?? "freemium"].maxCuratedMapsVisible;

      const maps = await Promise.all(
        filtered.map(async (map, index) => {
          const locked = Number.isFinite(maxVisible) && index >= maxVisible;
          const [pins, ownerName] = await Promise.all([storage.getPinsByMapId(map.id), getMapOwnerName(map)]);
          return {
            id: map.id,
            name: map.name,
            shareUrl: locked ? null : map.shareUrl,
            locked,
            curatedCategory: map.curatedCategory,
            curatedCountry: map.curatedCountry,
            curatedCity: map.curatedCity,
            curatedTagline: map.curatedTagline,
            ownerName,
            pinCount: pins.filter((pin) => pin.approved).length,
            createdAt: map.createdAt,
          };
        }),
      );
      const visibleCount = maps.filter((m) => !m.locked).length;

      res.json({
        maps,
        totalCount: filtered.length,
        visibleCount,
        maxVisible,
        isLimited: filtered.length > visibleCount,
        filters: { categories, countries, citiesByCountry },
      });
    } catch (error) {
      console.error("Error fetching discover maps:", error);
      res.status(500).json({ message: "Failed to fetch curated maps" });
    }
  });

  // --- Uploads --------------------------------------------------------------------
  // Map branding logos. Uploaded files live in Directus under a per-user
  // subfolder (map-logos/<userId>/), but the browser never talks to Directus
  // directly — it only ever sees our own /api/uploads/:fileId URL, which we
  // proxy server-side using the service token.

  app.post("/api/uploads/logo", isAuthenticated, (req, res, next) => {
    logoUpload.single("file")(req, res, (error: unknown) => {
      if (error) return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid upload" });
      next();
    });
  }, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const fileId = await storage.uploadUserLogo(user.id, req.file);
      res.status(201).json({ url: `/api/uploads/${fileId}` });
    } catch (error: any) {
      console.error("Logo upload error:", error);
      res.status(400).json({ message: error.message || "Failed to upload logo" });
    }
  });

  app.get("/api/uploads/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const directusUrl = process.env.DIRECTUS_URL;
      const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;

      const assetResponse = await fetch(`${directusUrl}/assets/${encodeURIComponent(fileId)}`, {
        headers: { Authorization: `Bearer ${serviceToken}` },
      });
      if (!assetResponse.ok) return res.status(assetResponse.status === 404 ? 404 : 502).end();

      res.setHeader("Content-Type", assetResponse.headers.get("content-type") || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      // Defense-in-depth: even though the upload allow-list already excludes
      // SVG (the one image type that can carry <script>), this blocks any
      // script from executing if a file here is ever opened as a top-level
      // navigation — belt-and-suspenders in case the allow-list is loosened later.
      res.setHeader("Content-Security-Policy", "script-src 'none'; sandbox");
      res.send(Buffer.from(await assetResponse.arrayBuffer()));
    } catch (error) {
      console.error("Error fetching uploaded asset:", error);
      res.status(500).json({ message: "Failed to fetch asset" });
    }
  });

  // --- Maps ---------------------------------------------------------------------

  app.get("/api/maps", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.json([]);

      const ownedOnly = req.query.ownedOnly === "true";
      const contributedOnly = req.query.contributedOnly === "true";
      const archivedOnly = req.query.archivedOnly === "true";

      let maps;
      if (archivedOnly) {
        maps = TIER_LIMITS[user.userGroup].mapArchiving
          ? await storage.getMapCollectionsByUserId(user.id, { archived: true })
          : [];
      } else if (ownedOnly) {
        maps = await storage.getMapCollectionsByUserId(user.id, { archived: false });
      } else if (contributedOnly) {
        maps = await storage.getContributedMaps(user.id);
      } else {
        maps = await storage.getMapCollectionsForUser(user.id);
      }

      const mapsWithPinCount = await Promise.all(
        maps.map(async (map) => {
          const pins = await storage.getPinsByMapId(map.id);
          const visibleCount = map.ownerId === user.id ? pins.length : pins.filter((pin) => pin.approved).length;
          return { ...map, pinCount: visibleCount };
        }),
      );
      res.json(mapsWithPinCount);
    } catch (error: any) {
      console.error("Error fetching map collections:", error);
      res.status(500).json({ message: "Failed to fetch map collections", error: error.message });
    }
  });

  app.post("/api/maps", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const maxMaps = TIER_LIMITS[user.userGroup].maxMaps;
      const ownedMapCount = (await storage.getMapCollectionsByUserId(user.id, { archived: false })).length;
      if (ownedMapCount >= maxMaps) {
        return res.status(403).json({
          message: `You've reached the ${maxMaps}-map limit for the ${user.userGroup} plan. Upgrade at /pricing for more.`,
        });
      }

      const data = insertMapCollectionSchema.parse({ ...req.body, ownerId: user.id });

      if (data.brandingLogoUrl && !TIER_LIMITS[user.userGroup].customBranding) {
        return res.status(403).json({
          message: `Custom branding isn't available on the ${user.userGroup} plan. Upgrade at /pricing to add your own logo.`,
        });
      }

      if ((data.defaultPinColor || data.defaultPinIcon) && !TIER_LIMITS[user.userGroup].pinCustomization) {
        return res.status(403).json({
          message: `Custom pin colors and icons aren't available on the ${user.userGroup} plan. Upgrade at /pricing to use them.`,
        });
      }

      const existingMap = await storage.getMapCollectionByName(data.name);
      if (existingMap) {
        return res.status(400).json({ message: "A map collection with this name already exists" });
      }

      const mapCollection = await storage.createMapCollection(data);
      res.status(201).json(mapCollection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        console.error("Error creating map collection:", error);
        res.status(500).json({ message: "Failed to create map collection" });
      }
    }
  });

  app.put("/api/maps/:mapId/permissions", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { mapId } = req.params;
      const { isPublic, defaultPermission } = req.body;

      if (!["readonly", "editable"].includes(defaultPermission)) {
        return res.status(400).json({ message: "Invalid permission type" });
      }

      const map = await storage.getMapCollectionById(mapId);
      if (!map) return res.status(404).json({ message: "Map not found" });
      if (map.ownerId !== user.id) {
        return res.status(403).json({ message: "You don't have permission to edit this map" });
      }

      const updatedMap = await storage.updateMapPermissions(mapId, isPublic, defaultPermission);
      if (!updatedMap) return res.status(404).json({ message: "Map not found" });

      res.json(updatedMap);
    } catch (error) {
      console.error("Error updating map permissions:", error);
      res.status(500).json({ message: "Failed to update map permissions" });
    }
  });

  app.put("/api/maps/:mapId/details", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { mapId } = req.params;
      const map = await storage.getMapCollectionById(mapId);
      if (!map) return res.status(404).json({ message: "Map not found" });
      if (map.ownerId !== user.id) {
        return res.status(403).json({ message: "You don't have permission to edit this map" });
      }

      const data = updateMapDetailsSchema.parse(req.body);

      if (data.brandingLogoUrl && !TIER_LIMITS[user.userGroup].customBranding) {
        return res.status(403).json({
          message: `Custom branding isn't available on the ${user.userGroup} plan. Upgrade at /pricing to add your own logo.`,
        });
      }

      if ((data.defaultPinColor || data.defaultPinIcon) && !TIER_LIMITS[user.userGroup].pinCustomization) {
        return res.status(403).json({
          message: `Custom pin colors and icons aren't available on the ${user.userGroup} plan. Upgrade at /pricing to use them.`,
        });
      }

      if (data.name && data.name !== map.name) {
        const existingMap = await storage.getMapCollectionByName(data.name);
        if (existingMap && existingMap.id !== mapId) {
          return res.status(400).json({ message: "A map collection with this name already exists" });
        }
      }

      const updatedMap = await storage.updateMapDetails(mapId, data);
      if (!updatedMap) return res.status(404).json({ message: "Map not found" });

      res.json(updatedMap);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        console.error("Error updating map details:", error);
        res.status(500).json({ message: "Failed to update map details" });
      }
    }
  });

  app.delete("/api/maps/:mapId", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { mapId } = req.params;
      const deleted = await storage.deleteMapCollection(mapId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: "Map not found or you don't have permission to delete it" });
      }

      res.json({ message: "Map deleted successfully" });
    } catch (error) {
      console.error("Error deleting map:", error);
      res.status(500).json({ message: "Failed to delete map" });
    }
  });

  // Archiving (Basic/Premium only) soft-hides maps from the home page and
  // public profile without touching the map or its pins — an alternative to
  // DELETE /api/maps/:mapId's permanent removal. Bulk by design: the client
  // multi-selects maps to archive/restore together.
  app.post("/api/maps/archive", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      if (!TIER_LIMITS[user.userGroup].mapArchiving) {
        return res.status(403).json({
          message: `Archiving maps isn't available on the ${user.userGroup} plan. Upgrade at /pricing to use it.`,
        });
      }

      const parsed = z.array(z.string()).min(1).max(100).safeParse(req.body?.mapIds);
      if (!parsed.success) return res.status(400).json({ message: "mapIds must be a non-empty array of map ids" });

      const archivedIds = await storage.setMapsArchived(parsed.data, user.id, true);
      res.json({ archivedCount: archivedIds.length, archivedIds });
    } catch (error) {
      console.error("Error archiving maps:", error);
      res.status(500).json({ message: "Failed to archive maps" });
    }
  });

  app.post("/api/maps/unarchive", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      if (!TIER_LIMITS[user.userGroup].mapArchiving) {
        return res.status(403).json({
          message: `Archiving maps isn't available on the ${user.userGroup} plan. Upgrade at /pricing to use it.`,
        });
      }

      const parsed = z.array(z.string()).min(1).max(100).safeParse(req.body?.mapIds);
      if (!parsed.success) return res.status(400).json({ message: "mapIds must be a non-empty array of map ids" });

      // Restoring puts a map back against the maxMaps quota, so — same
      // pattern as bulk pin import — restore as many of the requested maps
      // as fit and report the rest as skipped, rather than rejecting the
      // whole batch outright.
      const maxMaps = TIER_LIMITS[user.userGroup].maxMaps;
      const [activeMaps, archivedOwnedMaps] = await Promise.all([
        storage.getMapCollectionsByUserId(user.id, { archived: false }),
        storage.getMapCollectionsByUserId(user.id, { archived: true }),
      ]);
      const requestedIds = new Set(parsed.data);
      const requestedArchived = archivedOwnedMaps.filter((map) => requestedIds.has(map.id));

      const roomLeft = Math.max(0, maxMaps - activeMaps.length);
      const idsToRestore = requestedArchived.slice(0, roomLeft).map((map) => map.id);
      const skippedDueToLimit = requestedArchived.length - idsToRestore.length;

      const restoredIds = idsToRestore.length > 0 ? await storage.setMapsArchived(idsToRestore, user.id, false) : [];
      res.json({ restoredCount: restoredIds.length, restoredIds, skippedDueToLimit });
    } catch (error) {
      console.error("Error restoring maps:", error);
      res.status(500).json({ message: "Failed to restore maps" });
    }
  });

  // --- Invitations ----------------------------------------------------------------

  app.post("/api/maps/:mapId/invitations", sensitiveWriteRateLimiter, isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { mapId } = req.params;
      const ownedMaps = await storage.getMapCollectionsByUserId(user.id);
      const mapCollection = ownedMaps.find((m) => m.id === mapId);
      if (!mapCollection) {
        return res.status(403).json({ message: "Only the map owner can invite people" });
      }

      const { email, permission } = req.body;
      if (!email || !permission) {
        return res.status(400).json({ message: "Email and permission are required" });
      }
      if (!["readonly", "editable"].includes(permission)) {
        return res.status(400).json({ message: "Invalid permission type" });
      }

      const { used, limit } = await getMapSeatUsage(mapCollection);
      if (used >= limit) {
        return res.status(403).json({
          message: `You've reached the ${limit}-collaborator limit for this map on the ${user.userGroup} plan. Upgrade at /pricing for more seats.`,
        });
      }

      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Email delivery is handled by a Directus Flow (see
      // directus/src/flows/), triggered on this row's creation — not sent
      // from here, since the app server can't reach the SMTP relay this
      // Directus instance sends through (see the flow's own doc comment).
      const invitation = await storage.createInvitation({
        mapId,
        email,
        permission,
        invitedBy: user.id,
        token,
        expiresAt,
      });

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/maps/:mapId/invitations", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { mapId } = req.params;
      const ownedMaps = await storage.getMapCollectionsByUserId(user.id);
      const mapCollection = ownedMaps.find((m) => m.id === mapId);
      if (!mapCollection) {
        return res.status(403).json({ message: "Only the map owner can view invitations" });
      }

      const [invitations, seats] = await Promise.all([
        storage.getMapInvitations(mapId),
        getMapSeatUsage(mapCollection),
      ]);
      res.json({ invitations, seatsUsed: seats.used, seatLimit: seats.limit });
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Public preview — lets the accept-invitation page show what the invite is
  // for (map name, inviter, role) before the recipient signs in, without
  // requiring auth just to look.
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found or expired" });

      const [mapCollection, inviter] = await Promise.all([
        storage.getMapCollectionById(invitation.mapId),
        storage.getUserProfile(invitation.invitedBy),
      ]);

      res.json({
        status: invitation.status,
        permission: invitation.permission,
        expiresAt: invitation.expiresAt,
        expired: new Date() > invitation.expiresAt,
        mapName: mapCollection?.name ?? "a map",
        mapShareUrl: mapCollection?.shareUrl,
        inviterName: inviter?.fullName || inviter?.email || "Someone",
      });
    } catch (error) {
      console.error("Error fetching invitation preview:", error);
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });

  app.post("/api/invitations/:token/accept", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { token } = req.params;
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found or expired" });
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation has already been processed" });
      }
      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      await storage.updateInvitationStatus(invitation.id, "accepted");

      const existingAccess = await storage.getUserMapAccess(user.id, invitation.mapId);
      if (!existingAccess) {
        await storage.addMapViewer({
          mapId: invitation.mapId,
          userId: user.id,
          role: invitation.permission === "editable" ? "contributor" : "viewer",
          permission: invitation.permission,
        });
      }

      const mapCollection = await storage.getMapCollectionById(invitation.mapId);
      res.json({ message: "Invitation accepted successfully", mapShareUrl: mapCollection?.shareUrl });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  app.delete("/api/invitations/:id", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { id } = req.params;
      const deleted = await storage.deleteInvitation(id);
      if (!deleted) return res.status(404).json({ message: "Invitation not found" });

      res.json({ message: "Invitation deleted successfully" });
    } catch (error) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });

  // --- Public map view + pins -----------------------------------------------------

  app.get("/api/maps/:shareUrl", async (req, res) => {
    try {
      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      if (!mapCollection) return res.status(404).json({ message: "Map collection not found" });

      const user = await getCurrentUser(req);
      if (!(await canAccessMap(mapCollection, user))) {
        return res.status(404).json({ message: "Map collection not found" });
      }
      const isOwner = !!user && user.id === mapCollection.ownerId;

      const allPins = await storage.getPinsByMapId(mapCollection.id);
      const pins = isOwner ? allPins : allPins.filter((pin) => pin.approved);

      const [hasCustomBranding, hasPinCustomization, maxPins, ownerName, likeCounts] = await Promise.all([
        getMapOwnerHasCustomBranding(mapCollection),
        getMapOwnerHasPinCustomization(mapCollection),
        getMapOwnerMaxPins(mapCollection),
        getMapOwnerName(mapCollection),
        storage.getMapLikeCounts([mapCollection.id]),
      ]);
      const brandingLogoUrl = hasCustomBranding ? mapCollection.brandingLogoUrl : null;
      // Same reasoning as brandingLogoUrl above: a downgraded owner's
      // previously-set colors/icons stop rendering immediately, not just
      // block new writes.
      const defaultPinColor = hasPinCustomization ? mapCollection.defaultPinColor : null;
      const defaultPinIcon = hasPinCustomization ? mapCollection.defaultPinIcon : null;
      const styledPins = hasPinCustomization ? pins : pins.map((pin) => ({ ...pin, pinColor: null, pinIcon: null }));
      const likedByViewer = user ? (await storage.getUserLikedMapIds(user.id, [mapCollection.id])).has(mapCollection.id) : false;

      res.json({
        ...mapCollection,
        brandingLogoUrl,
        defaultPinColor,
        defaultPinIcon,
        hasPinCustomization,
        ownerName,
        pins: styledPins,
        pinCount: pins.length,
        maxPins,
        likeCount: likeCounts[mapCollection.id] ?? 0,
        likedByViewer,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch map collection" });
    }
  });

  app.post("/api/maps/:mapId/like", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { mapId } = req.params;
      const mapCollection = await storage.getMapCollectionById(mapId);
      if (!mapCollection) return res.status(404).json({ message: "Map collection not found" });

      const existing = await storage.getUserLikedMapIds(user.id, [mapId]);
      if (!existing.has(mapId)) await storage.likeMap(user.id, mapId);

      const likeCounts = await storage.getMapLikeCounts([mapId]);
      res.json({ liked: true, likeCount: likeCounts[mapId] ?? 0 });
    } catch (error) {
      console.error("Error liking map:", error);
      res.status(500).json({ message: "Failed to like map" });
    }
  });

  app.delete("/api/maps/:mapId/like", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { mapId } = req.params;
      await storage.unlikeMap(user.id, mapId);

      const likeCounts = await storage.getMapLikeCounts([mapId]);
      res.json({ liked: false, likeCount: likeCounts[mapId] ?? 0 });
    } catch (error) {
      console.error("Error unliking map:", error);
      res.status(500).json({ message: "Failed to unlike map" });
    }
  });

  app.post("/api/maps/:shareUrl/pins", sensitiveWriteRateLimiter, async (req, res) => {
    try {
      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      if (!mapCollection) return res.status(404).json({ message: "Map collection not found" });

      const user = await getCurrentUser(req);
      if (!(await canAccessMap(mapCollection, user))) {
        return res.status(404).json({ message: "Map collection not found" });
      }

      const maxPins = await getMapOwnerMaxPins(mapCollection);
      const currentPinCount = (await storage.getPinsByMapId(mapCollection.id)).length;
      if (currentPinCount >= maxPins) {
        return res.status(403).json({
          message: `This map has reached its ${maxPins}-pin limit. Ask the owner to upgrade at /pricing for more room.`,
        });
      }

      const isOwner = !!user && user.id === mapCollection.ownerId;
      const data = insertPinSchema.parse({
        ...req.body,
        mapId: mapCollection.id,
        userId: user?.id ?? null, // never trust a client-supplied userId
        approved: isOwner, // pins from anyone but the owner need the owner's approval first
      });

      if ((data.pinColor || data.pinIcon) && !(await getMapOwnerHasPinCustomization(mapCollection))) {
        return res.status(403).json({
          message: "Custom pin colors and icons aren't available on this map's plan. Ask the owner to upgrade at /pricing to use them.",
        });
      }

      const pin = await storage.createPin(data);
      res.status(201).json(pin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`);
        res.status(400).json({ message: `Validation failed: ${errorMessages.join(", ")}`, errors: error.errors });
      } else {
        console.error("Pin creation error:", error);
        res.status(500).json({ message: "Failed to create pin" });
      }
    }
  });

  // Bulk import (e.g. from a venue-name list) — requires an account so a
  // batch of pins is always attributable, unlike the single anonymous-friendly
  // add-pin flow above.
  app.post("/api/maps/:shareUrl/pins/bulk", isAuthenticated, async (req, res) => {
    try {
      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      if (!mapCollection) return res.status(404).json({ message: "Map collection not found" });

      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      if (!(await canAccessMap(mapCollection, user))) {
        return res.status(404).json({ message: "Map collection not found" });
      }
      const isOwner = user.id === mapCollection.ownerId;

      // Unlike the single-pin route below, a bulk request can be entirely
      // updates to already-existing pins (matched by name), which never
      // count against the cap — so there's no blanket "already full" reject
      // here. maxNewPins alone (clamped to >= 0 in upsertPins) correctly
      // limits how many *new* pins the batch can create.
      const maxPins = await getMapOwnerMaxPins(mapCollection);
      const currentPinCount = (await storage.getPinsByMapId(mapCollection.id)).length;

      const { pins } = bulkInsertPinsSchema.parse(req.body);
      const data = pins.map((pin) => ({ ...pin, mapId: mapCollection.id, userId: user.id, approved: isOwner }));

      const result = await storage.upsertPins(mapCollection.id, data, { maxNewPins: maxPins - currentPinCount });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`);
        res.status(400).json({ message: `Validation failed: ${errorMessages.join(", ")}`, errors: error.errors });
      } else {
        console.error("Bulk pin creation error:", error);
        res.status(500).json({ message: "Failed to import pins" });
      }
    }
  });

  // AI-assisted import: turns a free-text theme ("best ramen spots in
  // Tokyo") into up to 15 candidate venue names, which the client then runs
  // through the exact same search/review/import pipeline as a pasted list.
  app.post("/api/maps/:shareUrl/venue-suggestions", isAuthenticated, async (req, res) => {
    try {
      if (!anthropic) {
        return res.status(503).json({ message: "AI suggestions aren't configured yet — ask an admin to set ANTHROPIC_API_KEY." });
      }

      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      if (!mapCollection) return res.status(404).json({ message: "Map collection not found" });

      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (!prompt) return res.status(400).json({ message: "Describe what kind of places you're looking for" });
      if (prompt.length > 300) return res.status(400).json({ message: "Prompt is too long (max 300 characters)" });

      const usage = await checkAndIncrementAiUsage(user.id, user.userGroup);
      if (!usage.allowed) {
        return res.status(429).json({
          message: `You've used all ${usage.limit} AI suggestion generations for today. Upgrade at /pricing for more, or try again tomorrow.`,
          limit: usage.limit,
          used: usage.used,
        });
      }

      const message = await anthropic.messages.create({
        model: VENUE_SUGGESTIONS_MODEL,
        max_tokens: 1024,
        system: VENUE_SUGGESTIONS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = message.content.find((block) => block.type === "text");
      const raw = textBlock?.type === "text" ? textBlock.text : "";

      let suggestions: string[] = [];
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        if (Array.isArray(parsed)) {
          suggestions = parsed
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim());
        }
      } catch {
        // suggestions stays empty; handled below
      }

      if (suggestions.length === 0) {
        return res.status(502).json({ message: "Couldn't generate suggestions — try rephrasing your prompt." });
      }

      res.json({ suggestions: suggestions.slice(0, 15), usage: { used: usage.used, limit: usage.limit } });
    } catch (error) {
      console.error("Venue suggestion error:", error);
      res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  app.post(
    "/api/maps/:shareUrl/venue-suggestions/from-screenshot",
    isAuthenticated,
    (req, res, next) => {
      screenshotUpload.single("file")(req, res, (error: unknown) => {
        if (error) return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid upload" });
        next();
      });
    },
    async (req, res) => {
      try {
        if (!anthropic) {
          return res.status(503).json({ message: "AI suggestions aren't configured yet — ask an admin to set ANTHROPIC_API_KEY." });
        }

        const user = await getCurrentUser(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        if (!TIER_LIMITS[user.userGroup].screenshotImport) {
          return res.status(403).json({
            message: `Screenshot-based AI import isn't available on the ${user.userGroup} plan. Upgrade at /pricing to use it.`,
          });
        }

        const { shareUrl } = req.params;
        const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
        if (!mapCollection) return res.status(404).json({ message: "Map collection not found" });

        if (!req.file) return res.status(400).json({ message: "No screenshot uploaded" });

        const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
        if (prompt.length > 300) return res.status(400).json({ message: "Prompt is too long (max 300 characters)" });

        const usage = await checkAndIncrementAiUsage(user.id, user.userGroup);
        if (!usage.allowed) {
          return res.status(429).json({
            message: `You've used all ${usage.limit} AI suggestion generations for today. Upgrade at /pricing for more, or try again tomorrow.`,
            limit: usage.limit,
            used: usage.used,
          });
        }

        await storage.uploadVenueScreenshot(user.id, req.file);

        const message = await anthropic.messages.create({
          model: VENUE_SUGGESTIONS_MODEL,
          max_tokens: 1024,
          system: VENUE_SCREENSHOT_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: req.file.mimetype as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
                    data: req.file.buffer.toString("base64"),
                  },
                },
                {
                  type: "text",
                  text: prompt || "Find every venue or place mentioned or shown in this image.",
                },
              ],
            },
          ],
        });

        const textBlock = message.content.find((block) => block.type === "text");
        const raw = textBlock?.type === "text" ? textBlock.text : "";

        let suggestions: string[] = [];
        try {
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
          if (Array.isArray(parsed)) {
            suggestions = parsed
              .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
              .map((item) => item.trim());
          }
        } catch {
          // suggestions stays empty; handled below
        }

        if (suggestions.length === 0) {
          return res.status(502).json({ message: "Couldn't find any venues in that screenshot — try a clearer image." });
        }

        res.json({ suggestions: suggestions.slice(0, 15), usage: { used: usage.used, limit: usage.limit } });
      } catch (error) {
        console.error("Screenshot venue suggestion error:", error);
        res.status(500).json({ message: "Failed to generate suggestions from screenshot" });
      }
    },
  );

  app.get("/api/pins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const pin = await storage.getPinById(id);
      if (!pin) return res.status(404).json({ message: "Pin not found" });

      const map = await storage.getMapCollectionById(pin.mapId);
      const user = await getCurrentUser(req);
      if (!map || !(await canAccessMap(map, user))) {
        return res.status(404).json({ message: "Pin not found" });
      }

      res.json(pin);
    } catch (error: any) {
      console.error("Error fetching pin:", error);
      res.status(500).json({ message: "Failed to fetch pin", error: error.message });
    }
  });

  app.put("/api/pins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const pin = await storage.getPinById(id);
      if (!pin) return res.status(404).json({ message: "Pin not found" });

      const user = await getCurrentUser(req);
      const allowed = await isPinModifiable(pin, user);
      if (!allowed) return res.status(403).json({ message: "You don't have permission to edit this pin" });

      // "approved" is only ever set via the dedicated approve endpoint below,
      // gated to the map owner — never accepted through this general-purpose
      // edit route, which a pin's own creator can also use.
      const validatedData = insertPinSchema.partial().omit({ approved: true }).parse(req.body);

      if (validatedData.pinColor || validatedData.pinIcon) {
        const map = await storage.getMapCollectionById(pin.mapId);
        if (!map || !(await getMapOwnerHasPinCustomization(map))) {
          return res.status(403).json({
            message: "Custom pin colors and icons aren't available on this map's plan. Ask the owner to upgrade at /pricing to use them.",
          });
        }
      }

      const updatedPin = await storage.updatePin(id, validatedData);
      if (!updatedPin) return res.status(404).json({ message: "Pin not found" });

      res.json(updatedPin);
    } catch (error: any) {
      console.error("Error updating pin:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update pin", error: error.message });
    }
  });

  app.put("/api/pins/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const pin = await storage.getPinById(id);
      if (!pin) return res.status(404).json({ message: "Pin not found" });

      const user = await getCurrentUser(req);
      const map = await storage.getMapCollectionById(pin.mapId);
      if (!user || map?.ownerId !== user.id) {
        return res.status(403).json({ message: "Only the map owner can approve pins" });
      }

      const updatedPin = await storage.updatePin(id, { approved: true });
      if (!updatedPin) return res.status(404).json({ message: "Pin not found" });

      res.json(updatedPin);
    } catch (error) {
      console.error("Error approving pin:", error);
      res.status(500).json({ message: "Failed to approve pin" });
    }
  });

  app.delete("/api/pins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const pin = await storage.getPinById(id);
      if (!pin) return res.status(404).json({ message: "Pin not found" });

      const user = await getCurrentUser(req);
      const allowed = await isPinModifiable(pin, user);
      if (!allowed) return res.status(403).json({ message: "You don't have permission to delete this pin" });

      const deleted = await storage.deletePin(id);
      if (!deleted) return res.status(404).json({ message: "Pin not found" });

      res.json({ message: "Pin deleted successfully" });
    } catch (error) {
      console.error("Error deleting pin:", error);
      res.status(500).json({ message: "Failed to delete pin" });
    }
  });

  // Bulk delete, for the pin table's multi-select. POST (not a bulk DELETE)
  // so the id list travels as a normal JSON body rather than needing a body
  // on a DELETE request. Reuses isPinModifiable per pin — same authorization
  // as the single-delete route above, just applied to each requested id, so
  // a request can partially succeed (e.g. a mix of your own pins and ones
  // you don't have permission to remove).
  app.post("/api/pins/bulk-delete", async (req, res) => {
    try {
      const parsed = z.array(z.string()).min(1).max(200).safeParse(req.body?.pinIds);
      if (!parsed.success) return res.status(400).json({ message: "pinIds must be a non-empty array of pin ids" });

      const user = await getCurrentUser(req);
      const results = await Promise.all(
        parsed.data.map(async (id) => {
          const pin = await storage.getPinById(id);
          if (!pin) return false;
          if (!(await isPinModifiable(pin, user))) return false;
          return storage.deletePin(id);
        }),
      );

      const deletedCount = results.filter(Boolean).length;
      res.json({ deletedCount, skippedCount: parsed.data.length - deletedCount });
    } catch (error) {
      console.error("Error bulk deleting pins:", error);
      res.status(500).json({ message: "Failed to delete pins" });
    }
  });

  // --- Reverse geocoding (OpenStreetMap Nominatim) ---------------------------------

  app.get("/api/geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) return res.status(400).json({ message: "Latitude and longitude are required" });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": `${APP_NAME} Application` } },
      );
      if (!response.ok) throw new Error("Geocoding service unavailable");

      const data = await response.json();
      if (!data || data.error) return res.status(404).json({ message: "Location not found" });

      const address = data.address || {};
      const addressParts: string[] = [];
      if (address.city) addressParts.push(address.city);
      else if (address.town || address.village) addressParts.push(address.town || address.village);

      if (address.borough || address.suburb) {
        const districtName = address.borough || address.suburb;
        if (!addressParts.includes(districtName)) addressParts.push(districtName);
      }
      if (addressParts.length === 0 && (address.borough || address.suburb)) {
        addressParts.push(address.borough || address.suburb);
      }
      if (address.state || address.region) addressParts.push(address.state || address.region);
      if (address.country) addressParts.push(address.country);

      res.json({
        address: addressParts.join(", ") || `${lat}, ${lng}`,
        city: address.city || "",
        town: address.town || address.village || "",
        state: address.state || address.region || "",
        borough: address.borough || address.suburb || "",
        postcode: address.postcode || "",
        country: address.country || "",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location data" });
    }
  });

  // --- Venue/place search (OpenStreetMap Nominatim) ---------------------------------
  //
  // The web app's venue search (client/src/components/places-search.tsx)
  // calls the browser's google.maps.places JS SDK directly, client-side —
  // there's no RN equivalent of that SDK, and no server proxy for Google
  // Places existed before this route. Rather than add a native Places SDK
  // dependency (its own API key, billing, and platform config) just for the
  // mobile app, this reuses the same free, key-less Nominatim service the
  // reverse-geocode route above already depends on, proxied server-side so
  // the mobile app calls it exactly like every other endpoint.
  app.get("/api/places/search", async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!q) return res.json({ results: [] });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&namedetails=1&limit=8`,
        { headers: { "User-Agent": `${APP_NAME} Application` } },
      );
      if (!response.ok) throw new Error("Places search unavailable");

      const data = await response.json();
      const results = (Array.isArray(data) ? data : []).map((item: any) => ({
        name: item.namedetails?.name || item.display_name.split(",")[0],
        address: item.display_name as string,
        latitude: item.lat as string,
        longitude: item.lon as string,
      }));

      res.json({ results });
    } catch (error) {
      res.status(500).json({ message: "Failed to search places" });
    }
  });

  // --- Admin ------------------------------------------------------------------------

  // Lets admins jump straight to a record's own edit page in the Directus
  // admin panel (maps, pins, users) for a quick manual fix. Gated on our own
  // is_admin flag, not Directus's — an admin still needs their own separate
  // Directus login to actually use the panel once they get there.
  app.get("/api/admin/directus-url", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || !(await storage.isAdmin(user.id))) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json({ url: process.env.DIRECTUS_URL || null });
    } catch (error) {
      console.error("Error fetching Directus URL:", error);
      res.status(500).json({ message: "Failed to fetch Directus URL" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || !(await storage.isAdmin(user.id))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:userId/group", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || !(await storage.isAdmin(user.id))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { userId } = req.params;
      const { userGroup } = req.body;
      if (!USER_GROUP.includes(userGroup)) {
        return res.status(400).json({ message: "Invalid user group" });
      }

      const updatedUser = await storage.updateUserGroup(userId, userGroup);
      if (!updatedUser) return res.status(404).json({ message: "User not found" });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user group:", error);
      res.status(500).json({ message: "Failed to update user group" });
    }
  });

  // Every map across every owner, for the admin "convert to curated map"
  // search/browse list. Deliberately lean (no per-map pin counts) — this is
  // a picker, not a dashboard.
  app.get("/api/admin/maps", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || !(await storage.isAdmin(user.id))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const allMaps = await storage.getAllMapCollections();
      const maps = await Promise.all(
        allMaps.map(async (map) => ({
          id: map.id,
          name: map.name,
          shareUrl: map.shareUrl,
          ownerId: map.ownerId,
          ownerName: await getMapOwnerName(map),
          curated: map.curated,
          curatedCategory: map.curatedCategory,
          createdAt: map.createdAt,
        })),
      );
      res.json(maps);
    } catch (error) {
      console.error("Error fetching admin maps list:", error);
      res.status(500).json({ message: "Failed to fetch maps" });
    }
  });

  // Single map's full detail (including current curated fields) for the
  // curate/edit page.
  app.get("/api/admin/maps/:mapId", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || !(await storage.isAdmin(user.id))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const map = await storage.getMapCollectionById(req.params.mapId);
      if (!map) return res.status(404).json({ message: "Map not found" });

      const ownerName = await getMapOwnerName(map);
      res.json({ ...map, ownerName });
    } catch (error) {
      console.error("Error fetching admin map detail:", error);
      res.status(500).json({ message: "Failed to fetch map" });
    }
  });

  // Converts an existing map (any owner) into a curated /discover entry, or
  // edits/un-curates one already curated. The owner is never touched — the
  // map stays credited to whoever made it.
  app.put("/api/admin/maps/:mapId/curate", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user || !(await storage.isAdmin(user.id))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existing = await storage.getMapCollectionById(req.params.mapId);
      if (!existing) return res.status(404).json({ message: "Map not found" });

      const data = curateMapSchema.parse(req.body);
      const updated = await storage.updateMapCuration(req.params.mapId, data);
      if (!updated) return res.status(500).json({ message: "Failed to update map curation" });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => err.message);
        return res.status(400).json({ message: errorMessages.join(", "), errors: error.errors });
      }
      console.error("Error updating map curation:", error);
      res.status(500).json({ message: "Failed to update map curation" });
    }
  });
}
