import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import type { User } from "@shared/schema";
import { getUserByClerkId, upsertUserFromClerk } from "./services/users";

export function setupAuth(app: Express): void {
  app.use(clerkMiddleware());
}

/** 401s anonymous requests; otherwise lets the request through. */
export const isAuthenticated: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

/**
 * Resolves the signed-in Clerk session to its mapped directus_users row.
 * Returns null for anonymous visitors. The Clerk webhook
 * (server/webhooks/clerk.ts) keeps directus_users in sync as the primary
 * path; this JIT upsert is the fallback for the gap between sign-up and the
 * webhook landing (or a webhook misconfigured in local dev) — same upsert
 * function either way, so the two paths can't drift.
 */
export async function getCurrentUser(req: Request): Promise<User | null> {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return null;

  const existing = await getUserByClerkId(clerkUserId);
  if (existing) return existing;

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;

  return upsertUserFromClerk({
    clerkUserId: clerkUser.id,
    email: primaryEmail,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    profileImageUrl: clerkUser.imageUrl,
  });
}

/** Throws if anonymous — use in route handlers that require a signed-in user. */
export async function requireCurrentUser(req: Request): Promise<User> {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new Error("You must be signed in to do that.");
  }
  return user;
}
