# PinTogather - Product Requirements Document (PRD)

**Version:** 2.0
**Last Updated:** July 20, 2026
**Status:** Active Development (MVP)

---

## 1. Product Overview

### 1.1 Vision
PinTogather lets communities, teams, and groups build a shared map together, pin by pin. Each contributor adds either their own location — where they are, or where they're based — or a specific venue worth visiting, found via Google Maps search. Some communities map where people are; others map the places they love; many do both. The platform bridges the gap between social networking and geographic visualization, making it easy for people to discover and share meaningful places together.

### 1.2 Problem Statement
Communities and teams often need to share location-based information but lack accessible tools that combine:
- Easy-to-use map creation
- Collaborative pin placement
- Social media integration
- Flexible sharing permissions

### 1.3 Target Users
- **Community Organizers**: Managing local meetup locations, community resources
- **Travel Groups**: Sharing recommended destinations, accommodations, restaurants
- **Real Estate Teams**: Mapping properties, neighborhoods, client preferences
- **Event Planners**: Coordinating venue locations, parking, amenities
- **Social Groups**: Sharing favorite spots, memories, recommendations

### 1.4 Key Value Propositions
1. **Simple Map Creation**: Create shareable maps in seconds
2. **Collaborative Editing**: Multiple contributors can add pins
3. **Social Integration**: Connect pins with social media profiles
4. **Flexible Privacy**: Control who can view and edit maps
5. **Rich Location Data**: Automatic address resolution with city, borough, postcode details

---

## 2. User Types & Subscription Tiers

### 2.1 User Roles

| Role | Description | Capabilities | Status |
|------|-------------|--------------|--------|
| **Owner** | Creator of a map collection | Full control: create, edit, delete maps; manage permissions; invite collaborators | Implemented |
| **Contributor** | Invited user with edit access | Add, edit, delete pins on shared maps | Implemented |
| **Viewer** | User with read-only access | View maps and pins; cannot modify content | Schema ready, enforced on invitation accept; not yet enforced on read |
| **Admin** | Platform administrator | Manage user tiers; platform-wide controls | Implemented |

### 2.2 Subscription Tiers

| Tier | Price | Features | Status |
|------|-------|----------|--------|
| **Freemium** | Free | 3 maps, 50 pins/map, 3 AI suggestions/day, 2 collaborators/map | AI suggestion + map/pin/seat limits enforced |
| **Basic** | £4.99/month | 10 maps, 200 pins/map, 15 AI suggestions/day, 8 collaborators/map, screenshot-based AI import, archive & restore maps, custom pin colors & icons | AI suggestion + map/pin/seat limits + screenshot import + map archiving + pin customization gates enforced |
| **Premium** | £9.99/month | Unlimited maps/pins/seats, 200 AI suggestions/day, custom branding, screenshot-based AI import, archive & restore maps, custom pin colors & icons | AI suggestion + map/pin/seat limits + custom branding + screenshot import + map archiving + pin customization gates enforced |

