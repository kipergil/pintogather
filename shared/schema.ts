import { z } from "zod";
import {
  CURATED_CATEGORY,
  CURATED_CITY_BY_COUNTRY,
  CURATED_COUNTRY,
  INVITATION_STATUS,
  MAP_VIEWER_ROLE,
  PERMISSION,
  PIN_COLOR,
  PIN_ICON,
  USER_GROUP,
  VENUE_TYPE,
} from "./enums.js";
import type { TemplateIcon } from "./enums.js";

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
  /** Public profile handle, e.g. /u/<username>. Null until claimed. */
  username: string | null;
  /** Short bio shown on the public profile page. */
  bio: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  linkedinHandle: string | null;
  userGroup: (typeof USER_GROUP)[number];
  isAdmin: boolean;
  /** Stripe Customer id, set on first checkout. Null until the user has ever started a subscription. */
  stripeCustomerId: string | null;
  /** Stripe Subscription id for the user's current/most recent subscription, if any. */
  stripeSubscriptionId: string | null;
  /** Stripe subscription status (e.g. "active", "past_due", "canceled") — kept alongside userGroup, which is the actual tier gate. */
  stripeSubscriptionStatus: string | null;
}

export interface UpsertUser {
  clerkUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

/** 3-30 chars, lowercase letters/numbers/underscores, must start with a letter. */
export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;

export const updateProfileSchema = z.object({
  fullName: z.string().min(1),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_PATTERN, "Use 3-30 lowercase letters, numbers, or underscores, starting with a letter.")
    .nullable()
    .optional(),
  bio: z.string().trim().max(160).nullable().optional(),
  twitterHandle: z.string().trim().nullable().optional(),
  instagramHandle: z.string().trim().nullable().optional(),
  linkedinHandle: z.string().trim().nullable().optional(),
});
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

/** Public-facing view of a user's profile, exposed at GET /api/profile/:username. */
export interface PublicProfile {
  id: string;
  username: string;
  fullName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  linkedinHandle: string | null;
  followerCount: number;
  followingCount: number;
  /** Whether the signed-in viewer follows this profile. Always false for anonymous visitors or the profile's own owner. */
  isFollowedByViewer: boolean;
  maps: Array<{
    id: string;
    name: string;
    description: string | null;
    shareUrl: string;
    brandingLogoUrl: string | null;
    pinCount: number;
    likeCount: number;
    /** Whether the signed-in viewer has liked this map. Always false for anonymous visitors. */
    likedByViewer: boolean;
    createdAt: Date;
  }>;
}

/** One user following another. */
export interface UserFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

/** A user's like on a map. */
export interface MapLike {
  id: string;
  userId: string;
  mapId: string;
  createdAt: Date;
}

/** A single map card in the /feed page — a map owned by someone the viewer follows, or the pingather system account. */
export interface FeedMapItem {
  id: string;
  name: string;
  description: string | null;
  shareUrl: string;
  brandingLogoUrl: string | null;
  pinCount: number;
  likeCount: number;
  likedByViewer: boolean;
  ownerId: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  createdAt: Date;
}

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
  /** Custom logo shown instead of PinGather branding on this map's public /p/:shareUrl page. */
  brandingLogoUrl: string | null;
  /** Whether this map appears on the owner's public profile page (/u/:username). Independent of isPublic/defaultPermission, which govern anonymous edit access via the share link. */
  showOnProfile: boolean;
  /** Soft-hide (Basic/Premium only): excluded from the owner's home-page list and public profile, but the map and its pins are untouched and still reachable via its share link. */
  archived: boolean;
  /** Default marker color for this map's pins (Basic/Premium only) — falls back to the app default (blue) when null. A pin's own pinColor, if set, overrides this. */
  defaultPinColor: (typeof PIN_COLOR)[number] | null;
  /** Default marker icon glyph for this map's pins (Basic/Premium only) — falls back to a plain pin when null. A pin's own pinIcon, if set, overrides this. */
  defaultPinIcon: (typeof PIN_ICON)[number] | null;
  /**
   * Curated-map fields (/discover page) — admin-managed directly in Directus,
   * never through the app's own map-create/edit forms, so these are absent
   * from insertMapCollectionSchema/updateMapDetailsSchema below on purpose.
   */
  curated: boolean;
  curatedCategory: (typeof CURATED_CATEGORY)[number] | null;
  curatedCountry: (typeof CURATED_COUNTRY)[number] | null;
  curatedCity: string | null;
  /** Display order among curated maps — also determines which 3 freemium/anonymous visitors see. Lower shows first. */
  curatedOrder: number | null;
  /** Short editorial blurb shown on the Discover card, distinct from the map's own owner-written description. */
  curatedTagline: string | null;
  /**
   * Set once, at clone time (POST /api/maps/:shareUrl/clone) — never
   * accepted through insertMapCollectionSchema/updateMapDetailsSchema, so a
   * clone can't quietly disown its original after creation. Null if this
   * map wasn't cloned from another, or its original has since been deleted.
   */
  forkedFromMapId: string | null;
  /** Private, owner-only organization folder this map is filed under. Never shown to anyone but the owner, on any public page or response. Null means unfiled (shows at the root level). */
  folderId: string | null;
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
  showOnProfile: z.boolean().optional(),
  defaultPinColor: z.enum(PIN_COLOR).nullable().optional(),
  defaultPinIcon: z.enum(PIN_ICON).nullable().optional(),
});
export type InsertMapCollection = z.infer<typeof insertMapCollectionSchema>;

