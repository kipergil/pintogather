/** Central registry of enums used across this app's data model. */

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

/** Fixed theme categories for the /discover curated-maps page — one editorial bucket per map, kept small and closed so the category filter stays meaningful. */
export const CURATED_CATEGORY = [
  "food-drink",
  "coffee-cafes",
  "nightlife-bars",
  "culture-art",
  "outdoors-parks",
  "shopping",
  "hidden-gems",
  "family-kids",
  "date-night",
  "landmarks-sightseeing",
] as const;
export type CuratedCategory = (typeof CURATED_CATEGORY)[number];

/** Countries this app curates maps for — a closed set rather than free text, so curated content stays geographically organized as it grows. */
export const CURATED_COUNTRY = ["turkey", "uk", "usa", "scotland", "spain", "greece", "italy", "france"] as const;
export type CuratedCountry = (typeof CURATED_COUNTRY)[number];

/**
 * Well-known cities per curated country — also closed, so the Discover
 * page's country->city filter is a real cascading dropdown (Directus's
 * curated_city field narrows its own choices the same way, see
 * directus/src/schema/definitions.ts) rather than free-text that could
 * fragment into near-duplicate spellings.
 */
export const CURATED_CITY_BY_COUNTRY: Record<CuratedCountry, readonly string[]> = {
  turkey: ["Istanbul", "Ankara", "Izmir", "Antalya", "Bodrum", "Cappadocia"],
  uk: ["London", "Manchester", "Birmingham", "Liverpool", "Bristol", "Oxford"],
  usa: ["New York", "Los Angeles", "Chicago", "San Francisco", "Miami", "Las Vegas"],
  scotland: ["Edinburgh", "Glasgow", "Aberdeen", "Inverness", "St Andrews"],
  spain: ["Madrid", "Barcelona", "Seville", "Valencia", "Málaga", "Ibiza"],
  greece: ["Athens", "Thessaloniki", "Santorini", "Mykonos", "Crete", "Rhodes"],
  italy: ["Rome", "Milan", "Florence", "Venice", "Naples", "Bologna"],
  france: ["Paris", "Nice", "Lyon", "Marseille", "Bordeaux", "Cannes"],
} as const;

/** Flat list of every curated city across all countries — used for the Directus select field's fixed choice list (the per-country narrowing is a UI-only `conditions` behavior on top of this same flat set). */
export const CURATED_CITY = Object.values(CURATED_CITY_BY_COUNTRY).flat() as string[];
