import type { CuratedCategory, CuratedCountry } from "../../../shared/enums";

/** Same data as client/src/lib/curated-maps.ts, duplicated since mobile only reaches into ../shared. */
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

/** First color of each category's web gradient — used as a flat cover-card background on mobile instead of porting the canvas-based gradient generator. */
export const CURATED_CATEGORY_COLOR: Record<CuratedCategory, string> = {
  "food-drink": "#F97316",
  "coffee-cafes": "#92400E",
  "nightlife-bars": "#7C3AED",
  "culture-art": "#2563EB",
  "outdoors-parks": "#16A34A",
  shopping: "#DB2777",
  "hidden-gems": "#4338CA",
  "family-kids": "#F59E0B",
  "date-night": "#BE123C",
  "landmarks-sightseeing": "#0369A1",
};
