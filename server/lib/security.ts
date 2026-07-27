import helmet from "helmet";
import rateLimit from "express-rate-limit";

/**
 * Clerk publishable keys encode their Frontend API host as
 * base64(`<host>$`) after the `pk_test_`/`pk_live_` prefix — decoding it
 * (rather than hardcoding `*.clerk.accounts.dev`) means the CSP stays
 * correct if this project ever moves to a custom Clerk domain (e.g.
 * `clerk.<yourdomain>`) without anyone remembering to update it here.
 */
function clerkFrontendApiHost(): string | null {
  const key = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) return null;
  try {
    const encoded = key.split("_").slice(2).join("_");
    return Buffer.from(encoded, "base64").toString("utf8").replace(/\$+$/, "") || null;
  } catch {
    return null;
  }
}

/**
 * Baseline security headers (helmet defaults: X-Content-Type-Options,
 * X-Frame-Options, etc.) plus a Content-Security-Policy tuned to the third
 * parties this app actually loads client-side: Clerk (auth), the Google
 * Maps JS API, Google Fonts, and unpkg (Leaflet's CSS, used by the
 * lightweight map preview). Stripe Checkout/Billing Portal are plain
 * redirects (no Stripe.js embedded), so no stripe.com entries are needed.
 */
export function securityHeaders() {
  const clerkHost = clerkFrontendApiHost();

  // Vite's dev server (`npm run dev`) injects its own inline HMR/React-
  // Fast-Refresh preamble script into every page load — a dev-only
  // artifact that doesn't exist in the production build (`vite build`
  // emits only the external `/src/main.tsx`-derived bundle). Enforcing a
  // strict script-src against that would just break local dev for no
  // production security benefit, so the CSP only applies when built.
  const isProduction = process.env.NODE_ENV === "production";

  return helmet({
    contentSecurityPolicy: !isProduction ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://maps.googleapis.com", "https://replit.com", ...(clerkHost ? [`https://${clerkHost}`] : [])],
        // 'unsafe-inline' is required here: Tailwind/shadcn components and
        // this app's own chart component (client/src/components/ui/chart.tsx)
        // inject inline <style> tags; Google Maps does the same internally.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://maps.gstatic.com",
          "https://maps.googleapis.com",
          "https://*.googleapis.com",
          "https://*.ggpht.com",
          "https://img.clerk.com",
        ],
        connectSrc: ["'self'", "https://maps.googleapis.com", ...(clerkHost ? [`https://${clerkHost}`] : [])],
        frameSrc: ["'self'", ...(clerkHost ? [`https://${clerkHost}`] : [])],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    // Cross-Origin-Embedder-Policy/Resource-Policy default to fairly strict
    // settings that can block loading Google Maps tiles or the Clerk
    // widget's cross-origin resources — this app has no need for the
    // cross-origin isolation those headers exist to enable.
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  });
}

/** Applies to every /api/* request — generous enough for normal dashboard usage, low enough to blunt scripted abuse. */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests — please slow down and try again shortly." },
});

/**
 * Tighter limit for endpoints that are both mutating and reachable without
 * signing in (anonymous pin adds) or that fan out to a third party per
 * request (invitation emails) — worth throttling harder than the general
 * API traffic above.
 */
export const sensitiveWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests — please slow down and try again shortly." },
});
