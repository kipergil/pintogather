import type Stripe from "stripe";
import type { UserGroup } from "../../shared/enums.js";

/**
 * Works out what a Stripe subscription means for our own user row, and what
 * (if anything) actually needs writing.
 *
 * Kept apart from the webhook handler because the "has anything changed?"
 * question has teeth: Stripe re-sends `customer.subscription.updated` for
 * renewals, payment-method edits, and its own internal churn, and writing the
 * same tier back every time makes the row look updated when the subscription
 * didn't move. Directus Flows watch those writes to notify admins, so a
 * no-op write is a spurious "New basic subscription" email.
 */

/** Statuses that keep a user on their paid tier; anything else (canceled, unpaid, incomplete_expired, ...) drops them to freemium. */
export const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"]);

export interface SubscriptionState {
  stripeSubscriptionId: string;
  stripeSubscriptionStatus: string;
  userGroup: UserGroup;
}

export function tierForPriceId(
  priceId: string | null | undefined,
  priceIds: { basic: string | null; premium: string | null },
): "basic" | "premium" | null {
  if (!priceId) return null;
  if (priceIds.basic && priceId === priceIds.basic) return "basic";
  if (priceIds.premium && priceId === priceIds.premium) return "premium";
  return null;
}

/** The row state a given subscription implies, regardless of what's currently stored. */
export function subscriptionStateFor(
  subscription: Stripe.Subscription,
  priceIds: { basic: string | null; premium: string | null },
): SubscriptionState {
  const priceId = subscription.items.data[0]?.price?.id;
  const tier = ACTIVE_STATUSES.has(subscription.status) ? tierForPriceId(priceId, priceIds) : null;
  return {
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status,
    userGroup: tier ?? "freemium",
  };
}

/**
 * The subset of `next` that differs from what's already stored — empty when
 * the subscription hasn't actually moved, which is the caller's cue to skip
 * the write entirely rather than PATCH identical values.
 */
export function changedSubscriptionFields(
  // Nullable because that's how the columns come back before a first purchase.
  current: {
    stripeSubscriptionId?: string | null;
    stripeSubscriptionStatus?: string | null;
    userGroup?: UserGroup | null;
  },
  next: SubscriptionState,
): Partial<SubscriptionState> {
  const changes: Partial<SubscriptionState> = {};
  if (current.stripeSubscriptionId !== next.stripeSubscriptionId) {
    changes.stripeSubscriptionId = next.stripeSubscriptionId;
  }
  if (current.stripeSubscriptionStatus !== next.stripeSubscriptionStatus) {
    changes.stripeSubscriptionStatus = next.stripeSubscriptionStatus;
  }
  if (current.userGroup !== next.userGroup) changes.userGroup = next.userGroup;
  return changes;
}
