import { createItem, readItems, updateItem } from "@directus/sdk";
import type { DirectusUser } from "../../shared/directus-schema.js";
import type { UpsertUser, User } from "../../shared/schema.js";
import { getServiceDirectusClient } from "../lib/directus.js";

const USER_FIELDS = [
  "id",
  "email",
  "first_name",
  "last_name",
  "avatar",
  "status",
  "role",
  "clerk_user_id",
  "avatar_url",
  "full_name",
  "twitter_handle",
  "instagram_handle",
  "linkedin_handle",
  "user_group",
  "is_admin",
] as const;

export function toDomainUser(row: DirectusUser): User {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    profileImageUrl: row.avatar_url,
    fullName: row.full_name,
    twitterHandle: row.twitter_handle,
    instagramHandle: row.instagram_handle,
    linkedinHandle: row.linkedin_handle,
    userGroup: row.user_group,
    isAdmin: row.is_admin,
  };
}

export async function getUserByClerkId(clerkUserId: string): Promise<User | undefined> {
  const client = getServiceDirectusClient();
  const rows = await client.request(
    readItems("directus_users", {
      filter: { clerk_user_id: { _eq: clerkUserId } },
      fields: USER_FIELDS,
      limit: 1,
    }),
  );
  const row = rows[0] as DirectusUser | undefined;
  return row ? toDomainUser(row) : undefined;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const client = getServiceDirectusClient();
  const rows = await client.request(
    readItems("directus_users", {
      filter: { id: { _eq: id } },
      fields: USER_FIELDS,
      limit: 1,
    }),
  );
  const row = rows[0] as DirectusUser | undefined;
  return row ? toDomainUser(row) : undefined;
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/**
 * Upserts a directus_users row for a Clerk identity, looked up by
 * `clerk_user_id` first, falling back to email so a user who signed up with
 * a password and later returns via Google gets linked to their existing row
 * rather than duplicated. `is_admin` is granted (never revoked here) the
 * first time a configured admin email signs in.
 */
export async function upsertUserFromClerk(input: UpsertUser): Promise<User> {
  const client = getServiceDirectusClient();

  const byClerkId = await client.request(
    readItems("directus_users", {
      filter: { clerk_user_id: { _eq: input.clerkUserId } },
      fields: USER_FIELDS,
      limit: 1,
    }),
  );
  const existing =
    (byClerkId[0] as DirectusUser | undefined) ??
    (input.email
      ? ((
          await client.request(
            readItems("directus_users", {
              filter: { email: { _eq: input.email } },
              fields: USER_FIELDS,
              limit: 1,
            }),
          )
        )[0] as DirectusUser | undefined)
      : undefined);

  const isConfiguredAdmin = Boolean(input.email && ADMIN_EMAILS.includes(input.email.toLowerCase()));

  const payload = {
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    avatar_url: input.profileImageUrl,
    clerk_user_id: input.clerkUserId,
    status: "active" as const,
    ...(isConfiguredAdmin ? { is_admin: true } : {}),
  };

  if (existing) {
    await client.request(updateItem("directus_users", existing.id, payload, { fields: USER_FIELDS }));
    return toDomainUser({ ...existing, ...payload });
  }

  const created = await client.request(
    createItem(
      "directus_users",
      { ...payload, full_name: [input.firstName, input.lastName].filter(Boolean).join(" ") || null },
      { fields: USER_FIELDS },
    ),
  );
  return toDomainUser(created as unknown as DirectusUser);
}

export async function deactivateUserByClerkId(clerkUserId: string): Promise<void> {
  const client = getServiceDirectusClient();
  const rows = await client.request(
    readItems("directus_users", {
      filter: { clerk_user_id: { _eq: clerkUserId } },
      fields: ["id"],
      limit: 1,
    }),
  );
  const user = rows[0] as { id: string } | undefined;
  if (!user) return;
  await client.request(updateItem("directus_users", user.id, { status: "suspended" }, { fields: ["id"] }));
}
