/** Central registry of enums used across this app's data model. */

export const USER_GROUP = ["freemium", "basic", "premium"] as const;
export type UserGroup = (typeof USER_GROUP)[number];

export const PERMISSION = ["readonly", "editable"] as const;
export type Permission = (typeof PERMISSION)[number];

export const MAP_VIEWER_ROLE = ["viewer", "contributor"] as const;
export type MapViewerRole = (typeof MAP_VIEWER_ROLE)[number];

/**
 * What kind of thing a collection holds, and therefore what its items look
 * like. Set once, at creation, on map_collections.item_type and inherited by
 * every pin added to it (pins.item_type is set from the map's value at add
 * time — see server storage). "location" is the original, map-based
 * behavior (lat/lng required, rendered on a Google Map); "link" and
 * "recommendation" are collections of non-geographic things (an article, a
 * product, "anything worth recommending") rendered as a plain card list.
 */
export const ITEM_TYPE = ["location", "link", "recommendation"] as const;
export type ItemType = (typeof ITEM_TYPE)[number];

/** Human-readable label per ITEM_TYPE value, used by both the creation picker and the Directus admin dropdown. */
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  location: "Locations",
  link: "Links",
  recommendation: "Recommendations",
};

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

/**
 * Fixed icon glyph set for the map-creation template picker's card icon —
 * a superset of PIN_ICON plus a few glyphs (plane/compass/briefcase/users)
 * that read better for a template category than for an individual pin.
 * Deliberately a closed enum (not a free icon name) so every choice has a
 * guaranteed lucide-react + Ionicons mapping on both platforms — see
 * client/src/lib/template-icons.ts and mobile/src/lib/template-icons.ts.
 */
export const TEMPLATE_ICON = [
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
  "plane",
  "compass",
  "briefcase",
  "users",
] as const;
export type TemplateIcon = (typeof TEMPLATE_ICON)[number];

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

/**
 * Curated subset of Google Places' legacy "type" strings (see
 * https://developers.google.com/maps/documentation/places/web-service/supported_types),
 * covering the categories most likely for a pin worth adding to a map. A
 * closed enum (rather than passing through whatever Google returns) so the
 * value is safe to show as a Directus admin dropdown and stays a small,
 * meaningful set as it grows — Google's full type list runs past 100
 * entries, most of which (electrician, lawyer, roofing_contractor, ...)
 * aren't places anyone pins to a map. A pin whose closest Google type isn't
 * in this set simply gets no venue type rather than an odd one.
 */
export const VENUE_TYPE = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "night_club",
  "liquor_store",
  "lodging",
  "shopping_mall",
  "supermarket",
  "convenience_store",
  "clothing_store",
  "shoe_store",
  "jewelry_store",
  "book_store",
  "furniture_store",
  "electronics_store",
  "department_store",
  "florist",
  "pet_store",
  "store",
  "museum",
  "art_gallery",
  "movie_theater",
  "tourist_attraction",
  "amusement_park",
  "zoo",
  "aquarium",
  "casino",
  "stadium",
  "bowling_alley",
  "gym",
  "spa",
  "hospital",
  "pharmacy",
  "dentist",
  "doctor",
  "beauty_salon",
  "hair_care",
  "veterinary_care",
  "park",
  "campground",
  "rv_park",
  "cemetery",
  "church",
  "mosque",
  "synagogue",
  "hindu_temple",
  "place_of_worship",
  "airport",
  "train_station",
  "bus_station",
  "subway_station",
  "light_rail_station",
  "transit_station",
  "parking",
  "gas_station",
  "taxi_stand",
  "school",
  "university",
  "library",
  "bank",
  "atm",
  "post_office",
  "laundry",
  "real_estate_agency",
  "travel_agency",
  "car_repair",
  "car_rental",
  "car_wash",
  "car_dealer",
] as const;
export type VenueType = (typeof VENUE_TYPE)[number];

/** Human-readable label per VENUE_TYPE value — used for both the Directus admin dropdown and the pin-table badge, so the two stay in sync. */
export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  bar: "Bar",
  bakery: "Bakery",
  meal_takeaway: "Takeaway",
  meal_delivery: "Delivery",
  night_club: "Night club",
  liquor_store: "Liquor store",
  lodging: "Hotel & lodging",
  shopping_mall: "Shopping mall",
  supermarket: "Supermarket",
  convenience_store: "Convenience store",
  clothing_store: "Clothing store",
  shoe_store: "Shoe store",
  jewelry_store: "Jewelry store",
  book_store: "Book store",
  furniture_store: "Furniture store",
  electronics_store: "Electronics store",
  department_store: "Department store",
  florist: "Florist",
  pet_store: "Pet store",
  store: "Shop",
  museum: "Museum",
  art_gallery: "Art gallery",
  movie_theater: "Cinema",
  tourist_attraction: "Tourist attraction",
  amusement_park: "Amusement park",
  zoo: "Zoo",
  aquarium: "Aquarium",
  casino: "Casino",
  stadium: "Stadium",
  bowling_alley: "Bowling alley",
  gym: "Gym",
  spa: "Spa",
  hospital: "Hospital",
  pharmacy: "Pharmacy",
  dentist: "Dentist",
  doctor: "Doctor",
  beauty_salon: "Beauty salon",
  hair_care: "Hair salon",
  veterinary_care: "Veterinary clinic",
  park: "Park",
  campground: "Campground",
  rv_park: "RV park",
  cemetery: "Cemetery",
  church: "Church",
  mosque: "Mosque",
  synagogue: "Synagogue",
  hindu_temple: "Hindu temple",
  place_of_worship: "Place of worship",
  airport: "Airport",
  train_station: "Train station",
  bus_station: "Bus station",
  subway_station: "Subway station",
  light_rail_station: "Light rail station",
  transit_station: "Transit station",
  parking: "Parking",
  gas_station: "Gas station",
  taxi_stand: "Taxi stand",
  school: "School",
  university: "University",
  library: "Library",
  bank: "Bank",
  atm: "ATM",
  post_office: "Post office",
  laundry: "Laundry",
  real_estate_agency: "Real estate agency",
  travel_agency: "Travel agency",
  car_repair: "Car repair",
  car_rental: "Car rental",
  car_wash: "Car wash",
  car_dealer: "Car dealer",
};
