import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, sql, or, and, ne, inArray } from "drizzle-orm";
import { mapCollections, pins, mapViewers, profiles, adminUsers, mapInvitations, type MapCollection, type InsertMapCollection, type Pin, type InsertPin, type MapViewer, type InsertMapViewer, type Profile, type InsertProfile, type AdminUser, type InsertAdminUser, type MapInvitation, type InsertMapInvitation } from "@shared/schema";
import { nanoid } from "nanoid";
import * as fs from "fs";
import * as path from "path";

export interface IStorage {
  // Map Collections
  createMapCollection(data: InsertMapCollection): Promise<MapCollection>;
  getMapCollectionByShareUrl(shareUrl: string): Promise<MapCollection | undefined>;
  getMapCollectionByName(name: string): Promise<MapCollection | undefined>;
  getAllMapCollections(): Promise<MapCollection[]>;
  getMapCollectionsByUserId(userId: string): Promise<MapCollection[]>;
  getMapCollectionsForUser(userId: string): Promise<MapCollection[]>;
  getContributedMaps(userId: string): Promise<MapCollection[]>;
  updateMapPermissions(mapId: string, isPublic: boolean, defaultPermission: string): Promise<MapCollection | undefined>;
  deleteMapCollection(mapId: string, userId: string): Promise<boolean>;
  
  // Map Viewers
  addMapViewer(data: InsertMapViewer): Promise<MapViewer>;
  getMapViewers(mapId: string): Promise<MapViewer[]>;
  getUserMapAccess(userId: string, mapId: string): Promise<MapViewer | undefined>;
  updateMapViewerPermission(mapId: string, userId: string, permission: string): Promise<MapViewer | undefined>;
  
  // Map Invitations
  createInvitation(data: InsertMapInvitation): Promise<MapInvitation>;
  getInvitationByToken(token: string): Promise<MapInvitation | undefined>;
  getMapInvitations(mapId: string): Promise<MapInvitation[]>;
  updateInvitationStatus(id: string, status: string): Promise<MapInvitation | undefined>;
  deleteInvitation(id: string): Promise<boolean>;
  
  // Pins
  createPin(data: InsertPin): Promise<Pin>;
  getPinsByMapId(mapId: string): Promise<Pin[]>;
  getPinById(id: string): Promise<Pin | undefined>;
  updatePin(id: string, data: Partial<InsertPin>): Promise<Pin | undefined>;
  deletePin(id: string, userId?: string): Promise<boolean>;
  
