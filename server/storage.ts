import {
  createFolder,
  createItem,
  createItems,
  deleteItem,
  readFolders,
  readItems,
  readUsers,
  updateItem,
  updateItems,
  updateUser,
  uploadFiles,
} from "@directus/sdk";
import { nanoid } from "nanoid";
import type { UserGroup } from "../shared/enums.js";
import type {
  Folder,
  MapCollection,
  MapInvitation,
  MapLike,
  MapTemplate,
  MapViewer,
  Page,
  Pin,
  CurateMap,
  InsertFolder,
  InsertMapCollection,
  InsertMapInvitation,
  InsertMapViewer,
  InsertPin,
  UpdateFolder,
  UpdateMapDetails,
  UpdateProfile,
  User,
  UserFollow,
} from "../shared/schema.js";
import type {
  Folder as DirectusFolder,
  MapCollection as DirectusMapCollection,
  MapInvitation as DirectusMapInvitation,
  MapLike as DirectusMapLike,
  MapTemplate as DirectusMapTemplate,
  MapViewer as DirectusMapViewer,
  Page as DirectusPage,
  Pin as DirectusPin,
  UserFollow as DirectusUserFollow,
} from "../shared/directus-schema.js";
import { getServiceDirectusClient } from "./lib/directus.js";
import { toDomainUser } from "./services/users.js";

const MAP_FIELDS = [
  "id",
  "name",
  "description",
  "share_url",
  "owner",
  "is_public",
  "default_permission",
  "note_label",
  "note_prompt",
  "branding_logo_url",
  "show_on_profile",
  "archived",
  "default_pin_color",
  "default_pin_icon",
  "require_pin_approval",
  "item_type",
  "curated",
  "curated_category",
  "curated_country",
  "curated_city",
  "curated_order",
  "curated_tagline",
  "forked_from_map",
  "folder",
  "date_created",
] as const;

const PIN_FIELDS = [
  "id",
  "map",
  "user",
  "user_name",
  "contributor_name",
  "item_type",
  "latitude",
  "longitude",
  "address",
  "city",
  "state",
  "town",
  "borough",
  "postcode",
  "country",
  "twitter_handle",
  "instagram_handle",
  "linkedin_handle",
  "note",
  "google_maps_url",
  "url",
  "photo_url",
  "venue_type",
  "price_level",
  "website",
  "editorial_summary",
  "approved",
  "pin_color",
  "pin_icon",
  "sequence",
  "date_created",
] as const;

const VIEWER_FIELDS = ["id", "map", "user", "role", "permission", "date_created"] as const;

const INVITATION_FIELDS = [
  "id",
  "map",
  "email",
  "permission",
  "invited_by",
  "status",
  "token",
  "expires_at",
  "date_created",
] as const;

const FOLLOW_FIELDS = ["id", "follower", "following", "date_created"] as const;

const LIKE_FIELDS = ["id", "user", "map", "date_created"] as const;

const PAGE_FIELDS = [
  "id",
  "slug",
  "title",
  "meta_description",
  "content",
  "published",
  "nav_order",
  "date_created",
  "date_updated",
] as const;

const MAP_TEMPLATE_FIELDS = [
  "id",
  "key",
  "icon",
  "label",
  "tagline",
  "suggested_name",
  "suggested_description",
  "note_label",
  "note_prompt",
  "default_pin_color",
  "default_pin_icon",
  "published",
  "sort_order",
  "date_created",
  "date_updated",
] as const;

const USER_FIELDS = [
  "id",
  "email",
  "first_name",
  "last_name",
  "avatar_url",
  "status",
  "role",
  "clerk_user_id",
  "full_name",
  "username",
  "bio",
  "twitter_handle",
  "instagram_handle",
  "linkedin_handle",
  "user_group",
  "is_admin",
  "stripe_customer_id",
  "stripe_subscription_id",
  "stripe_subscription_status",
] as const;

function toMapCollection(row: DirectusMapCollection): MapCollection {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    shareUrl: row.share_url,
    ownerId: row.owner,
    isPublic: row.is_public,
    defaultPermission: row.default_permission,
    noteLabel: row.note_label,
    notePrompt: row.note_prompt,
    brandingLogoUrl: row.branding_logo_url,
    showOnProfile: row.show_on_profile,
    archived: row.archived,
    defaultPinColor: row.default_pin_color,
    defaultPinIcon: row.default_pin_icon,
    requirePinApproval: row.require_pin_approval,
    itemType: row.item_type,
    curated: row.curated,
    curatedCategory: row.curated_category,
    curatedCountry: row.curated_country,
    curatedCity: row.curated_city,
    curatedOrder: row.curated_order,
    curatedTagline: row.curated_tagline,
    forkedFromMapId: row.forked_from_map,
    folderId: row.folder,
    createdAt: new Date(row.date_created),
  };
}

const FOLDER_FIELDS = ["id", "name", "owner", "parent_folder", "date_created"] as const;

function toFolder(row: DirectusFolder): Folder {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner,
    parentFolderId: row.parent_folder,
    createdAt: new Date(row.date_created),
  };
}

function toPin(row: DirectusPin): Pin {
  return {
    id: row.id,
    mapId: row.map,
    userId: row.user,
    title: row.user_name,
    contributorName: row.contributor_name,
    itemType: row.item_type,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    city: row.city,
    state: row.state,
    town: row.town,
    borough: row.borough,
    postcode: row.postcode,
    country: row.country,
    twitterHandle: row.twitter_handle,
    instagramHandle: row.instagram_handle,
    linkedinHandle: row.linkedin_handle,
    note: row.note,
    googleMapsUrl: row.google_maps_url,
    url: row.url,
    photoUrl: row.photo_url,
    venueType: row.venue_type,
    priceLevel: row.price_level,
    website: row.website,
    editorialSummary: row.editorial_summary,
    approved: row.approved,
    pinColor: row.pin_color,
    pinIcon: row.pin_icon,
    sequence: row.sequence,
    createdAt: new Date(row.date_created),
  };
}

function toDirectusPinInput(data: InsertPin) {
  return {
    map: data.mapId,
    user: data.userId ?? null,
    user_name: data.title,
    contributor_name: data.contributorName ?? null,
    item_type: data.itemType ?? "location",
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    address: data.address ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    town: data.town ?? null,
    borough: data.borough ?? null,
    postcode: data.postcode ?? null,
    country: data.country ?? null,
    twitter_handle: data.twitterHandle ?? null,
    instagram_handle: data.instagramHandle ?? null,
    linkedin_handle: data.linkedinHandle ?? null,
    note: data.note ?? null,
    google_maps_url: data.googleMapsUrl ?? null,
    url: data.url ?? null,
    photo_url: data.photoUrl ?? null,
    venue_type: data.venueType ?? null,
    price_level: data.priceLevel ?? null,
    website: data.website ?? null,
    editorial_summary: data.editorialSummary ?? null,
    approved: data.approved ?? true,
    pin_color: data.pinColor ?? null,
    pin_icon: data.pinIcon ?? null,
  };
}

