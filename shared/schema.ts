import { pgTable, text, serial, timestamp, decimal, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const mapCollections = pgTable("map_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  shareUrl: text("share_url").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pins = pgTable("pins", {
  id: uuid("id").primaryKey().defaultRandom(),
  mapId: uuid("map_id").notNull().references(() => mapCollections.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  borough: text("borough"),
  postcode: text("postcode"),
  country: text("country"),
  twitterHandle: text("twitter_handle"),
  instagramHandle: text("instagram_handle"),
  linkedinHandle: text("linkedin_handle"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMapCollectionSchema = createInsertSchema(mapCollections).omit({
  id: true,
  shareUrl: true,
  createdAt: true,
});

export const insertPinSchema = createInsertSchema(pins).omit({
  id: true,
  createdAt: true,
});

export type InsertMapCollection = z.infer<typeof insertMapCollectionSchema>;
export type MapCollection = typeof mapCollections.$inferSelect;
export type InsertPin = z.infer<typeof insertPinSchema>;
export type Pin = typeof pins.$inferSelect;
