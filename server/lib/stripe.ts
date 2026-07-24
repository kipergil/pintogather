import Stripe from "stripe";

/**
 * Null until STRIPE_SECRET_KEY is set — every call site checks this and
 * returns a clean "not configured" response instead, mirroring the Anthropic
 * client in routes.ts, so the app runs fine before billing is wired up.
 */
export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const STRIPE_PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC || null,
  premium: process.env.STRIPE_PRICE_PREMIUM || null,
} as const;