function toMapViewer(row: DirectusMapViewer): MapViewer {
  return {
    id: row.id,
    mapId: row.map,
    userId: row.user,
    role: row.role,
    permission: row.permission,
    createdAt: new Date(row.date_created),
  };
}

function toUserFollow(row: DirectusUserFollow): UserFollow {
  return {
    id: row.id,
    followerId: row.follower,
    followingId: row.following,
    createdAt: new Date(row.date_created),
  };
}

function toMapLike(row: DirectusMapLike): MapLike {
  return {
    id: row.id,
    userId: row.user,
    mapId: row.map,
    createdAt: new Date(row.date_created),
  };
}

function toPage(row: DirectusPage): Page {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    metaDescription: row.meta_description,
    content: row.content,
    navOrder: row.nav_order,
    createdAt: new Date(row.date_created),
    updatedAt: row.date_updated ? new Date(row.date_updated) : null,
  };
}

function toMapTemplate(row: DirectusMapTemplate): MapTemplate {
  return {
    id: row.id,
    key: row.key,
    icon: row.icon,
    label: row.label,
    tagline: row.tagline,
    suggestedName: row.suggested_name,
    suggestedDescription: row.suggested_description,
    noteLabel: row.note_label,
    notePrompt: row.note_prompt,
    defaultPinColor: row.default_pin_color,
    defaultPinIcon: row.default_pin_icon,
  };
}

function toMapInvitation(row: DirectusMapInvitation): MapInvitation {
  return {
    id: row.id,
    mapId: row.map,
    email: row.email,
    permission: row.permission,
    invitedBy: row.invited_by ?? "",
    status: row.status,
    token: row.token,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.date_created),
  };
}

export interface IStorage {
  // Map Collections
  createMapCollection(data: InsertMapCollection): Promise<MapCollection>;
  /** Creates a new map owned by opts.ownerId, forked from `source`, with sourcePins copied in as fresh, independently-owned pins. */
  cloneMapCollection(
    source: MapCollection,
    sourcePins: Pin[],
    opts: { ownerId: string; name: string; includePinStyle: boolean },
  ): Promise<{ map: MapCollection; pins: Pin[] }>;
  getMapCollectionByShareUrl(shareUrl: string): Promise<MapCollection | undefined>;
  getMapCollectionByName(name: string): Promise<MapCollection | undefined>;
  getMapCollectionById(mapId: string): Promise<MapCollection | undefined>;
  getAllMapCollections(): Promise<MapCollection[]>;
  /** Omit `opts.archived` for all owned maps regardless of archived status; pass true/false to filter to just one. */
  getMapCollectionsByUserId(userId: string, opts?: { archived?: boolean }): Promise<MapCollection[]>;
  getMapCollectionsForUser(userId: string): Promise<MapCollection[]>;
  getPublicMapsByUserId(userId: string): Promise<MapCollection[]>;
  /** Public (show_on_profile, not archived) maps owned by any of the given users, newest first — powers /feed. */
  getPublicMapsByOwnerIds(ownerIds: string[]): Promise<MapCollection[]>;
  /** Every curated map (curated=true), sorted by curatedOrder, optionally narrowed by category/country/city — powers /discover. Unfiltered by viewer/tier; that gating happens in the route. */
  getCuratedMapCollections(filters?: { category?: string; country?: string; city?: string }): Promise<MapCollection[]>;
  getContributedMaps(userId: string): Promise<MapCollection[]>;
  /** Every non-archived public map's id, system-wide — the "anyone can find this" half of search's access scope. */
  getPublicMapIds(): Promise<string[]>;
  /** Every map id this user has been granted viewer/contributor access to (an accepted invitation) — the other half of search's access scope, alongside owned and public maps. */
  getViewerMapIds(userId: string): Promise<string[]>;
  /** Maps matching query (name/description) restricted to accessibleMapIds — the caller computes accessibility (public ∪ owned ∪ viewer) via getPublicMapIds/getViewerMapIds. Powers /search. */
  searchMapCollections(query: string, accessibleMapIds: string[]): Promise<MapCollection[]>;
  /** Pins matching query (name/note/address/city). ownedMapIds get every pin (including pending); otherMapIds (public or invited, not owned) only return approved pins. Powers /search. */
  searchPins(query: string, ownedMapIds: string[], otherMapIds: string[]): Promise<Pin[]>;
  /** Bulk-sets `archived` on maps this user owns; silently ignores any requested id the user doesn't own. Returns the ids actually updated. */
  setMapsArchived(mapIds: string[], userId: string, archived: boolean): Promise<string[]>;
  updateMapPermissions(
    mapId: string,
    isPublic: boolean,
    defaultPermission: string,
  ): Promise<MapCollection | undefined>;
  updateMapDetails(mapId: string, data: UpdateMapDetails): Promise<MapCollection | undefined>;
  /** Admin-only: sets/clears a map's curated /discover fields. Never touches owner. */
  updateMapCuration(mapId: string, data: CurateMap): Promise<MapCollection | undefined>;
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
  createPins(data: InsertPin[]): Promise<Pin[]>;
  upsertPins(
    mapId: string,
    data: InsertPin[],
    opts?: { maxNewPins?: number },
  ): Promise<{ created: Pin[]; updated: Pin[]; skippedDueToLimit: number }>;
  getPinsByMapId(mapId: string): Promise<Pin[]>;
  getPinById(id: string): Promise<Pin | undefined>;
  updatePin(id: string, data: Partial<InsertPin>): Promise<Pin | undefined>;
  /** Sets each pin's `sequence` to its index in the given order — powers the route/itinerary view's drag-to-reorder. */
  reorderPins(orderedPinIds: string[]): Promise<void>;
  deletePin(id: string, userId?: string): Promise<boolean>;

