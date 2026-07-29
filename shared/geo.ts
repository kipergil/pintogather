/** A point with lat/lng as strings, matching how pins store coordinates. */
export interface GeoPoint {
  latitude: string;
  longitude: string;
}

/**
 * Type guard for a pin/item that actually has coordinates — true for every
 * "location"-type item, never for "link"/"recommendation" ones (see
 * shared/enums.ts's ITEM_TYPE). Route/distance calculations only make sense
 * for the former, so callers filter with this before reaching for GeoPoint
 * functions below.
 */
export function hasCoordinates<T extends { latitude: string | null; longitude: string | null }>(
  point: T,
): point is T & { latitude: string; longitude: string } {
  return point.latitude != null && point.longitude != null;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometers. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const lat1 = parseFloat(a.latitude);
  const lon1 = parseFloat(a.longitude);
  const lat2 = parseFloat(b.latitude);
  const lon2 = parseFloat(b.longitude);

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(rLat1) * Math.cos(rLat2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Sum of consecutive great-circle legs through an ordered list of points, in kilometers. */
export function totalRouteDistanceKm(points: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistanceKm(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Route/itinerary order for a map's pins: ascending by `sequence` (the
 * reorder endpoint sets 0..N-1 for every pin each time it's called), tied
 * pins — including ones that have never been explicitly ordered, which all
 * share the schema default of 0 — fall back to creation order.
 */
export function sortPinsForRoute<T extends { sequence?: number | null; createdAt: string | Date }>(pins: T[]): T[] {
  return [...pins].sort((a, b) => {
    const seqDiff = (a.sequence ?? 0) - (b.sequence ?? 0);
    if (seqDiff !== 0) return seqDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
