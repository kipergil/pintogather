/**
 * Expo inlines any EXPO_PUBLIC_*-prefixed variable from mobile/.env directly
 * into process.env at build time — no expo-constants indirection needed.
 * See mobile/.env.example for what each of these is and where to get it.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";

export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!CLERK_PUBLISHABLE_KEY) {
  console.warn(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — copy mobile/.env.example to mobile/.env and fill it in, or sign-in will fail.",
  );
}