  // Admin & profile
  isAdmin(userId: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUserProfile(userId: string): Promise<User | undefined>;
  updateUserGroup(userId: string, userGroup: UserGroup): Promise<User | undefined>;
  updateProfile(userId: string, data: UpdateProfile): Promise<User | undefined>;
  updateStripeSubscription(
    userId: string,
    data: { stripeCustomerId?: string; stripeSubscriptionId?: string | null; stripeSubscriptionStatus?: string | null; userGroup?: UserGroup },
  ): Promise<User | undefined>;

  // Uploads
  uploadUserLogo(userId: string, file: UploadableFile): Promise<string>;
  uploadVenueScreenshot(userId: string, file: UploadableFile): Promise<string>;
  /** null uploaderId covers pins added by a signed-out visitor — pin creation doesn't require an account. */
  uploadPinPhoto(uploaderId: string | null, file: UploadableFile): Promise<string>;

  // Follows
  followUser(followerId: string, followingId: string): Promise<UserFollow>;
  unfollowUser(followerId: string, followingId: string): Promise<boolean>;
  getFollowRelation(followerId: string, followingId: string): Promise<UserFollow | undefined>;
  getFollowerCount(userId: string): Promise<number>;
  getFollowingCount(userId: string): Promise<number>;
  /** ids of every user this user follows — the feed's source list. */
  getFollowingIds(userId: string): Promise<string[]>;

  // Likes
  likeMap(userId: string, mapId: string): Promise<MapLike>;
  unlikeMap(userId: string, mapId: string): Promise<boolean>;
  /** Bulk like counts, keyed by mapId — avoids one query per map on list pages. */
  getMapLikeCounts(mapIds: string[]): Promise<Record<string, number>>;
  /** Which of the given maps this user has liked. */
  getUserLikedMapIds(userId: string, mapIds: string[]): Promise<Set<string>>;

  // Pages (CMS)
  /** Published pages only, sorted by navOrder (nulls last) then title — powers the site nav/footer link list. */
  getPublishedPages(): Promise<Page[]>;
  /** A single published page by slug, or undefined if it doesn't exist or isn't published. */
  getPublishedPageBySlug(slug: string): Promise<Page | undefined>;

  // Map templates (create-map picker)
  /** Published templates only, sorted by sortOrder (nulls last) then label — powers the create-map "What are you mapping?" picker. */
  getPublishedMapTemplates(): Promise<MapTemplate[]>;

  // Folders (private, owner-only map organization)
  createFolder(data: InsertFolder & { ownerId: string }): Promise<Folder>;
  getFolderById(id: string): Promise<Folder | undefined>;
  /** Every folder this user owns, flat (unordered by nesting) — the client assembles the tree from parentFolderId. */
  getFoldersByOwner(ownerId: string): Promise<Folder[]>;
  updateFolder(id: string, data: UpdateFolder): Promise<Folder | undefined>;
  /** Deleting a folder promotes its subfolders and maps back to the root level (SET NULL), rather than deleting them. */
  deleteFolder(id: string): Promise<boolean>;
}

export interface UploadableFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/** Root folder (no parent) all per-user branding-logo subfolders live under. */
const LOGO_ROOT_FOLDER_NAME = "map-logos";

/** Root folder (no parent) all per-uploader pin-photo subfolders live under. */
const PIN_PHOTO_ROOT_FOLDER_NAME = "pin-photos";

/** Subfolder name (nested under each user's own top-level folder) that AI-import screenshots are uploaded into. */
const VENUE_SCREENSHOT_SUBFOLDER_NAME = "uploads";

class DirectusStorage implements IStorage {
  private get client() {
    return getServiceDirectusClient();
  }

  async createMapCollection(data: InsertMapCollection): Promise<MapCollection> {
    const shareUrl = nanoid(12);
    const created = await this.client.request(
      createItem(
        "map_collections",
        {
          name: data.name,
          description: data.description ?? null,
          share_url: shareUrl,
          owner: data.ownerId ?? null,
          // Defaults to true: this app's core flow is "share the link,
          // anyone can view/contribute" — isPublic:false is an explicit
          // opt-in an owner makes afterward (see PUT /api/maps/:mapId/permissions),
          // not something a brand-new map should start locked behind.
          is_public: data.isPublic ?? true,
          default_permission: data.defaultPermission ?? "readonly",
          note_label: data.noteLabel ?? null,
          note_prompt: data.notePrompt ?? null,
          branding_logo_url: data.brandingLogoUrl ?? null,
          show_on_profile: data.showOnProfile ?? false,
          default_pin_color: data.defaultPinColor ?? null,
          default_pin_icon: data.defaultPinIcon ?? null,
          require_pin_approval: data.requirePinApproval ?? true,
          item_type: data.itemType ?? "location",
        },
        { fields: MAP_FIELDS },
      ),
    );
    return toMapCollection(created as unknown as DirectusMapCollection);
  }

  /**
   * Creates a new map owned by `opts.ownerId`, permanently linked back to
   * `source` via forked_from_map, then copies `sourcePins` into it as fresh,
   * independently-owned pins (userId cleared — the original contributors
   * never consented to their pin living on someone else's map; the new
   * owner can already edit every pin in their own map regardless). Map
   * settings that describe *how the map behaves* (note label/prompt,
   * default permission, default pin color/icon) carry over; ones that are
   * personal/administrative to the original owner (branding logo,
   * show-on-profile, archived, curated) deliberately don't.
   */
  async cloneMapCollection(
    source: MapCollection,
    sourcePins: Pin[],
    opts: { ownerId: string; name: string; includePinStyle: boolean },
  ): Promise<{ map: MapCollection; pins: Pin[] }> {
    const shareUrl = nanoid(12);
    const createdMap = await this.client.request(
      createItem(
        "map_collections",
        {
          name: opts.name,
          description: source.description ?? null,
          share_url: shareUrl,
          owner: opts.ownerId,
          is_public: true,
          default_permission: source.defaultPermission,
          note_label: source.noteLabel,
          note_prompt: source.notePrompt,
          branding_logo_url: null,
          show_on_profile: false,
          default_pin_color: source.defaultPinColor,
          default_pin_icon: source.defaultPinIcon,
          require_pin_approval: source.requirePinApproval,
          item_type: source.itemType,
          forked_from_map: source.id,
        },
        { fields: MAP_FIELDS },
      ),
    );
    const map = toMapCollection(createdMap as unknown as DirectusMapCollection);

    if (sourcePins.length === 0) return { map, pins: [] };

    const pinPayloads = sourcePins.map((pin) => ({
      map: map.id,
      user: null,
      user_name: pin.title,
      contributor_name: null,
      item_type: pin.itemType,
      latitude: pin.latitude,
      longitude: pin.longitude,
      address: pin.address,
      city: pin.city,
      state: pin.state,
      town: pin.town,
      borough: pin.borough,
      postcode: pin.postcode,
      country: pin.country,
      twitter_handle: pin.twitterHandle,
      instagram_handle: pin.instagramHandle,
      linkedin_handle: pin.linkedinHandle,
      note: pin.note,
      google_maps_url: pin.googleMapsUrl,
      url: pin.url,
      photo_url: pin.photoUrl,
      approved: true,
      pin_color: opts.includePinStyle ? pin.pinColor : null,
      pin_icon: opts.includePinStyle ? pin.pinIcon : null,
      sequence: pin.sequence,
    }));
    const createdPins = await this.client.request(createItems("pins", pinPayloads, { fields: PIN_FIELDS }));
    return { map, pins: (createdPins as unknown as DirectusPin[]).map(toPin) };
  }

  async getMapCollectionByShareUrl(shareUrl: string): Promise<MapCollection | undefined> {
    const rows = await this.client.request(
      readItems("map_collections", { filter: { share_url: { _eq: shareUrl } }, fields: MAP_FIELDS, limit: 1 }),
    );
    const row = rows[0] as DirectusMapCollection | undefined;
    return row ? toMapCollection(row) : undefined;
  }

  async getMapCollectionByName(name: string): Promise<MapCollection | undefined> {
    const rows = await this.client.request(
      readItems("map_collections", { filter: { name: { _eq: name } }, fields: MAP_FIELDS, limit: 1 }),
    );
    const row = rows[0] as DirectusMapCollection | undefined;
    return row ? toMapCollection(row) : undefined;
  }

