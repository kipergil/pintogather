import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, sql, or, and, ne, inArray } from "drizzle-orm";
import { mapCollections, pins, mapViewers, type MapCollection, type InsertMapCollection, type Pin, type InsertPin, type MapViewer, type InsertMapViewer } from "@shared/schema";
import { nanoid } from "nanoid";

export interface IStorage {
  // Map Collections
  createMapCollection(data: InsertMapCollection): Promise<MapCollection>;
  getMapCollectionByShareUrl(shareUrl: string): Promise<MapCollection | undefined>;
  getMapCollectionByName(name: string): Promise<MapCollection | undefined>;
  getAllMapCollections(): Promise<MapCollection[]>;
  getMapCollectionsByUserId(userId: string): Promise<MapCollection[]>;
  getMapCollectionsForUser(userId: string): Promise<MapCollection[]>;
  
  // Map Viewers
  addMapViewer(data: InsertMapViewer): Promise<MapViewer>;
  getMapViewers(mapId: string): Promise<MapViewer[]>;
  getUserMapAccess(userId: string, mapId: string): Promise<MapViewer | undefined>;
  
  // Pins
  createPin(data: InsertPin): Promise<Pin>;
  getPinsByMapId(mapId: string): Promise<Pin[]>;
  deletePin(id: string, userId?: string): Promise<boolean>;
  
  // Database setup
  initializeDatabase(): Promise<void>;
}

