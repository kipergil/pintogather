# PinTogather - Product Requirements Document (PRD)

**Version:** 2.0
**Last Updated:** July 20, 2026
**Status:** Active Development (MVP)

---

## 1. Product Overview

### 1.1 Vision
PinTogather is a collaborative mapping platform that enables communities, teams, and groups to create shared map collections where members can pin locations, share points of interest, and collaborate. The platform bridges the gap between social networking and geographic visualization, making it easy for people to discover and share meaningful places together.

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
| **Freemium** | Free | Basic map creation, standard features | Implemented (default tier) |
| **Basic** | £2/month | Expanded collaboration, priority support | Schema ready, UI placeholder |
| **Premium** | £7/month | Unlimited maps, advanced sharing, premium features | Schema ready, UI placeholder |

**Note:** Tier-based feature restrictions are not yet enforced. The `userGroup` field exists on the user record but doesn't gate features currently.

### 2.3 Tier Management
- Users default to "freemium" tier upon registration
- Admins can upgrade/downgrade user tiers via the admin panel
- Tier stored on the user's `user_group` field (Directus `directus_users` collection)

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
- Tier-based feature gating (Basic/Premium) is not enforced

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
All fields below are `Implemented`: `id`, `mapId`, `userId` (optional — anonymous pins are allowed), `userName`, `latitude`/`longitude`, `address`, `city`, `state`, `town`, `borough`, `postcode`, `country`, `twitterHandle`, `instagramHandle`, `linkedinHandle`, `note`, `createdAt`.

#### Pin Operations

| Operation | Status | Notes |
|-----------|--------|-------|
| Add Pin | Implemented | Click map → geocode → fill form → save. Works signed-in or anonymous. |
| View Pins | Implemented | Map markers + table view |
| Edit Pin | Implemented | Map owner, or the pin's creator, may always edit; an anonymously-created pin on a map with `defaultPermission: editable` may be edited by anyone (preserves the "share the link" flow) |
| Delete Pin | Implemented | Same rule as edit |
| Reverse Geocoding | Implemented | Uses OpenStreetMap Nominatim API |
| CSV export | Implemented | Client-side export from the map detail page |

---

### 3.4 Sharing & Collaboration

**Permission Schema:**
| Permission Level | Capabilities | Enforcement Status |
|-----------------|---------------------|-------------------|
| **Readonly** | View map and pins only | Enforced for anonymous pin edits on the map; not yet enforced against direct share-URL viewing |
| **Editable** | Add, edit, delete pins | Enforced |

**Invitation System:**

| Feature | Status | Notes |
|---------|--------|-------|
| Create invitation | Implemented | Requires map ownership |
| List invitations | Implemented | Requires map ownership |
| Delete invitation | Implemented | |
| Accept invitation | Implemented | Requires sign-in; creates the corresponding `map_viewers` row, granting real access |
| Email notifications | Not implemented | SendGrid dependency present but not wired |

---

### 3.5 Google Maps Integration

Unchanged from prior implementation — Google Maps JavaScript API (Map, Marker, Places), OpenStreetMap Nominatim as the reverse-geocoding fallback. Default center: London, UK.

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

Schema is declared in code (`directus/src/schema/definitions.ts`) and applied idempotently via `npm run directus:schema:apply`; permissions (a single narrowly-scoped "Service" role used by the Express server's static token) via `npm run directus:permissions:apply`.

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
- Email delivery for invitations (SendGrid) is not wired up

---

## 9. Deployment

### 9.1 Environment Variables

See `.env.example` (app) and `directus/.env.example` (Directus instance) for the full, current list. At a minimum: `DIRECTUS_URL`, `DIRECTUS_SERVICE_TOKEN`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `GOOGLE_MAPS_API_KEY`.

### 9.2 Build Process
1. Client: Vite builds React app to `dist/public`
2. Server: ESBuild bundles TypeScript to `dist/index.js`
3. Production: `dist/start.js` handles environment setup

### 9.3 Local Development
`docker compose up -d` brings up Postgres + Redis + Directus; `npm run directus:schema:apply` and `npm run directus:permissions:apply` provision the schema and a service account/token; `npm run dev` starts the Express + Vite dev server. See `replit.md` for the full walkthrough.

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
- **Service token**: The long-lived Directus API token used exclusively by the Express server, scoped to a narrow "Service" role with no admin/schema access

### 10.2 Version History
| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Jul 20, 2026 | Backend migrated from Supabase/Drizzle to Directus; authentication migrated from Replit Auth to Clerk; several security gaps closed (see §8.1) |
| 1.0 | Nov 25, 2025 | Initial PRD documenting current state with accurate implementation status |
