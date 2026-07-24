# Environment Variables Setup

## Overview

PinTogather is configured entirely through environment variables — no secrets are committed to the repo. This doc lists every variable the app reads, explains where each one comes from, and how to set them locally and in Vercel.

A variable prefixed `VITE_` is bundled into the **client-side** JavaScript and is visible to anyone who opens the site — never put a real secret behind a `VITE_` name. Everything else is server-only and stays on the backend.

## Quick reference — all variables

| Variable | Used by | Required | Notes |
|---|---|---|---|
| `DIRECTUS_URL` | Server + client build | Yes | Base URL of the Directus instance |
| `DIRECTUS_SERVICE_TOKEN` | Server only | Yes | Static token; browser never talks to Directus directly |
| `CLERK_PUBLISHABLE_KEY` | Server (Clerk SDK) | Yes | Same value as `VITE_CLERK_PUBLISHABLE_KEY` |
| `CLERK_SECRET_KEY` | Server only | Yes | Verifies signed-in sessions |
| `VITE_CLERK_PUBLISHABLE_KEY` | Client (build-time) | Yes | Public by design |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Server only | Recommended | Verifies the `user.*` webhook that syncs `directus_users`; app falls back to a slower just-in-time sync without it |
| `GOOGLE_MAPS_API_KEY` | Server, proxied to client via `/api/config` | Yes | Powers the map, Places search, geocoding |
| `VITE_GOOGLE_MAPS_API_KEY` | Client (build-time) | Optional | Legacy fallback only — `/api/config` is the real path, this key is rarely needed |
| `ANTHROPIC_API_KEY` | Server only | Yes (for AI venue suggestions) | App runs fine without it; that one feature 503s |
| `STRIPE_SECRET_KEY` | Server only | Yes (for billing) | App runs fine without it; billing routes 503 |
| `STRIPE_WEBHOOK_SECRET` | Server only | Yes (for billing) | Per-endpoint — production and local dev need different values |
| `STRIPE_PRICE_BASIC` | Server only | Yes (for billing) | Stripe Price ID, not a secret |
| `STRIPE_PRICE_PREMIUM` | Server only | Yes (for billing) | Stripe Price ID, not a secret |
| `ADMIN_EMAILS` | Server only | Yes | Comma-separated list; grants admin panel + quick-edit access |
| `PORT` | Server only | No | Defaults to `5000`; Vercel ignores this and manages its own port |
| `NODE_ENV` | Server + build tooling | No | `development` locally; Vercel sets this itself, don't override it there |

## How to retrieve each key

### Directus — `DIRECTUS_URL`, `DIRECTUS_SERVICE_TOKEN`

