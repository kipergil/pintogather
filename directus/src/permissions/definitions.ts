import { env } from "../lib/env.js";
import type { PolicyDefinition } from "./types.js";

/**
 * Used exclusively by the Express server's static SERVICE_TOKEN. Broad CRUD
 * across app collections — per-user ownership and permission enforcement
 * (map owner, pin owner, viewer role/permission) happens in
 * server/storage.ts and server/routes.ts before this token is ever called.
 * No admin_access, no app_access (no panel login), no schema/role/policy
 * access, no permission to delete users — defence in depth, not the
 * primary authorization boundary.
 *
 * Named distinctly ("<APP_NAME> Service", not just "Service") because this
 * schema/permissions tooling may run against a Directus instance shared
 * with other projects (e.g. BucketBoard) that already have their own
 * generically-named "Service" policy/role — reusing that name would find
 * and overwrite their permissions instead of creating ours. If APP_NAME
 * changes, re-running `permissions:apply` creates a NEW policy/role under
 * the new name rather than renaming the old one in place — see the warning
 * in apply.ts's ensureServiceAccount.
 */
export const servicePolicy: PolicyDefinition = {
  name: `${env.APP_NAME} Service`,
  icon: "dns",
  description: `${env.APP_NAME}'s Express server's server-only token. Never exposed to the browser.`,
  adminAccess: false,
  appAccess: false,
  role: { icon: "dns" },
  rules: [
    { collection: "directus_users", action: "create" },
    { collection: "directus_users", action: "read" },
    { collection: "directus_users", action: "update" },
    { collection: "map_collections", action: "create" },
    { collection: "map_collections", action: "read" },
    { collection: "map_collections", action: "update" },
    { collection: "map_collections", action: "delete" },
    { collection: "pins", action: "create" },
    { collection: "pins", action: "read" },
    { collection: "pins", action: "update" },
    { collection: "pins", action: "delete" },
    { collection: "map_viewers", action: "create" },
    { collection: "map_viewers", action: "read" },
    { collection: "map_viewers", action: "update" },
    { collection: "map_viewers", action: "delete" },
    { collection: "map_invitations", action: "create" },
    { collection: "map_invitations", action: "read" },
    { collection: "map_invitations", action: "update" },
    { collection: "map_invitations", action: "delete" },
    { collection: "user_follows", action: "create" },
    { collection: "user_follows", action: "read" },
    { collection: "user_follows", action: "update" },
    { collection: "user_follows", action: "delete" },
    { collection: "map_likes", action: "create" },
    { collection: "map_likes", action: "read" },
    { collection: "map_likes", action: "update" },
    { collection: "map_likes", action: "delete" },
    // Read-only: pages are authored/edited directly in the Directus admin
    // panel, not through the app's own API.
    { collection: "map_pages", action: "read" },
    // Read-only: map templates are authored/edited directly in the Directus
    // admin panel, not through the app's own API.
    { collection: "map_templates", action: "read" },
    { collection: "map_folders", action: "create" },
    { collection: "map_folders", action: "read" },
    { collection: "map_folders", action: "update" },
    { collection: "map_folders", action: "delete" },
    // Per-user map-branding logo uploads (see server/storage.ts's
    // uploadUserLogo) — files live under map-logos/<userId>/ so each
    // user's uploads are isolated in their own subfolder.
    { collection: "directus_files", action: "create" },
    { collection: "directus_files", action: "read" },
    { collection: "directus_files", action: "update" },
    { collection: "directus_files", action: "delete" },
    { collection: "directus_folders", action: "create" },
    { collection: "directus_folders", action: "read" },
    { collection: "directus_folders", action: "update" },
    { collection: "directus_folders", action: "delete" },
  ],
};

export const allPolicies: PolicyDefinition[] = [servicePolicy];
