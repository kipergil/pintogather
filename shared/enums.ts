/** Central registry of enums used across the PinTogather data model. */

export const USER_GROUP = ["freemium", "basic", "premium"] as const;
export type UserGroup = (typeof USER_GROUP)[number];

export const PERMISSION = ["readonly", "editable"] as const;
export type Permission = (typeof PERMISSION)[number];

export const MAP_VIEWER_ROLE = ["viewer", "contributor"] as const;
export type MapViewerRole = (typeof MAP_VIEWER_ROLE)[number];

export const INVITATION_STATUS = ["pending", "accepted", "declined"] as const;
export type InvitationStatus = (typeof INVITATION_STATUS)[number];