export const updateMapDetailsSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  noteLabel: z.string().trim().max(60).nullable().optional(),
  notePrompt: z.string().trim().nullable().optional(),
  brandingLogoUrl: z.string().trim().max(500).nullable().optional(),
  defaultPinColor: z.enum(PIN_COLOR).nullable().optional(),
  defaultPinIcon: z.enum(PIN_ICON).nullable().optional(),
  showOnProfile: z.boolean().optional(),
  /** Move this map into a folder (or back to the root level with null). Ownership of the target folder is checked server-side. */
  folderId: z.string().nullable().optional(),
});
export type UpdateMapDetails = z.infer<typeof updateMapDetailsSchema>;

/**
 * Admin-only: converts an existing map (any owner) into a curated /discover
 * entry, or edits/un-curates one already curated. Kept separate from
 * updateMapDetailsSchema, which deliberately never accepts curated fields —
 * this one is only ever reached through the admin-gated
 * PUT /api/admin/maps/:mapId/curate route, never the owner's own edit form.
 * The map's owner is never touched, so credit stays with whoever made it.
 */
export const curateMapSchema = z
  .object({
    curated: z.boolean(),
    curatedCategory: z.enum(CURATED_CATEGORY).nullable().optional(),
    curatedCountry: z.enum(CURATED_COUNTRY).nullable().optional(),
    curatedCity: z.string().trim().max(100).nullable().optional(),
    curatedOrder: z.number().int().nullable().optional(),
    curatedTagline: z.string().trim().max(200).nullable().optional(),
  })
  .refine((data) => !data.curated || !!(data.curatedCategory && data.curatedCountry && data.curatedCity), {
    message: "Category, country, and city are required to curate a map.",
    path: ["curatedCategory"],
  })
  .refine(
    (data) =>
      !data.curatedCountry || !data.curatedCity || (CURATED_CITY_BY_COUNTRY[data.curatedCountry] as readonly string[]).includes(data.curatedCity),
    { message: "That city isn't one of the selected country's known cities.", path: ["curatedCity"] },
  );
export type CurateMap = z.infer<typeof curateMapSchema>;

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
  googleMapsUrl: string | null;
  photoUrl: string | null;
  /** Google Places primary type for the venue (e.g. "restaurant", "cafe", "museum") — set automatically when the pin is added via venue search, null for map-click pins. */
  venueType: (typeof VENUE_TYPE)[number] | null;
  /** Google Places price level, 0 (free) to 4 ($$$$) — null when not returned (e.g. most non-commercial venues) or for map-click pins. */
  priceLevel: number | null;
  /** The venue's own website, from Google Places — null for map-click pins or venues without one on file. */
  website: string | null;
  /** Google's own one-line description of the venue (Places' "editorial summary") — distinct from the contributor's own note. */
  editorialSummary: string | null;
  approved: boolean;
  /** Per-pin marker color override (Basic/Premium map owners only) — overrides the map's defaultPinColor when set. */
  pinColor: (typeof PIN_COLOR)[number] | null;
  /** Per-pin marker icon glyph override (Basic/Premium map owners only) — overrides the map's defaultPinIcon when set. */
  pinIcon: (typeof PIN_ICON)[number] | null;
  /** Position in this map's route/itinerary order — see the reorder endpoint. Ties fall back to createdAt order. */
  sequence: number | null;
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
  googleMapsUrl: z.string().trim().max(500).nullable().optional(),
  photoUrl: z.string().trim().max(500).nullable().optional(),
  venueType: z.enum(VENUE_TYPE).nullable().optional(),
  priceLevel: z.number().int().min(0).max(4).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  editorialSummary: z.string().trim().max(1000).nullable().optional(),
  approved: z.boolean().optional(),
  pinColor: z.enum(PIN_COLOR).nullable().optional(),
  pinIcon: z.enum(PIN_ICON).nullable().optional(),
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

/**
 * A private, owner-only folder for organizing one's own maps — purely
 * personal map management, never shown to anyone but the owner on any
 * public page or API response. Nested: parentFolderId is self-referencing,
 * to arbitrary depth.
 */
export interface Folder {
  id: string;
  name: string;
  ownerId: string;
  parentFolderId: string | null;
  createdAt: Date;
}

export const insertFolderSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentFolderId: z.string().nullable().optional(),
});
export type InsertFolder = z.infer<typeof insertFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  parentFolderId: z.string().nullable().optional(),
});
export type UpdateFolder = z.infer<typeof updateFolderSchema>;

/** A CMS page — a static marketing page or (later) a blog post, rendered by slug. Authored in the Directus admin panel; the app only ever reads published pages. */
export interface Page {
  id: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  content: string | null;
  navOrder: number | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * A starter preset shown in the create-map template picker. Authored
 * directly in the Directus admin panel — the app only ever reads published
 * templates (GET /api/map-templates). Picking one just prefills the
 * create-map form's initial values; nothing here is persisted onto the map.
 */
export interface MapTemplate {
  id: string;
  /** Stable identifier (e.g. "weekend-trip") — for data-testids, never shown to end users. */
  key: string;
  icon: TemplateIcon;
  label: string;
  tagline: string;
  suggestedName: string;
  suggestedDescription: string | null;
  noteLabel: string | null;
  notePrompt: string | null;
  defaultPinColor: (typeof PIN_COLOR)[number] | null;
  defaultPinIcon: (typeof PIN_ICON)[number] | null;
}

export * from "./enums.js";
