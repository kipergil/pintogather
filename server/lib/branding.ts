/**
 * Single source of truth for the app's display name server-side (Nominatim
 * User-Agent, etc.) so a project rename is a config change. Mirrors
 * client/src/lib/branding.ts and mobile/src/lib/config.ts's APP_NAME —
 * each platform resolves its own copy since there's no shared env-loading
 * mechanism across Vite/Expo/Node.
 */
export const APP_NAME = process.env.APP_NAME ?? "PinTogather";

/**
 * Username of the dedicated, login-less directus_users row that owns
 * PinTogather-authored curated maps (see /api/discover and the "convert to
 * curated map" admin flow) — distinct from APP_NAME since it's a technical
 * identifier (must be a valid, already-provisioned username), not display copy.
 */
export const CURATED_MAPS_SYSTEM_USERNAME = process.env.CURATED_MAPS_SYSTEM_USERNAME ?? "pintogather";