  async getAllMapCollections(): Promise<MapCollection[]> {
    const rows = await this.client.request(
      readItems("map_collections", { fields: MAP_FIELDS, sort: ["-date_created"], limit: -1 }),
    );
    return (rows as DirectusMapCollection[]).map(toMapCollection);
  }

  async getMapCollectionsByUserId(userId: string, opts?: { archived?: boolean }): Promise<MapCollection[]> {
    const filter: Record<string, unknown> = { owner: { _eq: userId } };
    if (opts?.archived !== undefined) filter.archived = { _eq: opts.archived };

    const rows = await this.client.request(
      readItems("map_collections", {
        filter,
        fields: MAP_FIELDS,
        sort: ["-date_created"],
        limit: -1,
      }),
    );
    return (rows as DirectusMapCollection[]).map(toMapCollection);
  }

  async getMapCollectionsForUser(userId: string): Promise<MapCollection[]> {
    // Archived maps are the owner's own housekeeping — deliberately excluded
    // from this "everything I can see" listing, same as the home page.
    const ownedMaps = await this.getMapCollectionsByUserId(userId, { archived: false });
    const contributedMaps = await this.getContributedMaps(userId);
    const uniqueMaps = new Map<string, MapCollection>();
    for (const map of [...ownedMaps, ...contributedMaps]) uniqueMaps.set(map.id, map);
    return Array.from(uniqueMaps.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getContributedMaps(userId: string): Promise<MapCollection[]> {
    const contributedPins = await this.client.request(
      readItems("pins", { filter: { user: { _eq: userId } }, fields: ["map"], limit: -1 }),
    );
    const mapIds = Array.from(new Set((contributedPins as Array<{ map: string }>).map((p) => p.map)));
    if (mapIds.length === 0) return [];

    const rows = await this.client.request(
      readItems("map_collections", {
        filter: { id: { _in: mapIds }, owner: { _neq: userId } },
        fields: MAP_FIELDS,
        limit: -1,
      }),
    );
    return (rows as DirectusMapCollection[])
      .map(toMapCollection)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPublicMapIds(): Promise<string[]> {
    const rows = await this.client.request(
      readItems("map_collections", {
        filter: { is_public: { _eq: true }, archived: { _eq: false } },
        fields: ["id"],
        limit: -1,
      }),
    );
    return (rows as Array<{ id: string }>).map((r) => r.id);
  }

  async getViewerMapIds(userId: string): Promise<string[]> {
    const rows = await this.client.request(
      readItems("map_viewers", { filter: { user: { _eq: userId } }, fields: ["map"], limit: -1 }),
    );
    return Array.from(new Set((rows as Array<{ map: string }>).map((r) => r.map)));
  }

  async searchMapCollections(query: string, accessibleMapIds: string[]): Promise<MapCollection[]> {
    if (accessibleMapIds.length === 0) return [];
    const rows = await this.client.request(
      readItems("map_collections", {
        filter: {
          id: { _in: accessibleMapIds },
          archived: { _eq: false },
          _or: [{ name: { _icontains: query } }, { description: { _icontains: query } }],
        },
        fields: MAP_FIELDS,
        sort: ["-date_created"],
        limit: 20,
      }),
    );
    return (rows as DirectusMapCollection[]).map(toMapCollection);
  }

  async searchPins(query: string, ownedMapIds: string[], otherMapIds: string[]): Promise<Pin[]> {
    const textOr = [
      { user_name: { _icontains: query } },
      { note: { _icontains: query } },
      { address: { _icontains: query } },
      { city: { _icontains: query } },
    ];
    const results: DirectusPin[] = [];
    if (ownedMapIds.length > 0) {
      const rows = await this.client.request(
        readItems("pins", {
          filter: { map: { _in: ownedMapIds }, _or: textOr },
          fields: PIN_FIELDS,
          sort: ["-date_created"],
          limit: 20,
        }),
      );
      results.push(...(rows as DirectusPin[]));
    }
    if (otherMapIds.length > 0) {
      const rows = await this.client.request(
        readItems("pins", {
          filter: { map: { _in: otherMapIds }, approved: { _eq: true }, _or: textOr },
          fields: PIN_FIELDS,
          sort: ["-date_created"],
          limit: 20,
        }),
      );
      results.push(...(rows as DirectusPin[]));
    }
    return results.slice(0, 20).map(toPin);
  }

  async updateMapPermissions(
    mapId: string,
    isPublic: boolean,
    defaultPermission: string,
  ): Promise<MapCollection | undefined> {
    try {
      const updated = await this.client.request(
        updateItem(
          "map_collections",
          mapId,
          { is_public: isPublic, default_permission: defaultPermission },
          { fields: MAP_FIELDS },
        ),
      );
      return toMapCollection(updated as unknown as DirectusMapCollection);
    } catch (error) {
      console.error("Error updating map permissions:", error);
      return undefined;
    }
  }

  async updateMapDetails(mapId: string, data: UpdateMapDetails): Promise<MapCollection | undefined> {
    try {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.description !== undefined) payload.description = data.description;
      if (data.noteLabel !== undefined) payload.note_label = data.noteLabel || null;
      if (data.notePrompt !== undefined) payload.note_prompt = data.notePrompt || null;
      if (data.brandingLogoUrl !== undefined) payload.branding_logo_url = data.brandingLogoUrl || null;
      if (data.showOnProfile !== undefined) payload.show_on_profile = data.showOnProfile;
      if (data.defaultPinColor !== undefined) payload.default_pin_color = data.defaultPinColor;
      if (data.defaultPinIcon !== undefined) payload.default_pin_icon = data.defaultPinIcon;
      if (data.requirePinApproval !== undefined) payload.require_pin_approval = data.requirePinApproval;
      if (data.folderId !== undefined) payload.folder = data.folderId;

      const updated = await this.client.request(updateItem("map_collections", mapId, payload, { fields: MAP_FIELDS }));
      return toMapCollection(updated as unknown as DirectusMapCollection);
    } catch (error) {
      console.error("Error updating map details:", error);
      return undefined;
    }
  }

  async updateMapCuration(mapId: string, data: CurateMap): Promise<MapCollection | undefined> {
    try {
      // Passed through as-is (no forced nulling when curated=false) — an
      // admin un-curating a map can leave its category/country/city/tagline
      // in place so re-curating it later doesn't mean re-entering everything.
      const payload = {
        curated: data.curated,
        curated_category: data.curatedCategory ?? null,
        curated_country: data.curatedCountry ?? null,
        curated_city: data.curatedCity ?? null,
        curated_order: data.curatedOrder ?? null,
        curated_tagline: data.curatedTagline ?? null,
      };
      const updated = await this.client.request(updateItem("map_collections", mapId, payload, { fields: MAP_FIELDS }));
      return toMapCollection(updated as unknown as DirectusMapCollection);
    } catch (error) {
      console.error("Error updating map curation:", error);
      return undefined;
    }
  }

  async deleteMapCollection(mapId: string, userId: string): Promise<boolean> {
    try {
      const rows = await this.client.request(
        readItems("map_collections", { filter: { id: { _eq: mapId } }, fields: ["id", "owner"], limit: 1 }),
      );
      const map = rows[0] as { id: string; owner: string | null } | undefined;
      if (!map) return false;
      if (map.owner !== userId) return false;

      // Pins, map_viewers and map_invitations relations are all onDelete
      // CASCADE (see directus/src/schema/definitions.ts), so Directus
      // deletes them for us.
      await this.client.request(deleteItem("map_collections", mapId));
      return true;
    } catch (error) {
      console.error("Error deleting map collection:", error);
      return false;
    }
  }

  async addMapViewer(data: InsertMapViewer): Promise<MapViewer> {
    const created = await this.client.request(
      createItem(
        "map_viewers",
        {
          map: data.mapId,
          user: data.userId,
          role: data.role ?? "viewer",
          permission: data.permission ?? "readonly",
        },
        { fields: VIEWER_FIELDS },
      ),
    );
    return toMapViewer(created as unknown as DirectusMapViewer);
  }

  async getMapViewers(mapId: string): Promise<MapViewer[]> {
    const rows = await this.client.request(
      readItems("map_viewers", { filter: { map: { _eq: mapId } }, fields: VIEWER_FIELDS, limit: -1 }),
    );
    return (rows as DirectusMapViewer[]).map(toMapViewer);
  }

  async getUserMapAccess(userId: string, mapId: string): Promise<MapViewer | undefined> {
    const rows = await this.client.request(
      readItems("map_viewers", {
        filter: { user: { _eq: userId }, map: { _eq: mapId } },
        fields: VIEWER_FIELDS,
        limit: 1,
      }),
    );
    const row = rows[0] as DirectusMapViewer | undefined;
    return row ? toMapViewer(row) : undefined;
  }

  async updateMapViewerPermission(
    mapId: string,
    userId: string,
    permission: string,
  ): Promise<MapViewer | undefined> {
    try {
      const existing = await this.getUserMapAccess(userId, mapId);
      if (!existing) return undefined;
      const updated = await this.client.request(
        updateItem("map_viewers", existing.id, { permission }, { fields: VIEWER_FIELDS }),
      );
      return toMapViewer(updated as unknown as DirectusMapViewer);
    } catch (error) {
      console.error("Error updating map viewer permission:", error);
      return undefined;
    }
  }

  async createInvitation(data: InsertMapInvitation): Promise<MapInvitation> {
    const created = await this.client.request(
      createItem(
        "map_invitations",
        {
          map: data.mapId,
          email: data.email,
          permission: data.permission,
          invited_by: data.invitedBy,
          token: data.token,
          expires_at: data.expiresAt.toISOString(),
          status: "pending",
        },
        { fields: INVITATION_FIELDS },
      ),
    );
    return toMapInvitation(created as unknown as DirectusMapInvitation);
  }

  async getInvitationByToken(token: string): Promise<MapInvitation | undefined> {
    const rows = await this.client.request(
      readItems("map_invitations", { filter: { token: { _eq: token } }, fields: INVITATION_FIELDS, limit: 1 }),
    );
    const row = rows[0] as DirectusMapInvitation | undefined;
    return row ? toMapInvitation(row) : undefined;
  }

  async getMapInvitations(mapId: string): Promise<MapInvitation[]> {
    const rows = await this.client.request(
      readItems("map_invitations", { filter: { map: { _eq: mapId } }, fields: INVITATION_FIELDS, limit: -1 }),
    );
    return (rows as DirectusMapInvitation[]).map(toMapInvitation);
  }

  async updateInvitationStatus(id: string, status: string): Promise<MapInvitation | undefined> {
    try {
      const updated = await this.client.request(
        updateItem("map_invitations", id, { status }, { fields: INVITATION_FIELDS }),
      );
      return toMapInvitation(updated as unknown as DirectusMapInvitation);
    } catch (error) {
      console.error("Error updating invitation status:", error);
      return undefined;
    }
  }

  async deleteInvitation(id: string): Promise<boolean> {
    try {
      await this.client.request(deleteItem("map_invitations", id));
      return true;
    } catch (error) {
      console.error("Error deleting invitation:", error);
      return false;
    }
  }

  async createPin(data: InsertPin): Promise<Pin> {
    const created = await this.client.request(
      createItem("pins", toDirectusPinInput(data), { fields: PIN_FIELDS }),
    );
    return toPin(created as unknown as DirectusPin);
  }

  async createPins(data: InsertPin[]): Promise<Pin[]> {
    if (data.length === 0) return [];
    const created = await this.client.request(
      createItems("pins", data.map(toDirectusPinInput), { fields: PIN_FIELDS }),
    );
    return (created as unknown as DirectusPin[]).map(toPin);
  }

  /**
   * Bulk-imports pins into a map, matching against existing pins by name
   * (case/whitespace-insensitive) so re-importing a list — e.g. after
   * correcting a spreadsheet — refreshes the matching pin's location/address
   * instead of piling up duplicates. Anything on the existing pin outside
   * the imported fields (note, social handles, original contributor) is
   * left untouched.
   */
  async upsertPins(
    mapId: string,
    data: InsertPin[],
    opts: { maxNewPins?: number } = {},
  ): Promise<{ created: Pin[]; updated: Pin[]; skippedDueToLimit: number }> {
    const existing = await this.getPinsByMapId(mapId);
    const existingByName = new Map(existing.map((pin) => [pin.title.trim().toLowerCase(), pin]));

    // Collapse repeated names within the incoming batch itself (last one
    // wins) — otherwise pasting/uploading the same venue twice in one list
    // creates two pins instead of one, since neither would match an
    // *existing* pin yet.
    const dedupedByName = new Map<string, InsertPin>();
    for (const pin of data) {
      dedupedByName.set(pin.title.trim().toLowerCase(), pin);
    }

    let toCreate: InsertPin[] = [];
    const toUpdate: { id: string; data: InsertPin }[] = [];

    dedupedByName.forEach((pin, name) => {
      const match = existingByName.get(name);
      if (match) {
        toUpdate.push({ id: match.id, data: pin });
      } else {
        toCreate.push(pin);
      }
    });

    // Updates never count against the pins-per-map cap — only net-new pins
    // do. If the batch would create more than the remaining room, only the
    // first N (by input order) go through; the rest are silently dropped
    // and reported back as skippedDueToLimit. Clamped to >= 0 since a map
    // already at or over its cap yields a negative remaining count, which
    // would otherwise slice from the end instead of producing an empty array.
    let skippedDueToLimit = 0;
    if (opts.maxNewPins !== undefined) {
      const maxNewPins = Math.max(0, opts.maxNewPins);
      if (toCreate.length > maxNewPins) {
        skippedDueToLimit = toCreate.length - maxNewPins;
        toCreate = toCreate.slice(0, maxNewPins);
      }
    }

    const created = await this.createPins(toCreate);
    const updated: Pin[] = [];
    for (const { id, data: updateData } of toUpdate) {
      const result = await this.updatePin(id, updateData);
      if (result) updated.push(result);
    }

    return { created, updated, skippedDueToLimit };
  }

  async getPinsByMapId(mapId: string): Promise<Pin[]> {
    const rows = await this.client.request(
      readItems("pins", { filter: { map: { _eq: mapId } }, fields: PIN_FIELDS, sort: ["-date_created"], limit: -1 }),
    );
    return (rows as DirectusPin[]).map(toPin);
  }

  async getPinById(id: string): Promise<Pin | undefined> {
    const rows = await this.client.request(
      readItems("pins", { filter: { id: { _eq: id } }, fields: PIN_FIELDS, limit: 1 }),
    );
    const row = rows[0] as DirectusPin | undefined;
    return row ? toPin(row) : undefined;
  }

  async updatePin(id: string, data: Partial<InsertPin>): Promise<Pin | undefined> {
    try {
      const payload: Record<string, unknown> = {};
      if (data.title !== undefined) payload.user_name = data.title;
      if (data.contributorName !== undefined) payload.contributor_name = data.contributorName;
      if (data.itemType !== undefined) payload.item_type = data.itemType;
      if (data.latitude !== undefined) payload.latitude = data.latitude;
      if (data.longitude !== undefined) payload.longitude = data.longitude;
      if (data.address !== undefined) payload.address = data.address;
      if (data.city !== undefined) payload.city = data.city;
      if (data.state !== undefined) payload.state = data.state;
      if (data.town !== undefined) payload.town = data.town;
      if (data.borough !== undefined) payload.borough = data.borough;
      if (data.postcode !== undefined) payload.postcode = data.postcode;
      if (data.country !== undefined) payload.country = data.country;
      if (data.twitterHandle !== undefined) payload.twitter_handle = data.twitterHandle;
      if (data.instagramHandle !== undefined) payload.instagram_handle = data.instagramHandle;
      if (data.linkedinHandle !== undefined) payload.linkedin_handle = data.linkedinHandle;
      if (data.note !== undefined) payload.note = data.note;
      if (data.googleMapsUrl !== undefined) payload.google_maps_url = data.googleMapsUrl;
      if (data.url !== undefined) payload.url = data.url;
      if (data.photoUrl !== undefined) payload.photo_url = data.photoUrl;
      if (data.venueType !== undefined) payload.venue_type = data.venueType;
      if (data.priceLevel !== undefined) payload.price_level = data.priceLevel;
      if (data.website !== undefined) payload.website = data.website;
      if (data.editorialSummary !== undefined) payload.editorial_summary = data.editorialSummary;
      if (data.approved !== undefined) payload.approved = data.approved;
      if (data.pinColor !== undefined) payload.pin_color = data.pinColor;
      if (data.pinIcon !== undefined) payload.pin_icon = data.pinIcon;

      const updated = await this.client.request(updateItem("pins", id, payload, { fields: PIN_FIELDS }));
      return toPin(updated as unknown as DirectusPin);
    } catch (error) {
      console.error("Error updating pin:", error);
      return undefined;
    }
  }

  /**
   * Sets `sequence` = array index for each pin id, in the order given —
   * the route/itinerary order. Directus has no bulk "different value per
   * row" update, so this is one request per pin; the caller (routes.ts)
   * has already verified every id belongs to the target map.
   */
  async reorderPins(orderedPinIds: string[]): Promise<void> {
    await Promise.all(
      orderedPinIds.map((id, index) =>
        this.client.request(updateItem("pins", id, { sequence: index }, { fields: ["id"] })),
      ),
    );
  }

  async deletePin(id: string, userId?: string): Promise<boolean> {
    try {
      if (userId) {
        const pin = await this.getPinById(id);
        if (!pin) return false;

        const map = await this.getMapCollectionById(pin.mapId);
        const isMapOwner = map?.ownerId === userId;
        const isPinOwner = pin.userId === userId;
        if (!isMapOwner && !isPinOwner) return false;
      }

      await this.client.request(deleteItem("pins", id));
      return true;
    } catch (error) {
      console.error("Failed to delete pin:", error);
      return false;
    }
  }

  async getMapCollectionById(mapId: string): Promise<MapCollection | undefined> {
    const rows = await this.client.request(
      readItems("map_collections", { filter: { id: { _eq: mapId } }, fields: MAP_FIELDS, limit: 1 }),
    );
    const row = rows[0] as DirectusMapCollection | undefined;
    return row ? toMapCollection(row) : undefined;
  }

  async isAdmin(userId: string): Promise<boolean> {
    const rows = await this.client.request(
      readUsers({
        filter: { id: { _eq: userId }, is_admin: { _eq: true } },
        fields: ["id"],
        limit: 1,
      }),
    );
    return rows.length > 0;
  }

  async getAllUsers(): Promise<User[]> {
    const rows = await this.client.request(readUsers({ fields: USER_FIELDS, limit: -1 }));
    return (rows as any[]).map(toDomainUser);
  }

  async getUserProfile(userId: string): Promise<User | undefined> {
    const rows = await this.client.request(
      readUsers({ filter: { id: { _eq: userId } }, fields: USER_FIELDS, limit: 1 }),
    );
    const row = rows[0];
    return row ? toDomainUser(row as any) : undefined;
  }

  async updateUserGroup(userId: string, userGroup: UserGroup): Promise<User | undefined> {
    try {
      const updated = await this.client.request(
        updateUser(userId, { user_group: userGroup }, { fields: USER_FIELDS }),
      );
      return toDomainUser(updated as any);
    } catch (error) {
      console.error("Error updating user group:", error);
      return undefined;
    }
  }

  async updateStripeSubscription(
    userId: string,
    data: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string | null;
      stripeSubscriptionStatus?: string | null;
      userGroup?: UserGroup;
    },
  ): Promise<User | undefined> {
    try {
      const updated = await this.client.request(
        updateUser(
          userId,
          {
            ...(data.stripeCustomerId !== undefined ? { stripe_customer_id: data.stripeCustomerId } : {}),
            ...(data.stripeSubscriptionId !== undefined ? { stripe_subscription_id: data.stripeSubscriptionId } : {}),
            ...(data.stripeSubscriptionStatus !== undefined
              ? { stripe_subscription_status: data.stripeSubscriptionStatus }
              : {}),
            ...(data.userGroup !== undefined ? { user_group: data.userGroup } : {}),
          },
          { fields: USER_FIELDS },
        ),
      );
      return toDomainUser(updated as any);
    } catch (error) {
      console.error("Error updating Stripe subscription info:", error);
      return undefined;
    }
  }

  private rootLogoFolderIdPromise: Promise<string> | null = null;

  /** Finds (or creates once) the shared "map-logos" root folder every per-user subfolder nests under. */
  private async ensureRootLogoFolder(): Promise<string> {
    if (!this.rootLogoFolderIdPromise) {
      this.rootLogoFolderIdPromise = (async () => {
        const existing = await this.client.request(
          readFolders({
            filter: { name: { _eq: LOGO_ROOT_FOLDER_NAME }, parent: { _null: true } },
            fields: ["id"],
            limit: 1,
          }),
        );
        if (existing[0]) return existing[0].id;

        const created = await this.client.request(
          createFolder({ name: LOGO_ROOT_FOLDER_NAME }, { fields: ["id"] }),
        );
        return created.id;
      })();
    }
    return this.rootLogoFolderIdPromise;
  }

  /** Finds (or creates) this user's own subfolder, so each user's uploaded logos are isolated from everyone else's. */
  private async ensureUserLogoFolder(userId: string): Promise<string> {
    const rootId = await this.ensureRootLogoFolder();
    const existing = await this.client.request(
      readFolders({ filter: { name: { _eq: userId }, parent: { _eq: rootId } }, fields: ["id"], limit: 1 }),
    );
    if (existing[0]) return existing[0].id;

    const created = await this.client.request(
      createFolder({ name: userId, parent: rootId }, { fields: ["id"] }),
    );
    return created.id;
  }

  async uploadUserLogo(userId: string, file: UploadableFile): Promise<string> {
    const folderId = await this.ensureUserLogoFolder(userId);

    const formData = new FormData();
    formData.append("folder", folderId);
    formData.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);

    const created = await this.client.request(uploadFiles(formData, { fields: ["id"] }));
    return created.id;
  }

