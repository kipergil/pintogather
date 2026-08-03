import type { Request, Response } from "express";
import { stripe, STRIPE_PRICE_IDS } from "../lib/stripe.js";
import { changedSubscriptionFields, subscriptionStateFor } from "../lib/subscription-sync.js";
import { getUserByStripeCustomerId } from "../services/users.js";
import { storage } from "../storage.js";
import type Stripe from "stripe";

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const user = await getUserByStripeCustomerId(customerId);
  if (!user) {
    console.error(`Stripe webhook: no user found for customer ${customerId}`);
    return;
  }

  const next = subscriptionStateFor(subscription, STRIPE_PRICE_IDS);
  const changes = changedSubscriptionFields(user, next);

  // Stripe re-sends customer.subscription.updated for renewals and its own
  // internal churn, so most of these events say nothing new. Writing the same
  // values back would still touch the row, and the Directus Flow watching
  // those writes would email admins about a subscription that didn't move.
  if (Object.keys(changes).length === 0) return;

  await storage.updateStripeSubscription(user.id, changes);
}

/**
 * Verifies and applies Stripe's subscription-lifecycle webhooks, keeping
 * userGroup in sync with the customer's actual billing status. Registered
 * in server/app.ts with a raw body parser — Stripe's signature is computed
 * over the exact request bytes, so this route must run before the app-wide
 * express.json() middleware (same pattern as the Clerk webhook).
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: "Billing isn't configured yet" });
    return;
  }

  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature as string, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription || !session.customer) break;

        const userId = session.metadata?.userId;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;

        if (userId) {
          await storage.updateStripeSubscription(userId, { stripeCustomerId: customerId });
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      // Event type we don't act on — ack and ignore.
      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}
