import { verifyWebhook } from "@clerk/express/webhooks";
import type { Request, Response } from "express";
import { deactivateUserByClerkId, upsertUserFromClerk } from "../services/users.js";

/**
 * Verifies and applies Clerk's `user.*` webhooks, keeping directus_users in
 * sync as the primary path (see clerkAuth.ts's getCurrentUser for the JIT
 * fallback that covers the gap before this lands, or a misconfigured
 * webhook in local dev). Registered in server/index.ts with a raw body
 * parser — verifyWebhook needs the exact bytes Clerk signed, so this route
 * must run before the app-wide express.json() middleware.
 */
export async function handleClerkWebhook(req: Request, res: Response): Promise<void> {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  let event;
  try {
    event = await verifyWebhook(req);
  } catch {
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    if (event.type === "user.deleted") {
      if (event.data.id) await deactivateUserByClerkId(event.data.id);
      res.json({ received: true });
      return;
    }

    if (event.type === "user.created" || event.type === "user.updated") {
      const data = event.data;
      const primaryEmailAccount =
        data.email_addresses?.find((e) => e.id === data.primary_email_address_id) ?? data.email_addresses?.[0];

      await upsertUserFromClerk({
        clerkUserId: data.id,
        email: primaryEmailAccount?.email_address ?? null,
        firstName: data.first_name ?? null,
        lastName: data.last_name ?? null,
        profileImageUrl: data.image_url ?? null,
      });
      res.json({ received: true });
      return;
    }

    // Event type we don't act on (e.g. session.*, organization.*) — ack and ignore.
    res.json({ received: true });
  } catch (error) {
    console.error("Error processing Clerk webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}
