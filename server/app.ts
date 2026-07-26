import express, { type Express, type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { handleClerkWebhook } from "./webhooks/clerk.js";
import { handleStripeWebhook } from "./webhooks/stripe.js";
import { log } from "./log.js";

/**
 * Builds the Express app with every route registered, but does not bind it
 * to a port. Shared by both entrypoints:
 *  - server/index.ts (traditional long-running server — Replit, Docker,
 *    any host that runs `npm start`)
 *  - api/index.ts (Vercel serverless function — one process per
 *    invocation, no `.listen()`)
 */
export async function createApp(): Promise<Express> {
  const app = express();

  // The web app is served from this same origin, so it never needed CORS.
  // The mobile app (native builds have no concept of CORS at all — it's a
  // browser-only mechanism — but its `expo start --web` preview target
  // does) is a genuinely separate origin, so /api/* gets permissive CORS
  // headers. Safe to reflect any origin here specifically because API auth
  // is Bearer-token-only for cross-origin callers (see shared/api-client.ts's
  // `includeCredentials` flag) — there's no ambient cookie a hostile page
  // could ride along, which is the actual risk `Access-Control-Allow-
  // Credentials`+wildcard-origin combinations guard against.
  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Registered before express.json(): Clerk's webhook signature is computed
  // over the exact request bytes, so this route needs the raw body rather
  // than the app-wide JSON-parsed one.
  app.post("/api/webhooks/clerk", express.raw({ type: "application/json" }), handleClerkWebhook);

  // Same reasoning as the Clerk webhook above — Stripe's signature covers
  // the raw request bytes.
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  return app;
}
