import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";

/**
 * Vercel Node.js Serverless Function entrypoint. Every request under
 * /api/* (see vercel.json's rewrites) is routed here; the static SPA build
 * (dist/public) is served directly by Vercel, not through this function.
 *
 * The Express app is built once per cold start and reused across warm
 * invocations of the same function instance — there is no `.listen()`
 * here, Vercel owns the HTTP layer.
 */
const appPromise = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  app(req, res);
}
