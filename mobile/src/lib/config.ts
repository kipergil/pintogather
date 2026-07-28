/**
 * Expo inlines any EXPO_PUBLIC_*-prefixed variable from mobile/.env directly
 * into process.env at build time — no expo-constants indirection needed.
 * See mobile/.env.example for what each of these is and where to get it.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";

/** Display name used in UI copy (e.g. share captions, empty states) — mirrors app.config.ts's `name`, which is also EXPO_PUBLIC_APP_NAME-driven. */
export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? "PinGather";

/** Base URL of the web app's public pages (e.g. /map/:shareUrl) — used to build shareable links. Defaults to API_URL since this monorepo serves both from the same origin. */
export const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? API_URL;

export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!CLERK_PUBLISHABLE_KEY) {
  console.warn(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — copy mobile/.env.example to mobile/.env and fill it in, or sign-in will fail.",
  );
}
