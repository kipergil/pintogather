import type { InvitationStatus, MapViewerRole, Permission, UserGroup } from "./enums.js";

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
  twitter_handle: string | null;
  instagram_handle: string | null;
  linkedin_handle: string | null;
  user_group: UserGroup;
  is_admin: boolean;
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
}