class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  
  constructor() {
    const client = postgres(process.env.DATABASE_URL!);
    this.db = drizzle(client);
  }

  async initializeDatabase(): Promise<void> {
    try {
      // Create tables if they don't exist using sql`` template
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS map_collections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          share_url TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS pins (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          map_id UUID NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
          user_name TEXT NOT NULL,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          address TEXT,
          city TEXT,
          state TEXT,
          borough TEXT,
          postcode TEXT,
          country TEXT,
          twitter_handle TEXT,
          instagram_handle TEXT,
          linkedin_handle TEXT,
          note TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);
      
      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  async createMapCollection(data: InsertMapCollection): Promise<MapCollection> {
    const id = nanoid();
    const shareUrl = nanoid(12);
    const [result] = await this.db
      .insert(mapCollections)
      .values({
        id,
        name: data.name,
        description: data.description,
        shareUrl,
        ownerId: data.ownerId,
      })
      .returning();
    return {
      ...result,
      description: result.description ?? null,
    };
  }

  async getMapCollectionByShareUrl(shareUrl: string): Promise<MapCollection | undefined> {
    const [result] = await this.db
      .select()
      .from(mapCollections)
      .where(eq(mapCollections.shareUrl, shareUrl));
    return result;
  }

  async getMapCollectionByName(name: string): Promise<MapCollection | undefined> {
    const [result] = await this.db
      .select()
      .from(mapCollections)
      .where(eq(mapCollections.name, name));
    return result;
  }

  async getAllMapCollections(): Promise<MapCollection[]> {
    const result = await this.db
      .select()
      .from(mapCollections)
      .orderBy(desc(mapCollections.createdAt));
    return result;
  }

  async getMapCollectionsByUserId(userId: string): Promise<MapCollection[]> {
    const result = await this.db
      .select()
      .from(mapCollections)
      .where(eq(mapCollections.ownerId, userId))
      .orderBy(desc(mapCollections.createdAt));
    return result;
  }

  async getMapCollectionsForUser(userId: string): Promise<MapCollection[]> {
    // Get maps where user is owner
    const ownedMaps = await this.db
      .select()
      .from(mapCollections)
      .where(eq(mapCollections.ownerId, userId));

    // Get maps where user has contributed pins
    const contributedMapIds = await this.db
      .selectDistinct({ mapId: pins.mapId })
      .from(pins)
      .where(eq(pins.userId, userId));

    const contributedMaps = contributedMapIds.length > 0 ? await this.db
      .select()
      .from(mapCollections)
      .where(
        and(
          inArray(mapCollections.id, contributedMapIds.map(m => m.mapId)),
          ne(mapCollections.ownerId, userId)
        )
      ) : [];

    // Combine and deduplicate
    const allMaps = [...ownedMaps, ...contributedMaps];
    const uniqueMaps = Array.from(new Map(allMaps.map(map => [map.id, map])).values());

    return uniqueMaps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createPin(data: InsertPin): Promise<Pin> {
    const [result] = await this.db
      .insert(pins)
      .values(data)
      .returning();
    return {
      ...result,
      address: result.address ?? null,
      city: result.city ?? null,
      state: result.state ?? null,
      borough: result.borough ?? null,
      postcode: result.postcode ?? null,
      country: result.country ?? null,
      twitterHandle: result.twitterHandle ?? null,
      instagramHandle: result.instagramHandle ?? null,
      linkedinHandle: result.linkedinHandle ?? null,
      note: result.note ?? null,
    };
  }

  async getPinsByMapId(mapId: string): Promise<Pin[]> {
    const result = await this.db
      .select()
      .from(pins)
      .where(eq(pins.mapId, mapId))
      .orderBy(desc(pins.createdAt));
    return result;
  }

  async addMapViewer(data: InsertMapViewer): Promise<MapViewer> {
    const id = nanoid();
    const result = await this.db
      .insert(mapViewers)
      .values({ ...data, id })
      .returning();
    return result[0];
  }

  async getMapViewers(mapId: string): Promise<MapViewer[]> {
    return await this.db
      .select()
      .from(mapViewers)
      .where(eq(mapViewers.mapId, mapId));
  }

  async getUserMapAccess(userId: string, mapId: string): Promise<MapViewer | undefined> {
    const result = await this.db
      .select()
      .from(mapViewers)
      .where(sql`${mapViewers.userId} = ${userId} AND ${mapViewers.mapId} = ${mapId}`)
      .limit(1);
    return result[0];
  }

  async deletePin(id: string, userId?: string): Promise<boolean> {
    try {
      if (userId) {
        // Check if user has permission to delete the pin
        const pin = await this.db
          .select()
          .from(pins)
          .where(eq(pins.id, id))
          .limit(1);
          
        if (pin.length === 0) return false;
        
        const mapCollection = await this.db
          .select()
          .from(mapCollections)
          .where(eq(mapCollections.id, pin[0].mapId))
          .limit(1);
          
        const isMapOwner = mapCollection[0]?.ownerId === userId;
        const isPinOwner = pin[0].userId === userId;
        
        if (!isMapOwner && !isPinOwner) {
          return false;
        }
      }
      
      await this.db
        .delete(pins)
        .where(eq(pins.id, id));
      return true;
    } catch (error) {
      console.error('Failed to delete pin:', error);
      return false;
    }
  }
}

export class MemStorage implements IStorage {
  private mapCollections: Map<string, MapCollection>;
  private pins: Map<string, Pin>;
  private mapViewers: Map<string, MapViewer>;

  constructor() {
    this.mapCollections = new Map();
    this.pins = new Map();
    this.mapViewers = new Map();
  }

  async initializeDatabase(): Promise<void> {
    // No-op for memory storage
  }

  async createMapCollection(data: InsertMapCollection): Promise<MapCollection> {
    const id = nanoid();
    const shareUrl = nanoid(12);
    const mapCollection: MapCollection = {
      ...data,
      description: data.description ?? null,
      ownerId: data.ownerId ?? null,
      id,
      shareUrl,
      createdAt: new Date(),
    };
    this.mapCollections.set(id, mapCollection);
    return mapCollection;
  }

  async getMapCollectionByShareUrl(shareUrl: string): Promise<MapCollection | undefined> {
    return Array.from(this.mapCollections.values()).find(
      (collection) => collection.shareUrl === shareUrl
    );
  }

  async getMapCollectionByName(name: string): Promise<MapCollection | undefined> {
    return Array.from(this.mapCollections.values()).find(
      (collection) => collection.name === name
    );
  }

  async getAllMapCollections(): Promise<MapCollection[]> {
    return Array.from(this.mapCollections.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getMapCollectionsByUserId(userId: string): Promise<MapCollection[]> {
    return Array.from(this.mapCollections.values())
      .filter((collection) => collection.ownerId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getMapCollectionsForUser(userId: string): Promise<MapCollection[]> {
    // Get maps where user is owner
    const ownedMaps = Array.from(this.mapCollections.values())
      .filter((collection) => collection.ownerId === userId);

    // Get maps where user has contributed pins
    const contributedMapIds = new Set(
      Array.from(this.pins.values())
        .filter((pin) => pin.userId === userId)
        .map((pin) => pin.mapId)
    );

    const contributedMaps = Array.from(this.mapCollections.values())
      .filter((collection) => contributedMapIds.has(collection.id) && collection.ownerId !== userId);

    // Combine and deduplicate
    const allMaps = [...ownedMaps, ...contributedMaps];
    const uniqueMaps = Array.from(new Map(allMaps.map(map => [map.id, map])).values());

    return uniqueMaps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createPin(data: InsertPin): Promise<Pin> {
    const id = nanoid();
    const pin: Pin = {
      id,
      mapId: data.mapId,
      userId: data.userId ?? null,
      userName: data.userName,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      town: data.town ?? null,
      borough: data.borough ?? null,
      postcode: data.postcode ?? null,
      country: data.country ?? null,
      twitterHandle: data.twitterHandle ?? null,
      instagramHandle: data.instagramHandle ?? null,
      linkedinHandle: data.linkedinHandle ?? null,
      note: data.note ?? null,
      createdAt: new Date(),
    };
    this.pins.set(id, pin);
    return pin;
  }

  async getPinsByMapId(mapId: string): Promise<Pin[]> {
    return Array.from(this.pins.values())
      .filter((pin) => pin.mapId === mapId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async addMapViewer(data: InsertMapViewer): Promise<MapViewer> {
    const id = nanoid();
    const mapViewer: MapViewer = {
      ...data,
      id,
      createdAt: new Date(),
    };
    this.mapViewers.set(id, mapViewer);
    return mapViewer;
  }

  async getMapViewers(mapId: string): Promise<MapViewer[]> {
    return Array.from(this.mapViewers.values()).filter(viewer => viewer.mapId === mapId);
  }

  async getUserMapAccess(userId: string, mapId: string): Promise<MapViewer | undefined> {
    return Array.from(this.mapViewers.values()).find(
      viewer => viewer.userId === userId && viewer.mapId === mapId
    );
  }

  async deletePin(id: string, userId?: string): Promise<boolean> {
    const pin = this.pins.get(id);
    if (!pin) return false;

    // If userId is provided, check ownership permissions
    if (userId) {
      const mapCollection = Array.from(this.mapCollections.values()).find(map => map.id === pin.mapId);
      const isMapOwner = mapCollection?.ownerId === userId;
      const isPinOwner = pin.userId === userId;
      
      if (!isMapOwner && !isPinOwner) {
        return false; // User doesn't have permission to delete this pin
      }
    }

    return this.pins.delete(id);
  }
}

// Use memory storage for now - this ensures the application works immediately
export const storage = new MemStorage();

console.log('Using in-memory storage - data will not persist between restarts');
