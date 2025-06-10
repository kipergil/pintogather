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
}

export class MemStorage implements IStorage {
  private mapCollections: Map<string, MapCollection>;
  private pins: Map<string, Pin>;

  constructor() {
    this.mapCollections = new Map();
    this.pins = new Map();
  }

  async createMapCollection(data: InsertMapCollection): Promise<MapCollection> {
    const id = nanoid();
    const shareUrl = nanoid(12);
    const mapCollection: MapCollection = {
      ...data,
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
      ...data,
      id,
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

  async deletePin(id: string): Promise<boolean> {
    return this.pins.delete(id);
  }
}

export const storage = new MemStorage();