Stripe Checkout (`/pricing`) and the Stripe Customer Portal handle subscribing, upgrading/downgrading, and cancelling; a webhook (`/api/webhooks/stripe`) keeps `user_group` in sync with the actual subscription status. Per-tier limits live in `shared/limits.ts` (`TIER_LIMITS`). The AI-suggestions daily cap (`POST /api/maps/:shareUrl/venue-suggestions`) is enforced server-side, tracked per-user via `ai_suggestions_used_today`/`ai_suggestions_reset_at` (resets on a new UTC day) and returns a 429 with the limit once exhausted. `maxMaps` is enforced on map creation against the creating user's own tier; `maxPinsPerMap` is enforced on both the single-pin-add and bulk-import routes against the *map owner's* tier (not whoever's adding the pin) — bulk imports that would exceed the remaining room create as many new pins as fit and report the rest as skipped, while updates to already-existing pins are never capped. Custom branding (`brandingLogoUrl`) is gated on the *map owner's* tier at both write time (`POST /api/maps`, `PUT /api/maps/:mapId/details` reject a logo URL with a 403 if the owner isn't entitled) and display time (`GET /api/maps/:shareUrl` and `GET /api/profile/:username` null out `brandingLogoUrl` in the response if the owner isn't entitled) — the display-time gate matters because a downgraded user's stored logo URL must stop rendering immediately, not just block new writes. The map-creation form shows a locked upsell notice in place of the logo upload control for non-premium users. `maxCollaboratorsPerMap` caps how many people can have access to a single map — counting both accepted collaborators (`map_viewers`) and invitations still pending, so the cap can't be dodged by sending unrevoked invites — gated on the *map owner's* tier and enforced when creating a new invitation (`POST /api/maps/:mapId/invitations`); the Share dialog shows a live seat counter and swaps the invite form for an upgrade notice once the map's limit is reached.

**Screenshot-based AI import.** `screenshotImport` (`TIER_LIMITS`) gates a second way to seed the "Generate with AI" import tab: attaching an image (PNG/JPEG/WebP/GIF, max 4MB) instead of — or alongside — a text prompt. `POST /api/maps/:shareUrl/venue-suggestions/from-screenshot` (multipart, `isAuthenticated`) checks the *uploading user's* own tier (403 with an upgrade message for freemium), consumes from the same daily AI-suggestions budget as the text-only route (`checkAndIncrementAiUsage`), uploads the image to Directus via `storage.uploadVenueScreenshot` — stored under a per-user top-level folder named after the user's Directus id, with the file itself in that folder's `uploads` subfolder (`<userId>/uploads/`) — then sends the image as a vision content block to Claude (`VENUE_SCREENSHOT_SYSTEM_PROMPT`, tailored for extracting venue names from a photo, social post, or conversation screenshot rather than a text theme) and parses the same JSON-array response shape as the text route. The client (`import-pins.tsx`) shows a locked upsell notice in place of the attach button for freemium users, and swaps the text-mutation call for a multipart `apiUpload` call (extended to accept optional extra form fields) whenever a screenshot is attached.

**Map archiving.** `mapArchiving` (`TIER_LIMITS`, Basic/Premium only) gates a soft-hide alternative to the existing permanent "Delete map": `map_collections.archived` excludes a map from the home page's "My maps" list, the maxMaps quota count, and the public profile (`getPublicMapsByUserId` filters `archived: false`) — but never touches the map or its pins, which stay fully reachable via the map's own share link (and by any contributor). `POST /api/maps/archive` / `POST /api/maps/unarchive` (both `isAuthenticated`, both bulk — body `{ mapIds: string[] }`) 403 for freemium; restoring re-checks the maxMaps quota and, mirroring the bulk pin-import pattern, restores as many of the requested maps as fit and reports the rest as `skippedDueToLimit` rather than rejecting the whole batch. The home dashboard's "My maps" tab gets a "Select" bulk-select mode (Basic/Premium only) with an "Archive selected" action; a new "Archived" tab (hidden entirely for freemium) lists archived maps with the same bulk-select pattern for "Restore selected", plus a per-card "Restore" button. `GET /api/maps?archivedOnly=true` serves that tab. Visiting an archived map directly (its own share link, unaffected by any of this) shows an "Archived" badge and an inline "Restore" button in the header for its owner. `getMapCollectionsByUserId(userId, opts?)` takes an optional `{ archived?: boolean }` filter — omitted for ownership checks that must see archived maps too (pin-edit permission, invitation management), `false`/`true` for the quota-counting and listing call sites that must not.

**Custom pin colors & icons.** `pinCustomization` (`TIER_LIMITS`, Basic/Premium only) gates a fixed color palette (10 colors) and icon glyph set (14 icons, `PIN_COLOR`/`PIN_ICON` in `shared/enums.ts`) — a curated set rather than a free picker, so pins stay legible together on one map. A map has an optional `defaultPinColor`/`defaultPinIcon` (set via a collapsible "Default pin color & icon" section in the create/edit map form); each pin has its own optional `pinColor`/`pinIcon` override (set via the same picker in the add-pin dialog and the edit-pin page, shown only when the map's owner is entitled). Resolution order at render time (`resolvePinStyle` in `client/src/lib/pin-styles.ts`): a pin's own override → the map's default → the plain blue fallback that predates this feature. Gated on the *map owner's* tier (`getMapOwnerHasPinCustomization`), not the tier of whoever is adding/editing a pin, matching the `maxPinsPerMap`/custom-branding pattern — enforced at write time on `POST /api/maps`, `PUT /api/maps/:mapId/details`, `POST /api/maps/:shareUrl/pins`, and `PUT /api/pins/:id`, and re-checked at display time on `GET /api/maps/:shareUrl` (which also returns a `hasPinCustomization` flag so the client knows whether to show the picker to non-owner contributors), nulling out any previously-set colors/icons immediately if the owner's tier no longer qualifies. Markers are rendered as a data-URI SVG image (`buildPinMarkerIcon`) instead of the old `SymbolPath.CIRCLE` vector symbol, so a white icon glyph can sit inside the colored circle; a pin's `approved === false` state still shows regardless of its chosen color via a dashed gray ring layered around the marker, preserving the pending/approved visual signal that predates free pin coloring.

**Upgrade UX.** `GET /api/usage` returns the signed-in user's maps-owned and today's-AI-suggestions usage against their tier limits, powering proactive "X of Y used" nudges — with an upgrade link once at or near a limit — on the dashboard, the AI-suggestions panel (`import-pins.tsx`), and profile settings; `GET /api/maps/:shareUrl` also returns `maxPins` so map-detail can show the same nudge for a map's pin count. The header shows a persistent "Upgrade" button and current-plan label for non-premium signed-in users. Every tier-limit error response's `message` is surfaced cleanly in the client (see `client/src/lib/queryClient.ts`'s `throwIfResNotOk`, which parses the JSON body instead of stringifying it raw) and gets a one-click "View plans" action on the toast (`client/src/lib/upgradeToast.tsx`) when the message references `/pricing`. `POST /api/billing/checkout` rejects (400) starting a new Checkout session for a user who already has an active/trialing subscription, since Checkout always creates a brand-new subscription rather than modifying an existing one — `/pricing` instead routes an already-subscribed user to the Billing Portal ("Switch via billing portal") for changing or cancelling their plan.

### 2.3 Tier Management
- Users default to "freemium" tier upon registration
- Users can self-serve upgrade/downgrade/cancel via `/pricing` (Stripe Checkout + Customer Portal)
- Admins can also directly set a user's tier via the admin panel (bypasses billing — useful for comps/support)
- Tier stored on the user's `user_group` field (Directus `directus_users` collection); `stripe_customer_id`/`stripe_subscription_id`/`stripe_subscription_status` track the underlying Stripe state

---

## 3. Core Features

### 3.1 User Authentication & Profile Management

#### What's Implemented
- **Provider**: Clerk (email/password and any OAuth providers enabled on the Clerk instance — Google, GitHub, etc.)
- **Session Management**: Clerk session tokens, sent as `Authorization: Bearer <token>` on every API request and verified server-side by `@clerk/express`
- **Auth UI**: Clerk's `<SignIn/>` component on `/auth`, plus a modal variant (`auth-modal.tsx`) that opens Clerk's hosted sign-in
- **Profile Storage**: Extended fields directly on Directus's `directus_users` collection (`full_name`, `twitter_handle`, `instagram_handle`, `linkedin_handle`, `user_group`, `is_admin`, `clerk_user_id`, `avatar_url`)
- **Directus sync**: A Clerk webhook (`/api/webhooks/clerk`, signature-verified) upserts `directus_users` on `user.created`/`user.updated`, and marks the row `suspended` on `user.deleted`. A just-in-time upsert (`getCurrentUser` in `server/clerkAuth.ts`) covers the gap before the webhook lands, or a webhook left unconfigured in local dev.

#### Profile Features (Implemented)
- Full name management (editable independently of the Clerk-provided first/last name)
- Social media handles (Twitter/X, Instagram, LinkedIn)
- User group/tier tracking
- Self-service profile editing via `PUT /api/profile`

#### Current Limitations
- No Google/other OAuth is pre-configured — enabling additional sign-in methods is a Clerk Dashboard configuration step, not a code change
- Billing (Stripe Checkout/Portal/webhook) is implemented, but tier-based feature gating (the actual map/pin/AI-suggestion limits) is not enforced yet

---

### 3.2 Map Management

#### Map Collection Properties
| Field | Description | Status |
|-------|-------------|--------|
| `id` | Unique identifier (uuid) | Implemented |
| `name` | Map name (unique) | Implemented |
| `description` | Optional map description | Implemented |
| `shareUrl` | Unique URL for sharing | Implemented |
| `ownerId` | Owner's user id (Directus relation, not a bare string) | Implemented |
| `isPublic` | Public visibility toggle | Implemented (not yet enforced on read — share URL alone grants access, by design) |
| `defaultPermission` | Default permission ("readonly"/"editable") | Implemented — gates anonymous pin edits |
| `defaultPinColor`/`defaultPinIcon` | Default marker color/icon for this map's pins | Implemented — Basic/Premium only, see §2.2 |
| `createdAt` | Creation timestamp | Implemented |

#### Map Operations

| Operation | Status | Notes |
|-----------|--------|-------|
| Create Map | Implemented | Requires sign-in; owner set from the verified session |
| View Maps | Implemented | Dashboard shows owned + contributed maps with pin counts |
| Filter Maps | Implemented | Filter by owned/contributed maps |
| Delete Map | Implemented | Requires sign-in and ownership; cascades to pins, viewers, invitations |
| Edit Map | Implemented | Update sharing settings and permissions; requires ownership |

---

### 3.3 Pin Management

#### Pin Properties
All fields below are `Implemented`: `id`, `mapId`, `userId` (optional — anonymous pins are allowed), `userName`, `latitude`/`longitude`, `address`, `city`, `state`, `town`, `borough`, `postcode`, `country`, `twitterHandle`, `instagramHandle`, `linkedinHandle`, `note`, `pinColor`/`pinIcon` (optional per-pin marker override, Basic/Premium map owners only — see §2.2), `createdAt`.

#### Pin Operations

| Operation | Status | Notes |
|-----------|--------|-------|
| Add Pin | Implemented | Click map → geocode → fill form → save. Works signed-in or anonymous. |
| View Pins | Implemented | Map markers + table view |
| Edit Pin | Implemented | Map owner, or the pin's creator, may always edit; an anonymously-created pin on a map with `defaultPermission: editable` may be edited by anyone (preserves the "share the link" flow) |
| Delete Pin | Implemented | Same rule as edit |
| Bulk delete Pins | Implemented | Multi-select checkboxes in `PinTable` (only shown for pins the viewer can delete) + a "Delete selected" bar; `POST /api/pins/bulk-delete` reuses the same `isPinModifiable` check per pin, so a batch can partially succeed |
| Reverse Geocoding | Implemented | Uses OpenStreetMap Nominatim API |
| CSV export | Implemented | Client-side export from the map detail page |

---

### 3.4 Sharing & Collaboration

**Share button (map-detail page).** A standalone "Share" button in the map header (`SharePopover`, replacing the old hamburger-menu-only entry — the hamburger's own Share item is now hidden wherever a standalone button already covers it, via `MapActionsMenu`'s optional `onShare`) opens a popover with: copy-link, a row of social icons (Instagram, X, WhatsApp, Facebook), and — owner only — an "Invite by email" shortcut into the existing invite dialog (`ShareModal`, which now takes a `showLinkAndSocial` prop so it can drop its own duplicate copy-link/social section when opened from the popover; the dashboard's map-card grid still uses the full modal since it has no standalone button of its own).

Instagram, X, and WhatsApp share a **branded share image** (`generateShareImage` in `client/src/lib/share-image.ts`) — a 1080×1080 PNG composed entirely client-side via Canvas 2D (gradient background, a deterministic scatter of decorative pin glyphs seeded from the map id, the map's title auto-shrunk/wrapped to fit, "Curated by {owner}", and a pin-count pill) with no map imagery and no extra Google API — generating the actual map thumbnail would need the separate, cost-bearing Maps Static API, deliberately skipped for this feature. `ownerName` is resolved server-side and returned from `GET /api/maps/:shareUrl` alongside the existing map fields.

Instagram has no web share-intent URL at all, so the only way to hand it an image+caption is the OS-level share sheet: clicking any of the three icons tries `navigator.share({ files: [pngFile], title, text })` first (Web Share API Level 2) — on a supporting device this opens the native share sheet where the user picks whichever app (Instagram, X, WhatsApp, or anything else installed); the click target only changes the pre-filled caption text, since the Web Share API can't force-open one specific app. Where that's unsupported (typically desktop): Instagram falls back to downloading the image and copying the caption to the clipboard with a toast explaining the manual step; X/WhatsApp fall back to their existing URL share-intents (text + link, which those accept) *and* additionally download the image, since the URL intents alone can't carry an attachment. Facebook is link-only (its sharer.php scrapes the URL directly and never accepted a client-supplied image), unchanged from before.

**Permission Schema:**
| Permission Level | Capabilities | Enforcement Status |
|-----------------|---------------------|-------------------|
| **Readonly** | View map and pins only | Enforced for anonymous pin edits on the map; not yet enforced against direct share-URL viewing |
| **Editable** | Add, edit, delete pins | Enforced |

**Invitation System:**

| Feature | Status | Notes |
|---------|--------|-------|
| Create invitation | Implemented | Requires map ownership; a Directus Flow emails the recipient asynchronously (see below) |
| List invitations | Implemented | Requires map ownership |
| Delete invitation | Implemented | |
| Accept invitation | Implemented | `/invitations/:token` page; prompts sign-in if needed, then creates the corresponding `map_viewers` row, granting real access |
| Email notifications | Implemented | Sent by a Directus Flow (`directus/src/flows/`), not the app server — the SMTP relay Directus sends through is only reachable from Directus's own host, not the app server's deployment. The Flow triggers on `map_invitations` row creation, reads the map + inviter, and sends via Directus's own core mail transport. The Share dialog's "copy invite link" button is always available as a fallback regardless of email delivery. |

**Notification emails (Directus Flows, `directus/src/flows/`):**

| Flow | Trigger | Recipient | Notes |
|------|---------|-----------|-------|
| Map invitation | `map_invitations` created | Invitee | See above |
| New signup | `directus_users` created | All `is_admin=true` users | Fires once per real signup (`createUser`, not the update path returning users hit on every login) |
| Paid subscription | `directus_users` updated, `user_group` in `[basic, premium]` | All `is_admin=true` users | Can repeat on Stripe renewals, not just the first purchase — the app's webhook handler writes the same fields on both, and distinguishing them would need diffing against the previous revision. Accepted as a known limitation of an admin FYI email. |
| Invitation accepted | `map_invitations` updated, `status = accepted` | The original inviter | Uses the invitation's own `email` field (who it was sent to), not necessarily the Directus account that redeemed it — accepting a link only requires being signed in as *someone*, not the invited address (see §8.2) |

All four follow the same pattern: an event-hook trigger (`accountability: "all"`, so reads run with full data access regardless of who made the underlying write), `item-read` operations to resolve foreign keys the trigger payload doesn't carry, and a `mail` operation using Directus's core transport. The two admin-facing flows share a two-step "read `is_admin=true` users, then a Run Script (`exec`) operation joins their emails into one comma-separated string" recipient lookup, rather than hardcoding an admin address — single source of truth with the `is_admin` flag the app already uses.

---

### 3.5 Google Maps Integration

Unchanged from prior implementation — Google Maps JavaScript API (Map, Marker, Places), OpenStreetMap Nominatim as the reverse-geocoding fallback. Default center: London, UK.

**"My location" toggle.** A button next to "Reset view" (`simple-google-map.tsx`) lets a viewer show their own position on the map as a distinct blue dot with an accuracy halo — visually different from venue pins (Google's familiar `#4285F4` vs. the app's `#3B82F6`/`#F59E0B` pin colors) and always rendered on top (`zIndex: 9999`). Purely client-side and opt-in: the browser's location permission is never requested on page load, only when the button is clicked, and clicking again removes the marker and stops watching. Uses `navigator.geolocation.watchPosition` so the dot follows the viewer while enabled, but only pans/zooms the map to it the first time it appears — later updates move the marker without yanking the view. A 15-second client-side fallback timer resets the button out of its "locating" state if neither the success nor error callback ever fires (observed with an unanswered permission prompt), so it can't get stuck. Available to any viewer of a map, including anonymous ones — unrelated to pin edit permissions.

---

## 4. Technical Architecture

### 4.1 Stack Overview

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI Framework** | Radix UI, Tailwind CSS |
| **State Management** | TanStack Query (React Query v5) |
| **Routing** | Wouter |
| **Backend** | Express.js, TypeScript |
| **Data store** | Directus (headless CMS) over PostgreSQL |
| **Data access** | `@directus/sdk`, via a server-only static service token |
| **Authentication** | Clerk (`@clerk/clerk-react` + `@clerk/express`) |
| **Maps** | Google Maps JavaScript API |

The browser never talks to Directus directly — every request goes through the Express server (`server/routes.ts` → `server/storage.ts` → Directus's REST API), which is also where Clerk sessions are verified and ownership/permission checks are enforced.

### 4.2 Project Structure

```
├── client/
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── contexts/       # AuthContext (wraps Clerk)
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Utility libraries (incl. Clerk token bridge)
│       └── pages/          # Route pages
├── server/
│   ├── index.ts            # Server entry point
│   ├── routes.ts            # API route definitions + authorization
│   ├── storage.ts           # Directus data-access layer
│   ├── clerkAuth.ts          # Clerk middleware + directus_users resolution
│   ├── webhooks/clerk.ts     # Clerk → directus_users sync webhook
│   ├── services/users.ts     # Clerk ⇄ directus_users mapping
│   ├── lib/directus.ts       # Directus service client
│   └── vite.ts
├── shared/
│   ├── schema.ts             # Domain types + zod validation (camelCase)
│   ├── directus-schema.ts    # Typed Directus collections (snake_case)
│   └── enums.ts
├── directus/                 # Standalone schema/permissions bootstrap tool
│   └── src/{schema,permissions,lib}/
└── docker-compose.yml         # Local Directus + Postgres + Redis
```

### 4.3 Key Frontend Components

| Component | Purpose |
|-----------|---------|
| `simple-google-map.tsx` | Google Maps display with pin markers |
| `add-pin-modal.tsx` / `add-pin.tsx` | Pin creation |
| `create-map-form.tsx` | Map collection creation form |
| `delete-map-modal.tsx` | Confirmation modal for map deletion |
| `share-modal.tsx` / `share-settings-modal.tsx` | Sharing link display, permissions, invitations |
| `pin-table.tsx` | Tabular pin display with actions |
| `profile-modal.tsx` / `profile.tsx` | User profile view/edit |
| `auth-modal.tsx`, `pages/auth.tsx` | Sign-in (Clerk) |
| `activity-feed.tsx` | Recent activity display |

### 4.4 Key Pages

| Page | Route | Purpose |
|------|-------|---------|
| Home | `/` | Dashboard with map list |
| Map Detail | `/map/:shareUrl` | Interactive map view |
| Profile | `/profile` | User profile management |
| Admin | `/admin` | Admin panel for user management |
| Auth | `/auth` | Sign-in (Clerk) |
| Add Pin | `/map/:shareUrl/add-pin` | Pin creation page |
| Edit Pin | `/map/:shareUrl/edit-pin/:pinId` | Pin editing page |
| Not Found | `*` | 404 page |

---

## 5. Database Schema (Directus collections)

### 5.1 Collections Overview

| Collection | Purpose |
|-------|---------|
| `directus_users` | Accounts, synced from Clerk; carries profile + admin fields |
| `map_collections` | Map metadata and settings |
| `pins` | Location markers with metadata |
| `map_viewers` | Permission grants for maps (populated on invitation accept) |
| `map_invitations` | Email invitation tracking |

Schema is declared in code (`directus/src/schema/definitions.ts`) and applied idempotently via `npm run directus:schema:apply`; permissions (a single narrowly-scoped "PinTogather Service" role used by the Express server's static token) via `npm run directus:permissions:apply`.

### 5.2 Relationships
- `map_collections.owner` → `directus_users` (many-to-one, `SET NULL` on delete)
- `pins.map` → `map_collections` (many-to-one, `CASCADE` on delete)
- `pins.user` → `directus_users` (many-to-one, `SET NULL` on delete; nullable — anonymous pins)
- `map_viewers.map` → `map_collections` (`CASCADE`), `map_viewers.user` → `directus_users` (`CASCADE`); unique per (map, user)
- `map_invitations.map` → `map_collections` (`CASCADE`), `map_invitations.invited_by` → `directus_users` (`SET NULL`)

These are real, enforced foreign keys in Postgres (unlike the previous Drizzle schema, where `map_collections.ownerId` and `pins.userId` were bare, unenforced varchars).

---

## 6. API Endpoints

### 6.1 Health & Configuration

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/healthcheck` | None |
| GET | `/api/app-status` | None |
| GET | `/api/directus-health` | None |
| GET | `/api/config` | None (returns only the public Google Maps key) |

### 6.2 Auth & Profile

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| GET | `/api/auth/user` | Required | Returns the caller's own Directus-backed profile |
| PUT | `/api/profile` | Required | Updates the caller's own profile only |
| POST | `/api/webhooks/clerk` | Svix-verified | Clerk → directus_users sync |

### 6.3 Maps

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| GET | `/api/maps` | Required | `ownedOnly` / `contributedOnly` query flags; scoped to the caller |
| POST | `/api/maps` | Required | Owner is the verified caller, never client input |
| GET | `/api/maps/:shareUrl` | None | Anyone with the URL can view |
| PUT | `/api/maps/:mapId/permissions` | Required | Must be the map owner |
| DELETE | `/api/maps/:mapId` | Required | Must be the map owner |

### 6.4 Pins

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| POST | `/api/maps/:shareUrl/pins` | Optional | `userId` set from the session if present, otherwise anonymous |
| GET | `/api/pins/:id` | None | |
| PUT | `/api/pins/:id` | Optional | Map owner / pin creator, or anyone for an anonymous pin on an editable map |
| DELETE | `/api/pins/:id` | Optional | Same rule as PUT |

### 6.5 Invitations

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| POST | `/api/maps/:mapId/invitations` | Required | Must be the map owner |
| GET | `/api/maps/:mapId/invitations` | Required | Must be the map owner |
| POST | `/api/invitations/:token/accept` | Required | Grants a `map_viewers` row |
| DELETE | `/api/invitations/:id` | Required | |

### 6.6 Admin

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| GET | `/api/admin/users` | Required + `is_admin` | Admin status checked from the verified session, never a client header |
| PUT | `/api/admin/users/:userId/group` | Required + `is_admin` | |

### 6.7 Utilities

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/geocode` | None |

---

## 7. User Interface

Unchanged from the prior implementation: Tailwind + Radix UI, Lucide icons, light mode, modal-driven forms, card-based layouts, table views, toast notifications.

---

## 8. Security Posture

### 8.1 Fixed in this refactor
| Issue | Resolution |
|-------|------------|
| Client-trusted `userId` on maps/pins | Ownership (`ownerId`, pin `userId`) is now always derived from the verified Clerk session server-side, never from request body/query |
| No auth middleware on mutating endpoints | `@clerk/express` verifies every request; mutating map/pin/invitation/admin endpoints require a valid session and an ownership/admin check |
| Admin check trusted an `x-user-email` header | Admin status is read from the authenticated user's own `is_admin` field |
| Accepting an invitation didn't grant access | `POST /api/invitations/:token/accept` now creates the corresponding `map_viewers` row |
| No real foreign keys | `owner`/`user`/`map` relations are enforced Postgres foreign keys with `CASCADE`/`SET NULL` behavior |

### 8.2 Remaining / accepted gaps
- `isPublic` is not yet enforced on read — a map's share URL is treated as the access-control boundary by design (matches the original "share the link" product model)
- Rate limiting is not implemented
- Accepting a map invitation only requires the accepting user to be signed in as *some* account and hold a valid, unexpired token — it does not check that the signed-in account's email matches the invitation's `email` field. The invitation-accepted notification to the inviter is therefore based on the address the invite was sent to, which may not be the account that actually redeemed it.

---

## 9. Deployment

### 9.1 Environment Variables

See `.env.example` (app) and `directus/.env.example` (Directus instance) for the full, current list. At a minimum: `DIRECTUS_URL`, `DIRECTUS_SERVICE_TOKEN`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `GOOGLE_MAPS_API_KEY`.

### 9.2 Build Process
1. Client: Vite builds React app to `dist/public`
2. Server: ESBuild bundles TypeScript to `dist/index.js`
3. Production: `dist/start.js` handles environment setup

### 9.3 Local Development
Directus can be a local stack (`docker compose up -d` — Postgres + Redis + Directus) or an existing/hosted instance. `npm run directus:schema:apply` and `npm run directus:permissions:apply` provision the schema and a service account/token either way — pointed at a hosted instance shared with other projects, they only create PinTogather's own collections and a distinctly-named `PinTogather Service` policy/role, never touching anything they didn't create. `npm run dev` starts the Express + Vite dev server. See `replit.md` for the full walkthrough.

### 9.4 Health Monitoring
- `/api/healthcheck` for endpoint discovery
- `/api/app-status` for load balancer health checks
- `/api/directus-health` for Directus-specific debugging

---

## 10. Appendix

### 10.1 Glossary
- **Map Collection**: A named container for pins
- **Pin**: A geographic marker with metadata
- **Share URL**: Unique identifier for accessing a map
- **Viewer**: User with access to a shared map
- **Contributor**: User who can edit a shared map
- **Service token**: The long-lived Directus API token used exclusively by the Express server, scoped to a narrow "PinTogather Service" role with no admin/schema access

### 10.2 Version History
| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Jul 20, 2026 | Backend migrated from Supabase/Drizzle to Directus; authentication migrated from Replit Auth to Clerk; several security gaps closed (see §8.1) |
| 1.0 | Nov 25, 2025 | Initial PRD documenting current state with accurate implementation status |
