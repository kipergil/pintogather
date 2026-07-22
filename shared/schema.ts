import { z } from "zod";
import { INVITATION_STATUS, MAP_VIEWER_ROLE, PERMISSION, USER_GROUP } from "./enums.js";

/**
 * Domain types used throughout the app (client + server). These are the
 * camelCase shapes the UI already expects; server/storage.ts is responsible
 * for translating to/from the snake_case Directus collections defined in
 * shared/directus-schema.ts.
 */

export interface User {
  id: string; // Directus directus_users.id (uuid)
  clerkUserId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  fullName: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  linkedinHandle: string | null;
  userGroup: (typeof USER_GROUP)[number];
  isAdmin: boolean;
}

export interface UpsertUser {
  clerkUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export const updateProfileSchema = z.object({
  fullName: z.string().min(1),
  twitterHandle: z.string().trim().nullable().optional(),
  instagramHandle: z.string().trim().nullable().optional(),
  linkedinHandle: z.string().trim().nullable().optional(),
});
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export interface MapCollection {
  id: string;
  name: string;
  description: string | null;
  shareUrl: string;
  ownerId: string | null;
  isPublic: boolean;
  defaultPermission: (typeof PERMISSION)[number];
  /** Custom label for the pin note field on this map, e.g. "Favourite dish". Falls back to "Note" when null. */
  noteLabel: string | null;
  /** Custom question/prompt shown under the note label, e.g. "What should people order here?". */
  notePrompt: string | null;
  /** Custom logo shown instead of PinTogather branding on this map's public /p/:shareUrl page. */
  brandingLogoUrl: string | null;
  createdAt: Date;
}

export const insertMapCollectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  defaultPermission: z.enum(PERMISSION).optional(),
  noteLabel: z.string().trim().max(60).nullable().optional(),
  notePrompt: z.string().trim().nullable().optional(),
  brandingLogoUrl: z.string().trim().max(500).nullable().optional(),
});
export type InsertMapCollection = z.infer<typeof insertMapCollectionSchema>;

export const updateMapDetailsSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  noteLabel: z.string().trim().max(60).nullable().optional(),
  notePrompt: z.string().trim().nullable().optional(),
  brandingLogoUrl: z.string().trim().max(500).nullable().optional(),
});
export type UpdateMapDetails = z.infer<typeof updateMapDetailsSchema>;

export interface Pin {
  id: string;
  mapId: string;
  userId: string | null;
  userName: string;
  latitude: string;
  longitude: string;
  address: string | null;
  city: string | null;
  state: string | null;
  town: string | null;
  borough: string | null;
  postcode: string | null;
  country: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  linkedinHandle: string | null;
  note: string | null;
  createdAt: Date;
}

export const insertPinSchema = z.object({
  mapId: z.string().min(1),
  userId: z.string().nullable().optional(),
  userName: z.string().min(1),
  latitude: z.union([z.string(), z.number()]).transform((v) => String(v)),
  longitude: z.union([z.string(), z.number()]).transform((v) => String(v)),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  town: z.string().nullable().optional(),
  borough: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  twitterHandle: z.string().nullable().optional(),
  instagramHandle: z.string().nullable().optional(),
  linkedinHandle: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});
export type InsertPin = z.infer<typeof insertPinSchema>;

export const bulkInsertPinsSchema = z.object({
  pins: z.array(insertPinSchema.omit({ mapId: true, userId: true })).min(1).max(200),
});
export type BulkInsertPins = z.infer<typeof bulkInsertPinsSchema>;

export interface MapViewer {
  id: string;
  mapId: string;
  userId: string;
  role: (typeof MAP_VIEWER_ROLE)[number];
  permission: (typeof PERMISSION)[number];
  createdAt: Date;
}

export const insertMapViewerSchema = z.object({
  mapId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(MAP_VIEWER_ROLE).optional(),
  permission: z.enum(PERMISSION).optional(),
});
export type InsertMapViewer = z.infer<typeof insertMapViewerSchema>;

export interface MapInvitation {
  id: string;
  mapId: string;
  email: string;
  permission: (typeof PERMISSION)[number];
  invitedBy: string;
  status: (typeof INVITATION_STATUS)[number];
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export const insertMapInvitationSchema = z.object({
  mapId: z.string().min(1),
  email: z.string().email(),
  permission: z.enum(PERMISSION),
  invitedBy: z.string().min(1),
  token: z.string().min(1),
  expiresAt: z.date(),
});
export type InsertMapInvitation = z.infer<typeof insertMapInvitationSchema>;

export * from "./enums.js";
