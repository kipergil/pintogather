import express, { type Express, type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { handleClerkWebhook } from "./webhooks/clerk.js";
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

  // Registered before express.json(): Clerk's webhook signature is computed
  // over the exact request bytes, so this route needs the raw body rather
  // than the app-wide JSON-parsed one.
  app.post("/api/webhooks/clerk", express.raw({ type: "application/json" }), handleClerkWebhook);

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
