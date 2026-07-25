/** Central registry of enums used across the PinTogather data model. */

export const USER_GROUP = ["freemium", "basic", "premium"] as const;
export type UserGroup = (typeof USER_GROUP)[number];

export const PERMISSION = ["readonly", "editable"] as const;
export type Permission = (typeof PERMISSION)[number];

export const MAP_VIEWER_ROLE = ["viewer", "contributor"] as const;
export type MapViewerRole = (typeof MAP_VIEWER_ROLE)[number];

export const INVITATION_STATUS = ["pending", "accepted", "declined"] as const;
export type InvitationStatus = (typeof INVITATION_STATUS)[number];

/** Fixed palette (Basic/Premium) for map-default and per-pin marker colors — a curated set rather than a free color picker, so pins stay legible together on one map. Hex values live in client/src/lib/pin-styles.ts. */
export const PIN_COLOR = ["red", "orange", "amber", "yellow", "green", "teal", "blue", "indigo", "purple", "pink"] as const;
export type PinColor = (typeof PIN_COLOR)[number];

/** Fixed icon glyph set (Basic/Premium) for map-default and per-pin marker icons. SVG paths live in client/src/lib/pin-styles.ts. */
export const PIN_ICON = [
  "pin",
  "star",
  "heart",
  "coffee",
  "restaurant",
  "home",
  "building",
  "landmark",
  "shopping",
  "bed",
  "trees",
  "music",
  "camera",
  "flag",
] as const;
export type PinIcon = (typeof PIN_ICON)[number];
