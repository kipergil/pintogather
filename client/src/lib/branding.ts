/**
 * Single source of truth for the app's display name in web UI copy.
 * Reads VITE_APP_NAME (set in the root .env — see .env.example) so a
 * project rename is a config change, not a find-and-replace across every
 * component. Falls back to "PinGather" so nothing breaks if unset.
 */
export const APP_NAME = import.meta.env.VITE_APP_NAME ?? "PinGather";

/** URL/filename-safe version of APP_NAME, e.g. for downloaded share images. */
export const APP_SLUG = APP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";

/**
 * Where "support this project" links point. Reads VITE_KOFI_URL so a fork
 * can't end up collecting coffees for someone else, and so the whole
 * support UI can be switched off by setting it empty — SupportBox and
 * SupportLink render nothing without a URL.
 */
export const SUPPORT_URL = (import.meta.env.VITE_KOFI_URL ?? "https://ko-fi.com/kipergil").trim();
