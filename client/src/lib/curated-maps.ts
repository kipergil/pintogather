import { CURATED_CATEGORY, CURATED_COUNTRY, type CuratedCategory, type CuratedCountry } from "@shared/enums";

export const CURATED_CATEGORY_LABELS: Record<CuratedCategory, string> = {
  "food-drink": "Food & Drink",
  "coffee-cafes": "Coffee & Cafés",
  "nightlife-bars": "Nightlife & Bars",
  "culture-art": "Culture & Art",
  "outdoors-parks": "Outdoors & Parks",
  shopping: "Shopping",
  "hidden-gems": "Hidden Gems",
  "family-kids": "Family & Kids",
  "date-night": "Date Night",
  "landmarks-sightseeing": "Landmarks & Sightseeing",
};

export const CURATED_COUNTRY_LABELS: Record<CuratedCountry, string> = {
  turkey: "Turkey",
  uk: "UK",
  usa: "USA",
  scotland: "Scotland",
  spain: "Spain",
  greece: "Greece",
  italy: "Italy",
  france: "France",
};

/** Two-stop gradient per category, used for the auto-generated Discover cover card — gives the grid meaningful, at-a-glance visual variety instead of every card looking the same. */
export const CURATED_CATEGORY_GRADIENT: Record<CuratedCategory, [string, string]> = {
  "food-drink": ["#F97316", "#DC2626"],
  "coffee-cafes": ["#92400E", "#B45309"],
  "nightlife-bars": ["#7C3AED", "#DB2777"],
  "culture-art": ["#2563EB", "#7C3AED"],
  "outdoors-parks": ["#16A34A", "#0D9488"],
  shopping: ["#DB2777", "#F97316"],
  "hidden-gems": ["#4338CA", "#0F766E"],
  "family-kids": ["#F59E0B", "#22C55E"],
  "date-night": ["#BE123C", "#7C3AED"],
  "landmarks-sightseeing": ["#0369A1", "#1E3A8A"],
};

export function isCuratedCategory(value: unknown): value is CuratedCategory {
  return typeof value === "string" && (CURATED_CATEGORY as readonly string[]).includes(value);
}

export function isCuratedCountry(value: unknown): value is CuratedCountry {
  return typeof value === "string" && (CURATED_COUNTRY as readonly string[]).includes(value);
}
