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
const appPromise = createApp().catch((error) => {
  console.error("[api/index] createApp() failed:", error);
  throw error;
});

process.on("unhandledRejection", (reason) => {
  console.error("[api/index] unhandledRejection:", reason);
});

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await appPromise;
    app(req, res);
  } catch (error: any) {
    console.error("[api/index] handler error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          message: "DEBUG: handler crashed",
          error: error?.message,
          stack: error?.stack,
        }),
      );
    }
  }
}
