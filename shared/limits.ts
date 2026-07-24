import type { UserGroup } from "./enums.js";

/**
 * Machine-readable enforcement numbers per tier, matching the marketing
 * copy in shared/pricing.ts. Kept separate from pricing.ts so the display
 * feature list and the actual gate values can be cross-checked against each
 * other rather than living as one hard-to-audit blob.
 */
export const TIER_LIMITS: Record<
  UserGroup,
  { maxMaps: number; maxPinsPerMap: number; aiSuggestionsPerDay: number; customBranding: boolean; maxCollaboratorsPerMap: number }
> = {
  freemium: { maxMaps: 3, maxPinsPerMap: 50, aiSuggestionsPerDay: 3, customBranding: false, maxCollaboratorsPerMap: 2 },
  basic: { maxMaps: 10, maxPinsPerMap: 200, aiSuggestionsPerDay: 15, customBranding: false, maxCollaboratorsPerMap: 8 },
  premium: { maxMaps: Infinity, maxPinsPerMap: Infinity, aiSuggestionsPerDay: 200, customBranding: true, maxCollaboratorsPerMap: Infinity },
};
