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
 */
export const PRICING_TIERS: PricingTier[] = [
  {
    id: "freemium",
    name: "Free",
    priceLabel: "Free",
    features: [
      "3 maps",
      "Up to 50 pins per map",
      "3 AI venue suggestions per day",
      "Up to 2 collaborators per map",
      "PinTogather branding on public maps",
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
      "15 AI venue suggestions per day",
      "Up to 8 collaborators per map",
      "PinTogather branding on public maps",
      "Screenshot-based AI venue import",
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
      "200 AI venue suggestions per day",
      "Unlimited collaborators per map",
      "Your own branding on public maps",
      "Screenshot-based AI venue import",
    ],
  },
];
