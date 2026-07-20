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
 * Named distinctly ("PinTogather Service", not just "Service") because this
 * schema/permissions tooling may run against a Directus instance shared
 * with other projects (e.g. BucketBoard) that already have their own
 * generically-named "Service" policy/role — reusing that name would find
 * and overwrite their permissions instead of creating ours.
 */
export const servicePolicy: PolicyDefinition = {
  name: "PinTogather Service",
  icon: "dns",
  description: "PinTogather's Express server's server-only token. Never exposed to the browser.",
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
  ],
};

export const allPolicies: PolicyDefinition[] = [servicePolicy];
