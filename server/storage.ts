import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, sql } from "drizzle-orm";
import { mapCollections, pins, type MapCollection, type InsertMapCollection, type Pin, type InsertPin } from "@shared/schema";
import { nanoid } from "nanoid";

export interface IStorage {
  // Map Collections
  createMapCollection(data: InsertMapCollection): Promise<MapCollection>;
  getMapCollectionByShareUrl(shareUrl: string): Promise<MapCollection | undefined>;
  getMapCollectionByName(name: string): Promise<MapCollection | undefined>;
  getAllMapCollections(): Promise<MapCollection[]>;
  
  // Pins
  createPin(data: InsertPin): Promise<Pin>;
  getPinsByMapId(mapId: string): Promise<Pin[]>;
  deletePin(id: string): Promise<boolean>;
  
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
    const shareUrl = nanoid(12);
    const [result] = await this.db
      .insert(mapCollections)
      .values({
        ...data,
        shareUrl,
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

  async deletePin(id: string): Promise<boolean> {
    const result = await this.db
      .delete(pins)
      .where(eq(pins.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export class MemStorage implements IStorage {
  private mapCollections: Map<string, MapCollection>;
  private pins: Map<string, Pin>;

  constructor() {
    this.mapCollections = new Map();
    this.pins = new Map();
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

  async createPin(data: InsertPin): Promise<Pin> {
    const id = nanoid();
    const pin: Pin = {
      mapId: data.mapId,
      userName: data.userName,
      latitude: data.latitude,
      longitude: data.longitude,
      id,
      createdAt: new Date(),
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      borough: data.borough ?? null,
      postcode: data.postcode ?? null,
      country: data.country ?? null,
      twitterHandle: data.twitterHandle ?? null,
      instagramHandle: data.instagramHandle ?? null,
      linkedinHandle: data.linkedinHandle ?? null,
      note: data.note ?? null,
    };
    this.pins.set(id, pin);
    return pin;
  }

  async getPinsByMapId(mapId: string): Promise<Pin[]> {
    return Array.from(this.pins.values())
      .filter((pin) => pin.mapId === mapId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async deletePin(id: string): Promise<boolean> {
    return this.pins.delete(id);
  }
}

// Use database storage if DATABASE_URL is available, otherwise fall back to memory storage
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();

// Initialize database on startup
if (process.env.DATABASE_URL) {
  (storage as DatabaseStorage).initializeDatabase().catch(console.error);
}