  private rootPinPhotoFolderIdPromise: Promise<string> | null = null;

  /** Finds (or creates once) the shared "pin-photos" root folder every per-uploader subfolder nests under. */
  private async ensureRootPinPhotoFolder(): Promise<string> {
    if (!this.rootPinPhotoFolderIdPromise) {
      this.rootPinPhotoFolderIdPromise = (async () => {
        const existing = await this.client.request(
          readFolders({ filter: { name: { _eq: PIN_PHOTO_ROOT_FOLDER_NAME }, parent: { _null: true } }, fields: ["id"], limit: 1 }),
        );
        if (existing[0]) return existing[0].id;

        const created = await this.client.request(
          createFolder({ name: PIN_PHOTO_ROOT_FOLDER_NAME }, { fields: ["id"] }),
        );
        return created.id;
      })();
    }
    return this.rootPinPhotoFolderIdPromise;
  }

  /** Finds (or creates) a subfolder for this uploader's pin photos — "anonymous" for pins added by a signed-out visitor, since pin creation doesn't require an account. */
  private async ensureUploaderPinPhotoFolder(uploaderKey: string): Promise<string> {
    const rootId = await this.ensureRootPinPhotoFolder();
    const existing = await this.client.request(
      readFolders({ filter: { name: { _eq: uploaderKey }, parent: { _eq: rootId } }, fields: ["id"], limit: 1 }),
    );
    if (existing[0]) return existing[0].id;

    const created = await this.client.request(
      createFolder({ name: uploaderKey, parent: rootId }, { fields: ["id"] }),
    );
    return created.id;
  }

