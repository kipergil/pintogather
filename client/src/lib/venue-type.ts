import { VENUE_TYPE, VENUE_TYPE_LABELS, type VenueType } from "@shared/enums";

/**
 * Picks the best VENUE_TYPE match out of a place's Google `types` array —
 * walking VENUE_TYPE's own order (not the array's) so a place tagged with
 * several known types (e.g. a museum Google also lists as "library")
 * resolves to whichever we consider more specific/useful, deterministically,
 * rather than however Google happened to order that particular result.
 */
export function getPrimaryVenueType(types?: string[] | null): VenueType | null {
  if (!types) return null;
  const placeTypes = new Set(types);
  return VENUE_TYPE.find((venueType) => placeTypes.has(venueType)) ?? null;
}

/** Human-readable label for a venue type (e.g. "night_club" -> "Night club"). */
export function formatVenueType(venueType?: string | null): string | null {
  if (!venueType) return null;
  return VENUE_TYPE_LABELS[venueType as VenueType] ?? venueType;
}

/** Formats a Google Places price level (0-4) as "Free" or a "$" run — 0 is a real value ("free"), so check with `!= null`, not truthiness. */
export function formatPriceLevel(priceLevel?: number | null): string | null {
  if (priceLevel == null) return null;
  if (priceLevel <= 0) return "Free";
  return "$".repeat(priceLevel);
}
