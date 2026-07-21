import type { Express } from "express";
import { storage } from "./storage.js";
import {
  insertMapCollectionSchema,
  insertPinSchema,
  updateMapDetailsSchema,
  updateProfileSchema,
} from "../shared/schema.js";
import type { Pin, User } from "../shared/schema.js";
import { z } from "zod";
import { nanoid } from "nanoid";
import { setupAuth, isAuthenticated, getCurrentUser } from "./clerkAuth.js";
import { USER_GROUP } from "../shared/enums.js";

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
          return { ...map, pinCount: pins.length };
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

      const pins = await storage.getPinsByMapId(mapCollection.id);
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
      const data = insertPinSchema.parse({
        ...req.body,
        mapId: mapCollection.id,
        userId: user?.id ?? null, // never trust a client-supplied userId
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

      const validatedData = insertPinSchema.partial().parse(req.body);
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
