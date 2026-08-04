import type { UserGroup } from "./enums.js";

export interface PricingTier {
  id: UserGroup;
  name: string;
  priceLabel: string;
  /** Only set for paid tiers — the checkout endpoint uses this to pick a Stripe Price. */
  checkoutTier?: "basic" | "premium";
  features: string[];
}

/**
 * Display + feature copy for the three tiers. Kept alongside enums.ts rather
 * than hardcoded separately in the client and server so pricing copy only
 * needs updating in one place. Actual limit numbers (maps/pins/AI
 * generations per day) are enforced server-side elsewhere — this is just
 * the marketing-facing feature list.
 *
 * A function rather than a static array because one line of copy names the
 * app itself ("<App> branding on public collections") — `shared/` can't read any
 * platform's env vars (Vite's `import.meta.env`, Expo's `process.env.EXPO_PUBLIC_*`,
 * and Node's `process.env` all resolve differently), so each caller passes
 * in its own already-resolved app name instead.
 */
export function getPricingTiers(appName: string): PricingTier[] {
  return [
    {
      id: "freemium",
      name: "Free",
      priceLabel: "Free",
      features: [
        "3 collections",
        "Up to 50 items per collection",
        "3 AI generations per day — from a prompt, a screenshot, or a photo",
        "Up to 2 collaborators per collection",
        `${appName} branding on public collections`,
      ],
    },
    {
      id: "basic",
      name: "Basic",
      priceLabel: "£4.99/mo",
      checkoutTier: "basic",
      features: [
        "10 collections",
        "Up to 200 items per collection",
        "15 AI generations per day — from a prompt, a screenshot, or a photo",
        "Up to 8 collaborators per collection",
        `${appName} branding on public collections`,
        "Archive & restore collections",
        "Custom pin colours & icons (place collections)",
      ],
    },
    {
      id: "premium",
      name: "Premium",
      priceLabel: "£9.99/mo",
      checkoutTier: "premium",
      features: [
        "Unlimited collections",
        "Unlimited items per collection",
        "200 AI generations per day — from a prompt, a screenshot, or a photo",
        "Unlimited collaborators per collection",
        "Your own branding on public collections",
        "Archive & restore collections",
        "Custom pin colours & icons (place collections)",
      ],
    },
  ];
}
