import type {
  CuratedCategory,
  CuratedCountry,
  InvitationStatus,
  MapViewerRole,
  Permission,
  PinColor,
  PinIcon,
  TemplateIcon,
  UserGroup,
} from "./enums.js";

/**
 * Custom fields added to directus_users to support Clerk-backed accounts and
 * PinTogather's own profile/permission data. Panel logins (none expected in
 * normal use) stay native Directus accounts; every end user is synced from
 * Clerk and carries the fields below.
 */
export interface DirectusUsersCustomFields {
  clerk_user_id: string | null;
  avatar_url: string | null;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  twitter_handle: string | null;
  instagram_handle: string | null;
  linkedin_handle: string | null;
  user_group: UserGroup;
  is_admin: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  ai_suggestions_used_today: number;
  ai_suggestions_reset_at: string | null;
}

export interface DirectusUser extends DirectusUsersCustomFields {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
  status: "active" | "invited" | "draft" | "suspended" | "archived";
  role: string | null;
}

export interface MapCollection {
  id: string;
  name: string;
  description: string | null;
  share_url: string;
  owner: string | null;
  is_public: boolean;
  default_permission: Permission;
  note_label: string | null;
  note_prompt: string | null;
  branding_logo_url: string | null;
  /** Whether this map appears on the owner's public profile page (/u/:username). */
  show_on_profile: boolean;
  /** Soft-hide: excluded from home/profile listings but not deleted. */
  archived: boolean;
  default_pin_color: PinColor | null;
  default_pin_icon: PinIcon | null;
  curated: boolean;
  curated_category: CuratedCategory | null;
  curated_country: CuratedCountry | null;
  curated_city: string | null;
  curated_order: number | null;
  curated_tagline: string | null;
  /** Set once at clone time (POST /api/maps/:shareUrl/clone); never editable afterward. Null if this map wasn't cloned, or its original was deleted. */
  forked_from_map: string | null;
  /** Private, owner-only organization folder this map is filed under. Never exposed to non-owners. */
  folder: string | null;
  date_created: string;
}

export interface Pin {
  id: string;
  map: string;
  user: string | null;
  user_name: string;
  latitude: string;
  longitude: string;
  address: string | null;
  city: string | null;
  state: string | null;
  town: string | null;
  borough: string | null;
  postcode: string | null;
  country: string | null;
  twitter_handle: string | null;
  instagram_handle: string | null;
  linkedin_handle: string | null;
  note: string | null;
  google_maps_url: string | null;
  photo_url: string | null;
  approved: boolean;
  sequence: number | null;
  pin_color: PinColor | null;
  pin_icon: PinIcon | null;
  date_created: string;
}

export interface MapViewer {
  id: string;
  map: string;
  user: string;
  role: MapViewerRole;
  permission: Permission;
  date_created: string;
}

export interface MapInvitation {
  id: string;
  map: string;
  email: string;
  permission: Permission;
  invited_by: string | null;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  date_created: string;
}

export interface UserFollow {
  id: string;
  follower: string;
  following: string;
  date_created: string;
}

export interface MapLike {
  id: string;
  user: string;
  map: string;
  date_created: string;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  content: string | null;
  published: boolean;
  nav_order: number | null;
  date_created: string;
  date_updated: string | null;
}

/**
 * A private, owner-only folder for organizing one's own maps. Nested
 * (parent_folder is self-referencing) to arbitrary depth. Never exposed in
 * any public-facing response — only the owner can ever see/manage their own.
 */
export interface Folder {
  id: string;
  name: string;
  owner: string;
  parent_folder: string | null;
  date_created: string;
}

/**
 * A starter preset shown in the create-map template picker. Authored
 * directly in Directus — see directus/src/content/seed-map-templates.ts for
 * the original migrated set, GET /api/map-templates for how the app reads it.
 */
export interface MapTemplate {
  id: string;
  key: string;
  icon: TemplateIcon;
  label: string;
  tagline: string;
  suggested_name: string;
  suggested_description: string | null;
  note_label: string | null;
  note_prompt: string | null;
  default_pin_color: PinColor | null;
  default_pin_icon: PinIcon | null;
  published: boolean;
  sort_order: number | null;
  date_created: string;
  date_updated: string | null;
}

/**
 * The full PinTogather Directus schema, keyed by collection name. Pass this
 * as the generic to `createDirectus<PinTogatherSchema>(url)` so every SDK
 * call (items, aggregate, etc.) is fully typed end-to-end.
 */
export interface PinTogatherSchema {
  directus_users: DirectusUser[];
  map_collections: MapCollection[];
  pins: Pin[];
  map_viewers: MapViewer[];
  map_invitations: MapInvitation[];
  user_follows: UserFollow[];
  map_likes: MapLike[];
  pintogather_pages: Page[];
  map_folders: Folder[];
  pintogather_map_templates: MapTemplate[];
}
