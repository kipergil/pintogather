import type { Express } from "express";
import { storage } from "./storage.js";
import {
  bulkInsertPinsSchema,
  insertMapCollectionSchema,
  insertPinSchema,
  updateMapDetailsSchema,
  updateProfileSchema,
  USERNAME_PATTERN,
} from "../shared/schema.js";
import type { Pin, PublicProfile, User } from "../shared/schema.js";
import { z } from "zod";
import { nanoid } from "nanoid";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { setupAuth, isAuthenticated, getCurrentUser } from "./clerkAuth.js";
import { getUserByUsername } from "./services/users.js";
import { USER_GROUP } from "../shared/enums.js";

const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]);

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
const VENUE_SUGGESTIONS_MODEL = "claude-haiku-4-5-20251001";
const VENUE_SUGGESTIONS_SYSTEM_PROMPT =
  "You suggest real, specific, well-known venues or places for a collaborative map-pinning app. " +
  "Given the user's theme, respond with ONLY a JSON array of up to 15 strings — no explanation, no markdown fences. " +
  "Each string must be a real place specific enough to find on Google Maps; include the city or neighborhood in " +
  "the name if it helps disambiguate (e.g. \"Ichiran Ramen Shibuya\" rather than just \"Ichiran\").";

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_LOGO_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type — please upload a PNG, JPEG, WebP, GIF, or SVG image."));
      return;
    }
    cb(null, true);
  },
});

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

      const maps = await storage.getPublicMapsByUserId(user.id);
      const mapsWithPinCount = await Promise.all(
        maps.map(async (map) => {
          const pins = await storage.getPinsByMapId(map.id);
          const approvedCount = pins.filter((pin) => pin.approved).length;
          return {
            id: map.id,
            name: map.name,
            description: map.description,
            shareUrl: map.shareUrl,
            brandingLogoUrl: map.brandingLogoUrl,
            pinCount: approvedCount,
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
        maps: mapsWithPinCount,
      };
      res.json(profile);
    } catch (error) {
      console.error("Error fetching public profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
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

      let maps;
      if (ownedOnly) {
        maps = await storage.getMapCollectionsByUserId(user.id);
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

      const data = insertMapCollectionSchema.parse({ ...req.body, ownerId: user.id });

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

  // --- Invitations ----------------------------------------------------------------

  app.post("/api/maps/:mapId/invitations", isAuthenticated, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { mapId } = req.params;
      const ownedMaps = await storage.getMapCollectionsByUserId(user.id);
      if (!ownedMaps.some((m) => m.id === mapId)) {
        return res.status(403).json({ message: "Only the map owner can invite people" });
      }

      const { email, permission } = req.body;
      if (!email || !permission) {
        return res.status(400).json({ message: "Email and permission are required" });
      }
      if (!["readonly", "editable"].includes(permission)) {
        return res.status(400).json({ message: "Invalid permission type" });
      }

      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await storage.createInvitation({
        mapId,
        email,
        permission,
        invitedBy: user.id,
        token,
        expiresAt,
      });

      // TODO: send email notification (SendGrid) once configured.
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
      if (!ownedMaps.some((m) => m.id === mapId)) {
        return res.status(403).json({ message: "Only the map owner can view invitations" });
      }

      const invitations = await storage.getMapInvitations(mapId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
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

      res.json({ message: "Invitation accepted successfully" });
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
      const isOwner = !!user && user.id === mapCollection.ownerId;

      const allPins = await storage.getPinsByMapId(mapCollection.id);
      const pins = isOwner ? allPins : allPins.filter((pin) => pin.approved);

      res.json({ ...mapCollection, pins, pinCount: pins.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch map collection" });
    }
  });

  app.post("/api/maps/:shareUrl/pins", async (req, res) => {
    try {
      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      if (!mapCollection) return res.status(404).json({ message: "Map collection not found" });

      const user = await getCurrentUser(req);
      const isOwner = !!user && user.id === mapCollection.ownerId;
      const data = insertPinSchema.parse({
        ...req.body,
        mapId: mapCollection.id,
        userId: user?.id ?? null, // never trust a client-supplied userId
        approved: isOwner, // pins from anyone but the owner need the owner's approval first
      });

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
      const isOwner = user.id === mapCollection.ownerId;

      const { pins } = bulkInsertPinsSchema.parse(req.body);
      const data = pins.map((pin) => ({ ...pin, mapId: mapCollection.id, userId: user.id, approved: isOwner }));

      const result = await storage.upsertPins(mapCollection.id, data);
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

      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      if (!mapCollection) return res.status(404).json({ message: "Map collection not found" });

      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (!prompt) return res.status(400).json({ message: "Describe what kind of places you're looking for" });
      if (prompt.length > 300) return res.status(400).json({ message: "Prompt is too long (max 300 characters)" });

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

      res.json({ suggestions: suggestions.slice(0, 15) });
    } catch (error) {
      console.error("Venue suggestion error:", error);
      res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  app.get("/api/pins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const pin = await storage.getPinById(id);
      if (!pin) return res.status(404).json({ message: "Pin not found" });
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

  // --- Reverse geocoding (OpenStreetMap Nominatim) ---------------------------------

  app.get("/api/geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) return res.status(400).json({ message: "Latitude and longitude are required" });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "PinTogather Application" } },
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
}
