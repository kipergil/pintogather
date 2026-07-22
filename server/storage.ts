import { createItem, createItems, deleteItem, readItems, readUsers, updateItem, updateUser } from "@directus/sdk";
import { nanoid } from "nanoid";
import type { UserGroup } from "../shared/enums.js";
import type {
  MapCollection,
  MapInvitation,
  MapViewer,
  Pin,
  InsertMapCollection,
  InsertMapInvitation,
  InsertMapViewer,
  InsertPin,
  UpdateMapDetails,
  UpdateProfile,
  User,
} from "../shared/schema.js";
import type {
  MapCollection as DirectusMapCollection,
  MapInvitation as DirectusMapInvitation,
  MapViewer as DirectusMapViewer,
  Pin as DirectusPin,
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
  "date_created",
] as const;

const PIN_FIELDS = [
  "id",
  "map",
  "user",
  "user_name",
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
  "twitter_handle",
  "instagram_handle",
  "linkedin_handle",
  "user_group",
  "is_admin",
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
    createdAt: new Date(row.date_created),
  };
}

function toPin(row: DirectusPin): Pin {
  return {
    id: row.id,
    mapId: row.map,
    userId: row.user,
    userName: row.user_name,
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
    createdAt: new Date(row.date_created),
  };
}

function toDirectusPinInput(data: InsertPin) {
  return {
    map: data.mapId,
    user: data.userId ?? null,
    user_name: data.userName,
    latitude: data.latitude,
    longitude: data.longitude,
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
  getMapCollectionByShareUrl(shareUrl: string): Promise<MapCollection | undefined>;
  getMapCollectionByName(name: string): Promise<MapCollection | undefined>;
  getMapCollectionById(mapId: string): Promise<MapCollection | undefined>;
  getAllMapCollections(): Promise<MapCollection[]>;
  getMapCollectionsByUserId(userId: string): Promise<MapCollection[]>;
  getMapCollectionsForUser(userId: string): Promise<MapCollection[]>;
  getContributedMaps(userId: string): Promise<MapCollection[]>;
  updateMapPermissions(
    mapId: string,
    isPublic: boolean,
    defaultPermission: string,
  ): Promise<MapCollection | undefined>;
  updateMapDetails(mapId: string, data: UpdateMapDetails): Promise<MapCollection | undefined>;
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
  getPinsByMapId(mapId: string): Promise<Pin[]>;
  getPinById(id: string): Promise<Pin | undefined>;
  updatePin(id: string, data: Partial<InsertPin>): Promise<Pin | undefined>;
  deletePin(id: string, userId?: string): Promise<boolean>;

  // Admin & profile
  isAdmin(userId: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUserProfile(userId: string): Promise<User | undefined>;
  updateUserGroup(userId: string, userGroup: UserGroup): Promise<User | undefined>;
  updateProfile(userId: string, data: UpdateProfile): Promise<User | undefined>;
}

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
          is_public: data.isPublic ?? false,
          default_permission: data.defaultPermission ?? "readonly",
          note_label: data.noteLabel ?? null,
          note_prompt: data.notePrompt ?? null,
          branding_logo_url: data.brandingLogoUrl ?? null,
        },
        { fields: MAP_FIELDS },
      ),
    );
    return toMapCollection(created as unknown as DirectusMapCollection);
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

  async getMapCollectionsByUserId(userId: string): Promise<MapCollection[]> {
    const rows = await this.client.request(
      readItems("map_collections", {
        filter: { owner: { _eq: userId } },
        fields: MAP_FIELDS,
        sort: ["-date_created"],
        limit: -1,
      }),
    );
    return (rows as DirectusMapCollection[]).map(toMapCollection);
  }

  async getMapCollectionsForUser(userId: string): Promise<MapCollection[]> {
    const ownedMaps = await this.getMapCollectionsByUserId(userId);
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

      const updated = await this.client.request(updateItem("map_collections", mapId, payload, { fields: MAP_FIELDS }));
      return toMapCollection(updated as unknown as DirectusMapCollection);
    } catch (error) {
      console.error("Error updating map details:", error);
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
      if (data.userName !== undefined) payload.user_name = data.userName;
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

      const updated = await this.client.request(updateItem("pins", id, payload, { fields: PIN_FIELDS }));
      return toPin(updated as unknown as DirectusPin);
    } catch (error) {
      console.error("Error updating pin:", error);
      return undefined;
    }
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

  async updateProfile(userId: string, data: UpdateProfile): Promise<User | undefined> {
    try {
      const updated = await this.client.request(
        updateUser(
          userId,
          {
            full_name: data.fullName,
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
}

export const storage: IStorage = new DirectusStorage();