Directus is a separately hosted service (see `docker-compose.yml` for local dev, or your hosted Directus instance's admin panel for production).

1. `DIRECTUS_URL` — the base URL of your Directus instance, e.g. `https://your-instance.directus.app` (no trailing slash).
2. `DIRECTUS_SERVICE_TOKEN` — a **static access token** for a service account:
   - Log into the Directus admin panel → **Settings → Access Tokens** (or open the user you want to act as service account, under **User Directory**).
   - Create/open a user intended as the app's service account, scroll to **Token**, and generate a static token.
   - Copy it immediately — Directus only shows it once.
   - This account needs read/write permissions on all app collections (`map_collections`, `pins`, `map_viewers`, `map_invitations`, `directus_users`, and file storage).

### Clerk — `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → select (or create) your application.
2. **API Keys** page (left sidebar):
   - **Publishable key** → use for both `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` (same value).
   - **Secret key** → `CLERK_SECRET_KEY`.
   - Clerk has separate key pairs for **development** and **production** instances — make sure you're copying from the instance that matches the environment you're configuring.
3. **Webhooks** page → create an endpoint pointing at `https://<your-domain>/api/webhooks/clerk`, subscribe it to at least `user.created`, `user.updated`, `user.deleted` → copy the endpoint's **Signing Secret** → `CLERK_WEBHOOK_SIGNING_SECRET`.
   - Each environment (local via a tunnel, preview, production) that needs live webhook delivery needs its own endpoint and therefore its own signing secret.

### Google Maps — `GOOGLE_MAPS_API_KEY`

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → select or create a project.
2. **APIs & Services → Library** → enable: **Maps JavaScript API**, **Places API**, **Geocoding API**.
3. **APIs & Services → Credentials** → **Create Credentials → API Key**.
4. Click the new key → under **Application restrictions**, restrict it to your domain(s) (HTTP referrers) for production; under **API restrictions**, limit it to the three APIs enabled above.
5. Copy the key → `GOOGLE_MAPS_API_KEY`.

### Anthropic — `ANTHROPIC_API_KEY`

1. Go to [console.anthropic.com](https://console.anthropic.com) → **Settings → API Keys**.
2. **Create Key**, name it (e.g. `pintogather-prod`), copy the value immediately — it's shown only once.
3. Ensure the workspace/organization has billing set up, or requests will fail once free credits run out.

### Stripe — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM`

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com). Use the **test mode** toggle (top right) while developing; switch to live mode only when ready to charge real cards — each mode has its own separate set of keys and Price IDs.
2. **Developers → API keys** → copy the **Secret key** (`sk_test_...` or `sk_live_...`) → `STRIPE_SECRET_KEY`. Never use the Publishable key here; the app doesn't need it.
3. **Product catalog → Add product** — create one product per paid tier (e.g. "Basic", "Premium"), each with a recurring monthly price:
   - Open the created price → copy its **Price ID** (`price_...`) → `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PREMIUM` respectively.
4. **Developers → Webhooks → Add endpoint**:
   - Endpoint URL: `https://<your-domain>/api/webhooks/stripe`
   - Events to send: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the endpoint's **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.
   - Test mode and live mode each need their own webhook endpoint and therefore their own signing secret — a webhook secret from one mode will not verify events from the other.
   - For local development, use the [Stripe CLI](https://docs.stripe.com/stripe-cli) (`stripe listen --forward-to localhost:5000/api/webhooks/stripe`) instead of a dashboard endpoint — it prints a signing secret scoped to your local session.

### App-level — `ADMIN_EMAILS`, `PORT`, `NODE_ENV`

- `ADMIN_EMAILS` — comma-separated list of email addresses (must match the user's Clerk/Directus email) that get admin panel access and the Directus quick-edit buttons, e.g. `owner@example.com,teammate@example.com`. Not a third-party value — just decide who should be an admin.
- `PORT` — only matters for local dev / self-hosting; leave unset on Vercel.
- `NODE_ENV` — set to `development` in your local `.env`; don't set it in Vercel, Vercel manages this itself.

## Setting the variables

### Locally

Create a `.env` file at the repo root (already gitignored — never commit it) with one `KEY=value` line per variable above. `server/index.ts` loads it via `dotenv` on startup.

### Vercel

Two ways:

1. **Dashboard** — Project → **Settings → Environment Variables** → add each key/value, choosing which environments (Production / Preview / Development) it applies to.
2. **Vercel REST API** — for scripted setup, `POST https://api.vercel.com/v10/projects/{projectIdOrName}/env` with a personal access token (create one at [vercel.com/account/tokens](https://vercel.com/account/tokens)), body:
   ```json
   { "key": "STRIPE_SECRET_KEY", "value": "sk_test_...", "type": "encrypted", "target": ["production", "preview", "development"] }
   ```
   Use `"type": "encrypted"` for secrets and `"type": "plain"` for non-sensitive values like Price IDs or the Directus URL. After adding/changing variables, redeploy for them to take effect — existing deployments don't pick up new values retroactively.

Test-mode Stripe keys are fine to run in production while you're not ready to accept real payments; just remember to swap in live-mode keys (and a live-mode webhook endpoint/secret) before launch.