  async uploadPinPhoto(uploaderId: string | null, file: UploadableFile): Promise<string> {
    const folderId = await this.ensureUploaderPinPhotoFolder(uploaderId ?? "anonymous");

    const formData = new FormData();
    formData.append("folder", folderId);
    formData.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);

    const created = await this.client.request(uploadFiles(formData, { fields: ["id"] }));
    return created.id;
  }

  /** Finds (or creates) this user's own top-level folder (no shared parent — named exactly as the user's id). */
  private async ensureUserRootFolder(userId: string): Promise<string> {
    const existing = await this.client.request(
      readFolders({ filter: { name: { _eq: userId }, parent: { _null: true } }, fields: ["id"], limit: 1 }),
    );
    if (existing[0]) return existing[0].id;

    const created = await this.client.request(createFolder({ name: userId }, { fields: ["id"] }));
    return created.id;
  }

  /** Finds (or creates) this user's "uploads" subfolder, nested under their own top-level folder. */
  private async ensureUserUploadsFolder(userId: string): Promise<string> {
    const rootId = await this.ensureUserRootFolder(userId);
    const existing = await this.client.request(
      readFolders({
        filter: { name: { _eq: VENUE_SCREENSHOT_SUBFOLDER_NAME }, parent: { _eq: rootId } },
        fields: ["id"],
        limit: 1,
      }),
    );
    if (existing[0]) return existing[0].id;

    const created = await this.client.request(
      createFolder({ name: VENUE_SCREENSHOT_SUBFOLDER_NAME, parent: rootId }, { fields: ["id"] }),
    );
    return created.id;
  }

