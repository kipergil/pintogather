/**
 * Google Places `types` arrays always include a handful of generic
 * classifiers alongside (or instead of) a meaningful one — skip those so
 * the first remaining entry is the closest thing to "what kind of place is
 * this" (e.g. "restaurant", "cafe", "museum").
 */
const GENERIC_PLACE_TYPES = new Set([
  "point_of_interest",
  "establishment",
  "premise",
  "subpremise",
  "political",
  "geocode",
  "plus_code",
  "route",
  "street_address",
  "postal_code",
  "locality",
  "sublocality",
  "neighborhood",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "country",
]);

/** Picks the most specific Google Places type out of a place's `types` array. */
export function getPrimaryVenueType(types?: string[] | null): string | null {
  if (!types) return null;
  return types.find((type) => !GENERIC_PLACE_TYPES.has(type)) ?? null;
}

/** Formats a raw Google Places type (e.g. "night_club") for display (e.g. "Night club"). */
export function formatVenueType(venueType?: string | null): string | null {
  if (!venueType) return null;
  const words = venueType.split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
