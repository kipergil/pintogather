import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMapCollectionSchema, insertPinSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get Supabase configuration
  app.get("/api/config", async (req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    });
  });

  // Get all map collections (filtered by user)
  app.get("/api/maps", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      // If no userId provided, return empty array (user not authenticated)
      if (!userId) {
        return res.json([]);
      }

      const maps = await storage.getMapCollectionsForUser(userId);
      const mapsWithPinCount = await Promise.all(
        maps.map(async (map) => {
          const pins = await storage.getPinsByMapId(map.id);
          return {
            ...map,
            pinCount: pins.length,
          };
        })
      );
      res.json(mapsWithPinCount);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch map collections" });
    }
  });

  // Create new map collection
  app.post("/api/maps", async (req, res) => {
    try {
      const data = insertMapCollectionSchema.parse(req.body);
      
      // Check if map name already exists
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
        res.status(500).json({ message: "Failed to create map collection" });
      }
    }
  });

  // Get map collection by share URL
  app.get("/api/maps/:shareUrl", async (req, res) => {
    try {
      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      
      if (!mapCollection) {
        return res.status(404).json({ message: "Map collection not found" });
      }

      const pins = await storage.getPinsByMapId(mapCollection.id);
      res.json({
        ...mapCollection,
        pins,
        pinCount: pins.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch map collection" });
    }
  });

  // Create new pin
  app.post("/api/maps/:shareUrl/pins", async (req, res) => {
    try {
      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      
      if (!mapCollection) {
        return res.status(404).json({ message: "Map collection not found" });
      }

      const data = insertPinSchema.parse({
        ...req.body,
        mapId: mapCollection.id,
      });

      const pin = await storage.createPin(data);
      res.status(201).json(pin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Pin validation error:', error.errors);
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        res.status(400).json({ 
          message: `Validation failed: ${errorMessages.join(', ')}`, 
          errors: error.errors 
        });
      } else {
        console.error('Pin creation error:', error);
        res.status(500).json({ message: "Failed to create pin" });
      }
    }
  });

  // Delete pin
  app.delete("/api/pins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePin(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Pin not found" });
      }

      res.json({ message: "Pin deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete pin" });
    }
  });

  // Reverse geocoding endpoint (using OpenStreetMap Nominatim)
  app.get("/api/geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CollabMap Application'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = await response.json();
      
      if (!data || data.error) {
        return res.status(404).json({ message: "Location not found" });
      }

      const address = data.address || {};
      
      res.json({
        address: data.display_name || '',
        city: address.city || '',
        town: address.town || address.village || '',
        state: address.state || address.region || '',
        borough: address.borough || address.suburb || '',
        postcode: address.postcode || '',
        country: address.country || '',
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