  async uploadVenueScreenshot(userId: string, file: UploadableFile): Promise<string> {
    const folderId = await this.ensureUserUploadsFolder(userId);

    const formData = new FormData();
    formData.append("folder", folderId);
    formData.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);

    const created = await this.client.request(uploadFiles(formData, { fields: ["id"] }));
    return created.id;
  }

  async updateProfile(userId: string, data: UpdateProfile): Promise<User | undefined> {
    try {
      const updated = await this.client.request(
        updateUser(
          userId,
          {
            full_name: data.fullName,
            ...(data.username !== undefined ? { username: data.username } : {}),
            ...(data.bio !== undefined ? { bio: data.bio } : {}),
            twitter_handle: data.twitterHandle ?? null,
            instagram_handle: data.instagramHandle ?? null,
            linkedin_handle: data.linkedinHandle ?? null,
          },
          { fields: USER_FIELDS },
        ),
      );
      return toDomainUser(updated as any);
    } catch (error) {
      console.error("Error updating profile:", error);
      return undefined;
    }
  }

  async getPublicMapsByUserId(userId: string): Promise<MapCollection[]> {
    const rows = await this.client.request(
      readItems("map_collections", {
        filter: { owner: { _eq: userId }, show_on_profile: { _eq: true }, archived: { _eq: false } },
        fields: MAP_FIELDS,
        sort: ["-date_created"],
        limit: -1,
      }),
    );
    return (rows as DirectusMapCollection[]).map(toMapCollection);
  }

  async getPublicMapsByOwnerIds(ownerIds: string[]): Promise<MapCollection[]> {
    if (ownerIds.length === 0) return [];
    const rows = await this.client.request(
      readItems("map_collections", {
        // Eligible for the feed if the owner opted it into their profile, OR
        // it's a curated map — curated maps are already globally public via
        // /discover, so show_on_profile (aimed at regular users' own maps)
        // shouldn't hide them from their followers' feeds too.
        filter: {
          owner: { _in: ownerIds },
          archived: { _eq: false },
          _or: [{ show_on_profile: { _eq: true } }, { curated: { _eq: true } }],
        },
        fields: MAP_FIELDS,
        sort: ["-date_created"],
        limit: -1,
      }),
    );
    return (rows as DirectusMapCollection[]).map(toMapCollection);
  }

  async getCuratedMapCollections(filters?: { category?: string; country?: string; city?: string }): Promise<MapCollection[]> {
    const filter: Record<string, unknown> = { curated: { _eq: true } };
    if (filters?.category) filter.curated_category = { _eq: filters.category };
    if (filters?.country) filter.curated_country = { _eq: filters.country };
    if (filters?.city) filter.curated_city = { _eq: filters.city };

    const rows = await this.client.request(
      readItems("map_collections", {
        filter,
        fields: MAP_FIELDS,
        sort: ["curated_order", "-date_created"],
        limit: -1,
      }),
    );
    return (rows as DirectusMapCollection[]).map(toMapCollection);
  }

  async setMapsArchived(mapIds: string[], userId: string, archived: boolean): Promise<string[]> {
    if (mapIds.length === 0) return [];

    const owned = await this.client.request(
      readItems("map_collections", {
        filter: { id: { _in: mapIds }, owner: { _eq: userId } },
        fields: ["id"],
        limit: -1,
      }),
    );
    const ownedIds = (owned as Array<{ id: string }>).map((row) => row.id);
    if (ownedIds.length === 0) return [];

    await this.client.request(updateItems("map_collections", ownedIds, { archived }));
    return ownedIds;
  }

  async followUser(followerId: string, followingId: string): Promise<UserFollow> {
    const created = await this.client.request(
      createItem("user_follows", { follower: followerId, following: followingId }, { fields: FOLLOW_FIELDS }),
    );
    return toUserFollow(created as unknown as DirectusUserFollow);
  }

  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    const existing = await this.getFollowRelation(followerId, followingId);
    if (!existing) return false;
    await this.client.request(deleteItem("user_follows", existing.id));
    return true;
  }

  async getFollowRelation(followerId: string, followingId: string): Promise<UserFollow | undefined> {
    const rows = await this.client.request(
      readItems("user_follows", {
        filter: { follower: { _eq: followerId }, following: { _eq: followingId } },
        fields: FOLLOW_FIELDS,
        limit: 1,
      }),
    );
    const row = rows[0] as DirectusUserFollow | undefined;
    return row ? toUserFollow(row) : undefined;
  }

  async getFollowerCount(userId: string): Promise<number> {
    const rows = await this.client.request(
      readItems("user_follows", { filter: { following: { _eq: userId } }, fields: ["id"], limit: -1 }),
    );
    return rows.length;
  }

  async getFollowingCount(userId: string): Promise<number> {
    const rows = await this.client.request(
      readItems("user_follows", { filter: { follower: { _eq: userId } }, fields: ["id"], limit: -1 }),
    );
    return rows.length;
  }

  async getFollowingIds(userId: string): Promise<string[]> {
    const rows = await this.client.request(
      readItems("user_follows", { filter: { follower: { _eq: userId } }, fields: ["following"], limit: -1 }),
    );
    return (rows as Array<{ following: string }>).map((row) => row.following);
  }

  async likeMap(userId: string, mapId: string): Promise<MapLike> {
    const created = await this.client.request(
      createItem("map_likes", { user: userId, map: mapId }, { fields: LIKE_FIELDS }),
    );
    return toMapLike(created as unknown as DirectusMapLike);
  }

  async unlikeMap(userId: string, mapId: string): Promise<boolean> {
    const rows = await this.client.request(
      readItems("map_likes", {
        filter: { user: { _eq: userId }, map: { _eq: mapId } },
        fields: ["id"],
        limit: 1,
      }),
    );
    const row = rows[0] as { id: string } | undefined;
    if (!row) return false;
    await this.client.request(deleteItem("map_likes", row.id));
    return true;
  }

  async getMapLikeCounts(mapIds: string[]): Promise<Record<string, number>> {
    if (mapIds.length === 0) return {};
    const rows = await this.client.request(
      readItems("map_likes", { filter: { map: { _in: mapIds } }, fields: ["map"], limit: -1 }),
    );
    const counts: Record<string, number> = {};
    for (const row of rows as Array<{ map: string }>) counts[row.map] = (counts[row.map] ?? 0) + 1;
    return counts;
  }

  async getUserLikedMapIds(userId: string, mapIds: string[]): Promise<Set<string>> {
    if (mapIds.length === 0) return new Set();
    const rows = await this.client.request(
      readItems("map_likes", {
        filter: { user: { _eq: userId }, map: { _in: mapIds } },
        fields: ["map"],
        limit: -1,
      }),
    );
    return new Set((rows as Array<{ map: string }>).map((row) => row.map));
  }

  async getPublishedPages(): Promise<Page[]> {
    const rows = await this.client.request(
      readItems("map_pages", {
        filter: { published: { _eq: true } },
        fields: PAGE_FIELDS,
        sort: ["nav_order", "title"],
        limit: -1,
      }),
    );
    return (rows as DirectusPage[]).map(toPage);
  }

  async getPublishedPageBySlug(slug: string): Promise<Page | undefined> {
    const rows = await this.client.request(
      readItems("map_pages", {
        filter: { slug: { _eq: slug }, published: { _eq: true } },
        fields: PAGE_FIELDS,
        limit: 1,
      }),
    );
    const row = rows[0] as DirectusPage | undefined;
    return row ? toPage(row) : undefined;
  }

  async getPublishedMapTemplates(): Promise<MapTemplate[]> {
    const rows = await this.client.request(
      readItems("map_templates", {
        filter: { published: { _eq: true } },
        fields: MAP_TEMPLATE_FIELDS,
        sort: ["sort_order", "label"],
        limit: -1,
      }),
    );
    return (rows as DirectusMapTemplate[]).map(toMapTemplate);
  }

  async createFolder(data: InsertFolder & { ownerId: string }): Promise<Folder> {
    const created = await this.client.request(
      createItem(
        "map_folders",
        { name: data.name, owner: data.ownerId, parent_folder: data.parentFolderId ?? null },
        { fields: FOLDER_FIELDS },
      ),
    );
    return toFolder(created as unknown as DirectusFolder);
  }

  async getFolderById(id: string): Promise<Folder | undefined> {
    const rows = await this.client.request(
      readItems("map_folders", { filter: { id: { _eq: id } }, fields: FOLDER_FIELDS, limit: 1 }),
    );
    const row = rows[0] as DirectusFolder | undefined;
    return row ? toFolder(row) : undefined;
  }

  async getFoldersByOwner(ownerId: string): Promise<Folder[]> {
    const rows = await this.client.request(
      readItems("map_folders", { filter: { owner: { _eq: ownerId } }, fields: FOLDER_FIELDS, sort: ["name"], limit: -1 }),
    );
    return (rows as DirectusFolder[]).map(toFolder);
  }

  async updateFolder(id: string, data: UpdateFolder): Promise<Folder | undefined> {
    try {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.parentFolderId !== undefined) payload.parent_folder = data.parentFolderId;

      const updated = await this.client.request(updateItem("map_folders", id, payload, { fields: FOLDER_FIELDS }));
      return toFolder(updated as unknown as DirectusFolder);
    } catch (error) {
      console.error("Error updating folder:", error);
      return undefined;
    }
  }

  async deleteFolder(id: string): Promise<boolean> {
    try {
      await this.client.request(deleteItem("map_folders", id));
      return true;
    } catch (error) {
      console.error("Error deleting folder:", error);
      return false;
    }
  }
}

export const storage: IStorage = new DirectusStorage();