  // Admin functionality
  isAdmin(email: string): Promise<boolean>;
  getAllUsers(): Promise<Profile[]>;
  getUserProfile(userId: string): Promise<Profile | undefined>;
  updateUserGroup(userId: string, userGroup: string): Promise<Profile | undefined>;
  createAdminUser(data: InsertAdminUser): Promise<AdminUser>;
  
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
      // Create profiles table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          twitter_handle TEXT,
          instagram_handle TEXT,
          linkedin_handle TEXT,
          user_group TEXT NOT NULL DEFAULT 'freemium',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      // Create map_collections table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS map_collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          share_url TEXT NOT NULL UNIQUE,
          owner_id TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      // Create map_viewers table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS map_viewers (
          id TEXT PRIMARY KEY,
          map_id TEXT NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          UNIQUE(map_id, user_id)
        );
      `);

      // Create pins table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS pins (
          id TEXT PRIMARY KEY,
          map_id TEXT NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
          user_id TEXT,
          user_name TEXT NOT NULL,
          latitude TEXT NOT NULL,
          longitude TEXT NOT NULL,
          address TEXT,
          city TEXT,
          state TEXT,
          town TEXT,
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

      // Create admin_users table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS admin_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      // Insert the admin user if not exists
      await this.db.execute(sql`
        INSERT INTO admin_users (id, email, user_id)
        SELECT 'admin-1', 'kipergil@gmail.com', 'admin-user-1'
        WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE email = 'kipergil@gmail.com');
      `);
      
      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
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

  async getContributedMaps(userId: string): Promise<MapCollection[]> {
    // Get maps where user has contributed pins but is not the owner
    const contributedMapIds = await this.db
      .selectDistinct({ mapId: pins.mapId })
      .from(pins)
      .where(eq(pins.userId, userId));

    if (contributedMapIds.length === 0) {
      return [];
    }

    const contributedMaps = await this.db
      .select()
      .from(mapCollections)
      .where(
        and(
          inArray(mapCollections.id, contributedMapIds.map(m => m.mapId)),
          ne(mapCollections.ownerId, userId)
        )
      );

    return contributedMaps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createPin(data: InsertPin): Promise<Pin> {
    const id = nanoid();
    const [result] = await this.db
      .insert(pins)
      .values({
        id,
        ...data,
      })
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

  async getPinById(id: string): Promise<Pin | undefined> {
    const result = await this.db
      .select()
      .from(pins)
      .where(eq(pins.id, id))
      .limit(1);
    return result[0];
  }

  async updatePin(id: string, data: Partial<InsertPin>): Promise<Pin | undefined> {
    try {
      const result = await this.db
        .update(pins)
        .set(data)
        .where(eq(pins.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating pin:', error);
      return undefined;
    }
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

  async isAdmin(email: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);
    return result.length > 0;
  }

  async getAllUsers(): Promise<Profile[]> {
    const result = await this.db
      .select()
      .from(profiles)
      .orderBy(desc(profiles.createdAt));
    return result;
  }

  async getUserProfile(userId: string): Promise<Profile | undefined> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    return result[0];
  }

  async updateUserGroup(userId: string, userGroup: string): Promise<Profile | undefined> {
    try {
      const result = await this.db
        .update(profiles)
        .set({ userGroup, updatedAt: new Date() })
        .where(eq(profiles.userId, userId))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating user group:', error);
      return undefined;
    }
  }

  async createAdminUser(data: InsertAdminUser): Promise<AdminUser> {
    const id = nanoid();
    const [result] = await this.db
      .insert(adminUsers)
      .values({
        id,
        email: data.email,
        userId: data.userId,
      })
      .returning();
    return result;
  }

  async updateMapPermissions(mapId: string, isPublic: boolean, defaultPermission: string): Promise<MapCollection | undefined> {
    try {
      const result = await this.db
        .update(mapCollections)
        .set({ isPublic, defaultPermission })
        .where(eq(mapCollections.id, mapId))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating map permissions:', error);
      return undefined;
    }
  }

  async deleteMapCollection(mapId: string, userId: string): Promise<boolean> {
    try {
      // Check if the user is the owner of the map
      const mapResult = await this.db
        .select()
        .from(mapCollections)
        .where(eq(mapCollections.id, mapId))
        .limit(1);
      
      if (mapResult.length === 0) {
        return false; // Map not found
      }

      if (mapResult[0].ownerId !== userId) {
        return false; // User is not the owner
      }

      // Delete the map collection (this will cascade delete pins, viewers, and invitations)
      const deleteResult = await this.db
        .delete(mapCollections)
        .where(eq(mapCollections.id, mapId))
        .returning();
      
      return deleteResult.length > 0;
    } catch (error) {
      console.error('Error deleting map collection:', error);
      return false;
    }
  }

  async updateMapViewerPermission(mapId: string, userId: string, permission: string): Promise<MapViewer | undefined> {
    try {
      const result = await this.db
        .update(mapViewers)
        .set({ permission })
        .where(sql`${mapViewers.mapId} = ${mapId} AND ${mapViewers.userId} = ${userId}`)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating map viewer permission:', error);
      return undefined;
    }
  }

  async createInvitation(data: InsertMapInvitation): Promise<MapInvitation> {
    const id = nanoid();
    const result = await this.db
      .insert(mapInvitations)
      .values({ ...data, id })
      .returning();
    return result[0];
  }

  async getInvitationByToken(token: string): Promise<MapInvitation | undefined> {
    const result = await this.db
      .select()
      .from(mapInvitations)
      .where(eq(mapInvitations.token, token))
      .limit(1);
    return result[0];
  }

  async getMapInvitations(mapId: string): Promise<MapInvitation[]> {
    return await this.db
      .select()
      .from(mapInvitations)
      .where(eq(mapInvitations.mapId, mapId));
  }

  async updateInvitationStatus(id: string, status: string): Promise<MapInvitation | undefined> {
    try {
      const result = await this.db
        .update(mapInvitations)
        .set({ status })
        .where(eq(mapInvitations.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating invitation status:', error);
      return undefined;
    }
  }

  async deleteInvitation(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(mapInvitations)
        .where(eq(mapInvitations.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting invitation:', error);
      return false;
    }
  }
}

export class MemStorage implements IStorage {
  private mapCollections: Map<string, MapCollection>;
  private pins: Map<string, Pin>;
  private mapViewers: Map<string, MapViewer>;
  private mapInvitations: Map<string, MapInvitation>;
  private dataFile: string;

  constructor() {
    this.mapCollections = new Map();
    this.pins = new Map();
    this.mapViewers = new Map();
    this.mapInvitations = new Map();
    this.dataFile = path.join(process.cwd(), 'storage-data.json');
    this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        
        // Load map collections
        if (data.mapCollections) {
          for (const collection of data.mapCollections) {
            this.mapCollections.set(collection.id, {
              ...collection,
              createdAt: new Date(collection.createdAt)
            });
          }
        }
        
        // Load pins
        if (data.pins) {
          for (const pin of data.pins) {
            this.pins.set(pin.id, {
              ...pin,
              createdAt: new Date(pin.createdAt)
            });
          }
        }
        
        // Load map viewers
        if (data.mapViewers) {
          for (const viewer of data.mapViewers) {
            this.mapViewers.set(viewer.id, {
              ...viewer,
              createdAt: new Date(viewer.createdAt)
            });
          }
        }
        
        console.log(`Loaded ${this.mapCollections.size} maps and ${this.pins.size} pins from persistent storage`);
      }
    } catch (error) {
      console.error('Error loading data from storage file:', error);
    }
  }

  private saveData() {
    try {
      const data = {
        mapCollections: Array.from(this.mapCollections.values()),
        pins: Array.from(this.pins.values()),
        mapViewers: Array.from(this.mapViewers.values())
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving data to storage file:', error);
    }
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
      isPublic: data.isPublic ?? false,
      defaultPermission: data.defaultPermission ?? 'readonly',
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

  async getContributedMaps(userId: string): Promise<MapCollection[]> {
    // Get maps where user has contributed pins but is not the owner
    const contributedMapIds = new Set(
      Array.from(this.pins.values())
        .filter((pin) => pin.userId === userId)
        .map((pin) => pin.mapId)
    );

    const contributedMaps = Array.from(this.mapCollections.values())
      .filter((collection) => contributedMapIds.has(collection.id) && collection.ownerId !== userId);

    return contributedMaps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  async getPinById(id: string): Promise<Pin | undefined> {
    return this.pins.get(id);
  }

  async updatePin(id: string, data: Partial<InsertPin>): Promise<Pin | undefined> {
    const existingPin = this.pins.get(id);
    if (!existingPin) {
      return undefined;
    }

    const updatedPin: Pin = {
      ...existingPin,
      ...data,
      id: existingPin.id, // Ensure ID doesn't change
      mapId: existingPin.mapId, // Ensure mapId doesn't change
      createdAt: existingPin.createdAt, // Preserve creation date
    };

    this.pins.set(id, updatedPin);
    return updatedPin;
  }

  async addMapViewer(data: InsertMapViewer): Promise<MapViewer> {
    const id = nanoid();
    const mapViewer: MapViewer = {
      id,
      userId: data.userId,
      mapId: data.mapId,
      role: data.role ?? 'viewer',
      permission: data.permission || 'readonly',
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

  async isAdmin(email: string): Promise<boolean> {
    return email === 'kipergil@gmail.com';
  }

  async getAllUsers(): Promise<Profile[]> {
    // MemStorage doesn't store profiles, return empty array
    return [];
  }

  async getUserProfile(userId: string): Promise<Profile | undefined> {
    return undefined;
  }

  async updateUserGroup(userId: string, userGroup: string): Promise<Profile | undefined> {
    return undefined;
  }

  async createAdminUser(data: InsertAdminUser): Promise<AdminUser> {
    const id = nanoid();
    return {
      id,
      email: data.email,
      userId: data.userId,
      createdAt: new Date(),
    };
  }

  async updateMapPermissions(mapId: string, isPublic: boolean, defaultPermission: string): Promise<MapCollection | undefined> {
    const map = this.mapCollections.get(mapId);
    if (!map) return undefined;
    
    const updatedMap = { ...map, isPublic, defaultPermission };
    this.mapCollections.set(mapId, updatedMap);
    this.saveData();
    return updatedMap;
  }

  async deleteMapCollection(mapId: string, userId: string): Promise<boolean> {
    const map = this.mapCollections.get(mapId);
    if (!map) return false;
    
    // Check if the user is the owner of the map
    if (map.ownerId !== userId) {
      return false;
    }

    // Delete the map collection
    this.mapCollections.delete(mapId);
    
    // Delete all pins associated with this map
    const pinsToDelete = Array.from(this.pins.entries())
      .filter(([_, pin]) => pin.mapId === mapId)
      .map(([id, _]) => id);
    
    pinsToDelete.forEach(id => this.pins.delete(id));
    
    // Delete all map viewers associated with this map
    const viewersToDelete = Array.from(this.mapViewers.entries())
      .filter(([_, viewer]) => viewer.mapId === mapId)
      .map(([id, _]) => id);
    
    viewersToDelete.forEach(id => this.mapViewers.delete(id));
    
    // Delete all invitations associated with this map
    if (this.mapInvitations) {
      const invitationsToDelete = Array.from(this.mapInvitations.entries())
        .filter(([_, invitation]) => invitation.mapId === mapId)
        .map(([id, _]) => id);
      
      invitationsToDelete.forEach(id => this.mapInvitations.delete(id));
    }
    
    this.saveData();
    return true;
  }

  async updateMapViewerPermission(mapId: string, userId: string, permission: string): Promise<MapViewer | undefined> {
    const viewer = Array.from(this.mapViewers.values())
      .find(mv => mv.mapId === mapId && mv.userId === userId);
    
    if (!viewer) return undefined;
    
    const updatedViewer = { ...viewer, permission };
    this.mapViewers.set(viewer.id, updatedViewer);
    this.saveData();
    return updatedViewer;
  }

  async createInvitation(data: InsertMapInvitation): Promise<MapInvitation> {
    const id = nanoid();
    const invitation: MapInvitation = {
      id,
      mapId: data.mapId,
      email: data.email,
      permission: data.permission || 'readonly',
      invitedBy: data.invitedBy || 'system',
      token: data.token,
      status: 'pending',
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    };
    
    // Store in a separate map for invitations (add to constructor)
    if (!this.mapInvitations) {
      this.mapInvitations = new Map();
    }
    this.mapInvitations.set(id, invitation);
    this.saveData();
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<MapInvitation | undefined> {
    if (!this.mapInvitations) return undefined;
    return Array.from(this.mapInvitations.values())
      .find(inv => inv.token === token);
  }

  async getMapInvitations(mapId: string): Promise<MapInvitation[]> {
    if (!this.mapInvitations) return [];
    return Array.from(this.mapInvitations.values())
      .filter(inv => inv.mapId === mapId);
  }

  async updateInvitationStatus(id: string, status: string): Promise<MapInvitation | undefined> {
    if (!this.mapInvitations) return undefined;
    const invitation = this.mapInvitations.get(id);
    if (!invitation) return undefined;
    
    const updatedInvitation = { ...invitation, status };
    this.mapInvitations.set(id, updatedInvitation);
    this.saveData();
    return updatedInvitation;
  }

  async deleteInvitation(id: string): Promise<boolean> {
    if (!this.mapInvitations) return false;
    const deleted = this.mapInvitations.delete(id);
    if (deleted) this.saveData();
    return deleted;
  }
}

// Initialize storage - require database connection
async function initializeStorage(): Promise<IStorage> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  console.log('Connecting to PostgreSQL database...');
  const dbStorage = new DatabaseStorage();
  await dbStorage.initializeDatabase();
  console.log('Successfully connected to PostgreSQL database');
  return dbStorage;
}

// Create storage instance
let storageInstance: IStorage | null = null;

export async function getStorage(): Promise<IStorage> {
  if (!storageInstance) {
    storageInstance = await initializeStorage();
  }
  return storageInstance;
}

// For backward compatibility, export a storage object that initializes on first use
export const storage = {
  async initializeDatabase() {
    const instance = await getStorage();
    return instance.initializeDatabase();
  },
  async createMapCollection(data: InsertMapCollection) {
    const instance = await getStorage();
    return instance.createMapCollection(data);
  },
  async getMapCollectionByShareUrl(shareUrl: string) {
    const instance = await getStorage();
    return instance.getMapCollectionByShareUrl(shareUrl);
  },
  async getMapCollectionByName(name: string) {
    const instance = await getStorage();
    return instance.getMapCollectionByName(name);
  },
  async getAllMapCollections() {
    const instance = await getStorage();
    return instance.getAllMapCollections();
  },
  async getMapCollectionsByUserId(userId: string) {
    const instance = await getStorage();
    return instance.getMapCollectionsByUserId(userId);
  },
  async getMapCollectionsForUser(userId: string) {
    const instance = await getStorage();
    return instance.getMapCollectionsForUser(userId);
  },
  async getContributedMaps(userId: string) {
    const instance = await getStorage();
    return instance.getContributedMaps(userId);
  },
  async addMapViewer(data: InsertMapViewer) {
    const instance = await getStorage();
    return instance.addMapViewer(data);
  },
  async getMapViewers(mapId: string) {
    const instance = await getStorage();
    return instance.getMapViewers(mapId);
  },
  async getUserMapAccess(userId: string, mapId: string) {
    const instance = await getStorage();
    return instance.getUserMapAccess(userId, mapId);
  },
  async createPin(data: InsertPin) {
    const instance = await getStorage();
    return instance.createPin(data);
  },
  async getPinsByMapId(mapId: string) {
    const instance = await getStorage();
    return instance.getPinsByMapId(mapId);
  },
  async getPinById(id: string) {
    const instance = await getStorage();
    return instance.getPinById(id);
  },
  async updatePin(id: string, data: Partial<InsertPin>) {
    const instance = await getStorage();
    return instance.updatePin(id, data);
  },
  async deletePin(id: string, userId?: string) {
    const instance = await getStorage();
    return instance.deletePin(id, userId);
  },
  async isAdmin(email: string) {
    const instance = await getStorage();
    return instance.isAdmin(email);
  },
  async getAllUsers() {
    const instance = await getStorage();
    return instance.getAllUsers();
  },
  async getUserProfile(userId: string) {
    const instance = await getStorage();
    return instance.getUserProfile(userId);
  },
  async updateUserGroup(userId: string, userGroup: string) {
    const instance = await getStorage();
    return instance.updateUserGroup(userId, userGroup);
  },
  async createAdminUser(data: InsertAdminUser) {
    const instance = await getStorage();
    return instance.createAdminUser(data);
  },
  async updateMapPermissions(mapId: string, isPublic: boolean, defaultPermission: string) {
    const instance = await getStorage();
    return instance.updateMapPermissions(mapId, isPublic, defaultPermission);
  },
  async deleteMapCollection(mapId: string, userId: string) {
    const instance = await getStorage();
    return instance.deleteMapCollection(mapId, userId);
  },
  async updateMapViewerPermission(mapId: string, userId: string, permission: string) {
    const instance = await getStorage();
    return instance.updateMapViewerPermission(mapId, userId, permission);
  },
  async createInvitation(data: InsertMapInvitation) {
    const instance = await getStorage();
    return instance.createInvitation(data);
  },
  async getInvitationByToken(token: string) {
    const instance = await getStorage();
    return instance.getInvitationByToken(token);
  },
  async getMapInvitations(mapId: string) {
    const instance = await getStorage();
    return instance.getMapInvitations(mapId);
  },
  async updateInvitationStatus(id: string, status: string) {
    const instance = await getStorage();
    return instance.updateInvitationStatus(id, status);
  },
  async deleteInvitation(id: string) {
    const instance = await getStorage();
    return instance.deleteInvitation(id);
  }
};
