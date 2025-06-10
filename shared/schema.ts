import { pgTable, text, serial, timestamp, decimal, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const profiles = pgTable("profiles", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  fullName: text("full_name").notNull(),
  twitterHandle: text("twitter_handle"),
  instagramHandle: text("instagram_handle"),
  linkedinHandle: text("linkedin_handle"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mapCollections = pgTable("map_collections", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  shareUrl: text("share_url").notNull().unique(),
  ownerId: varchar("owner_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mapViewers = pgTable("map_viewers", {
  id: varchar("id", { length: 255 }).primaryKey(),
  mapId: varchar("map_id", { length: 255 }).notNull().references(() => mapCollections.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  role: text("role").notNull().default("viewer"), // "viewer" or "contributor"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pins = pgTable("pins", {
  id: varchar("id", { length: 255 }).primaryKey(),
  mapId: varchar("map_id", { length: 255 }).notNull().references(() => mapCollections.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }),
  userName: text("user_name").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  town: text("town"),
  borough: text("borough"),
  postcode: text("postcode"),
  country: text("country"),
  twitterHandle: text("twitter_handle"),
  instagramHandle: text("instagram_handle"),
  linkedinHandle: text("linkedin_handle"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMapCollectionSchema = createInsertSchema(mapCollections).omit({
  id: true,
  shareUrl: true,
  createdAt: true,
});

export const insertMapViewerSchema = createInsertSchema(mapViewers).omit({
  id: true,
  createdAt: true,
}).extend({
  role: z.string().optional(),
});

export const insertPinSchema = createInsertSchema(pins).omit({
  id: true,
  createdAt: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;
export type InsertMapCollection = z.infer<typeof insertMapCollectionSchema>;
export type MapCollection = typeof mapCollections.$inferSelect;
export type InsertMapViewer = z.infer<typeof insertMapViewerSchema>;
export type MapViewer = typeof mapViewers.$inferSelect;
export type InsertPin = z.infer<typeof insertPinSchema>;
export type Pin = typeof pins.$inferSelect;
