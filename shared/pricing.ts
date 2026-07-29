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
 * app itself ("<App> branding on public maps") — `shared/` can't read any
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
        "3 maps",
        "Up to 50 pins per map",
        "3 AI generations per day (prompt or screenshot)",
        "Screenshot-based AI import",
        "Up to 2 collaborators per map",
        `${appName} branding on public maps`,
      ],
    },
    {
      id: "basic",
      name: "Basic",
      priceLabel: "£4.99/mo",
      checkoutTier: "basic",
      features: [
        "10 maps",
        "Up to 200 pins per map",
        "15 AI generations per day (prompt or screenshot)",
        "Up to 8 collaborators per map",
        `${appName} branding on public maps`,
        "Archive & restore maps",
        "Custom pin colors & icons",
      ],
    },
    {
      id: "premium",
      name: "Premium",
      priceLabel: "£9.99/mo",
      checkoutTier: "premium",
      features: [
        "Unlimited maps",
        "Unlimited pins per map",
        "200 AI generations per day (prompt or screenshot)",
        "Unlimited collaborators per map",
        "Your own branding on public maps",
        "Archive & restore maps",
        "Custom pin colors & icons",
      ],
    },
  ];
}
