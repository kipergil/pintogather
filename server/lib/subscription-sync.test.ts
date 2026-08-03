import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import {
  ACTIVE_STATUSES,
  changedSubscriptionFields,
  subscriptionStateFor,
  tierForPriceId,
  type SubscriptionState,
} from "./subscription-sync";

const PRICE_IDS = { basic: "price_basic", premium: "price_premium" };

/** Just the parts of a Stripe subscription this module reads. */
const subscription = (
  overrides: { id?: string; status?: Stripe.Subscription.Status; priceId?: string | null } = {},
) =>
  ({
    id: overrides.id ?? "sub_123",
    status: overrides.status ?? "active",
    customer: "cus_123",
    items: { data: overrides.priceId === null ? [] : [{ price: { id: overrides.priceId ?? "price_basic" } }] },
  }) as unknown as Stripe.Subscription;

describe("tierForPriceId", () => {
  it.each([
    ["price_basic", "basic"],
    ["price_premium", "premium"],
  ])("maps %s to the %s tier", (priceId, tier) => {
    expect(tierForPriceId(priceId, PRICE_IDS)).toBe(tier);
  });

  it.each([null, undefined, "price_something_else"])("returns null for %s", (priceId) => {
    expect(tierForPriceId(priceId, PRICE_IDS)).toBeNull();
  });

  it("doesn't match an unconfigured price id against a null config", () => {
    // Both sides null would otherwise compare equal and silently hand out a
    // paid tier on an instance where billing isn't set up.
    expect(tierForPriceId(null, { basic: null, premium: null })).toBeNull();
    expect(tierForPriceId(undefined, { basic: null, premium: null })).toBeNull();
  });
});

describe("subscriptionStateFor", () => {
  it.each(Array.from(ACTIVE_STATUSES))("keeps the paid tier while %s", (status) => {
    expect(subscriptionStateFor(subscription({ status }), PRICE_IDS)).toEqual({
      stripeSubscriptionId: "sub_123",
      stripeSubscriptionStatus: status,
      userGroup: "basic",
    });
  });

  it.each(["canceled", "unpaid", "past_due", "incomplete_expired", "paused"] as Stripe.Subscription.Status[])(
    "drops to freemium when %s",
    (status) => {
      expect(subscriptionStateFor(subscription({ status }), PRICE_IDS)).toMatchObject({
        stripeSubscriptionStatus: status,
        userGroup: "freemium",
      });
    },
  );

  it("falls back to freemium for a price we don't recognise", () => {
    expect(subscriptionStateFor(subscription({ priceId: "price_legacy" }), PRICE_IDS).userGroup).toBe("freemium");
  });

  it("falls back to freemium for a subscription with no line items", () => {
    expect(subscriptionStateFor(subscription({ priceId: null }), PRICE_IDS).userGroup).toBe("freemium");
  });
});

describe("changedSubscriptionFields", () => {
  const active: SubscriptionState = {
    stripeSubscriptionId: "sub_123",
    stripeSubscriptionStatus: "active",
    userGroup: "basic",
  };

  it("reports nothing when a renewal restates exactly what's stored", () => {
    // This is the whole point: Stripe re-sends customer.subscription.updated
    // for renewals and its own churn. Writing identical values back would
    // still touch the row, and the Directus Flow watching those writes would
    // email admins about a subscription that hasn't moved.
    expect(changedSubscriptionFields(active, active)).toEqual({});
  });

  it("reports the tier when a user upgrades", () => {
    expect(changedSubscriptionFields(active, { ...active, userGroup: "premium" })).toEqual({
      userGroup: "premium",
    });
  });

  it("reports the tier when a subscription lapses", () => {
    expect(
      changedSubscriptionFields(active, {
        ...active,
        stripeSubscriptionStatus: "canceled",
        userGroup: "freemium",
      }),
    ).toEqual({ stripeSubscriptionStatus: "canceled", userGroup: "freemium" });
  });

  it("reports a status change on its own without touching the tier", () => {
    // past_due keeps the tier but is worth recording; the flow's plan gate
    // means a status-only write no longer sends an email.
    const changes = changedSubscriptionFields(active, { ...active, stripeSubscriptionStatus: "past_due" });
    expect(changes).toEqual({ stripeSubscriptionStatus: "past_due" });
    expect(changes.userGroup).toBeUndefined();
  });

  it("reports everything for a first-ever purchase, where nothing is stored yet", () => {
    expect(changedSubscriptionFields({ stripeSubscriptionId: null, stripeSubscriptionStatus: null }, active)).toEqual(
      active,
    );
  });

  it("notices a switch to a different subscription on the same customer", () => {
    expect(changedSubscriptionFields(active, { ...active, stripeSubscriptionId: "sub_456" })).toEqual({
      stripeSubscriptionId: "sub_456",
    });
  });

  it("treats a freemium user with no stored subscription as unchanged by a canceled one", () => {
    const lapsed: SubscriptionState = {
      stripeSubscriptionId: "sub_123",
      stripeSubscriptionStatus: "canceled",
      userGroup: "freemium",
    };
    expect(changedSubscriptionFields(lapsed, lapsed)).toEqual({});
  });
});
