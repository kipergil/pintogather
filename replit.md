# PinTogather - Collaborative Mapping Platform

## Overview
PinTogather is a full-stack collaborative mapping platform that allows users to create shared map collections where community members can add pins, share locations, and collaborate. Built with React, Express.js, Directus, and Clerk, it features Google Maps integration, authenticated collaboration, and a flexible permission system.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and bundling
- **UI Library**: Radix UI components with Tailwind CSS styling
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: Wouter for client-side routing
- **Maps**: Google Maps JavaScript API with fallback to OpenStreetMap
- **Authentication**: Clerk (`@clerk/clerk-react`), wrapped by a thin `AuthContext` that exposes the app's own Directus-backed user profile

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Data store**: Directus (headless CMS over PostgreSQL), accessed exclusively through a server-side service token — the browser never talks to Directus directly
- **Authentication**: Clerk (`@clerk/express`) verifies the signed-in session on every request; `directus_users` is kept in sync via a Clerk webhook, with a just-in-time upsert fallback
- **API Design**: RESTful endpoints with JSON responses
- **File Structure**: Clean separation between routes, storage (the Directus data-access layer), and auth
- **Health Monitoring**: Health check endpoints for production monitoring

### Data Storage Solutions
- **Primary Data Store**: Directus, backed by PostgreSQL (see `docker-compose.yml` for local dev: Directus + Postgres + Redis)
- **Access Layer**: `@directus/sdk`, wrapped by `server/storage.ts` which translates between the app's camelCase domain types (`shared/schema.ts`) and Directus's collections (`shared/directus-schema.ts`)
- **Schema management**: `directus/` — a small standalone tool app (not part of the Express server) that declaratively creates collections/fields/relations/permissions via `npm run directus:schema:apply` and `npm run directus:permissions:apply`

### Data Model (Directus collections)
- `directus_users`: Directus's built-in user table, extended with `clerk_user_id`, `avatar_url`, `full_name`, `twitter_handle`, `instagram_handle`, `linkedin_handle`, `user_group`, `is_admin`
- `map_collections`: Map metadata and sharing configuration (owner, share URL, visibility, default permission)
- `pins`: Location data with social media handles and notes, belonging to one map
- `map_viewers`: Per-user role/permission grants on a map
- `map_invitations`: Email-based map sharing invitations

## Key Components

### Authentication System
- **Clerk**: Sign-in/sign-up UI (`<SignIn/>` on `/auth`), session management, and the `useAuth()`/`useClerk()` hooks
- **Directus sync**: `server/webhooks/clerk.ts` handles Clerk's `user.created` / `user.updated` / `user.deleted` webhooks; `server/clerkAuth.ts`'s `getCurrentUser()` does a just-in-time upsert for the gap before the webhook lands (or in local dev without one configured)
- User data: GET `/api/auth/user` (requires authentication)
- Frontend hook: `useAuth()` from `@/contexts/AuthContext`
- Role-based access control with user groups (freemium, basic, premium) and an `is_admin` flag (auto-granted to emails listed in `ADMIN_EMAILS`)

### Map Management
- **Map Collections**: Named, shareable map containers
- **Pin System**: Location-based pins with rich metadata; can be created anonymously (share-link collaboration) or by a signed-in user
- **Permission System**: Map ownership + per-pin ownership are enforced server-side (`server/routes.ts`); anonymous edits are only allowed on anonymously-created pins on maps whose default permission is "editable"
- **Sharing System**: Unique URLs for map sharing, plus an invitation flow that grants a `map_viewers` row when accepted

### User Interface
- **Responsive Design**: Mobile-first approach with touch-friendly interactions
- **Component Library**: Reusable UI components built on Radix UI
- **Interactive Maps**: Google Maps integration with Places search
- **Real-time Updates**: Live collaboration through React Query cache invalidation

### External Integrations
- **Google Maps API**: Primary mapping service with Places API
- **Directus**: Data store, accessed only from the Express server
- **Clerk**: Authentication
- **OpenStreetMap/Nominatim**: Reverse geocoding service
- **Social Media**: Integration fields for Twitter, Instagram, LinkedIn

## Data Flow

### User Registration/Authentication
1. User signs in via Clerk (`<SignIn/>` on `/auth`, or the header's Sign In button which opens Clerk's modal)
2. Clerk's webhook (or, as a fallback, the first authenticated API request) upserts a `directus_users` row keyed by `clerk_user_id`
3. The client attaches the Clerk session token as `Authorization: Bearer <token>` on every API call; `@clerk/express` verifies it server-side

### Map Creation and Sharing
1. Authenticated user creates a map collection (ownership is set server-side from the verified session, never from client input)
2. Unique share URL generated
3. Map permissions configured (public/private, default readonly/editable)
4. Invitation system for collaboration — accepting an invitation grants a `map_viewers` row
5. Real-time updates via React Query cache invalidation

### Pin Management
1. User selects a location on the map
2. Reverse geocoding provides address details
3. Pin form with social media and note fields
4. Stored in Directus, associated with the map (and the signed-in user, if any)
5. Immediate UI updates across all viewers

## Local Development

1. `cp directus/.env.example directus/.env` and `cp .env.example .env`, filling in the generated `KEY`/`SECRET`/`ADMIN_PASSWORD` and your Clerk keys
2. `docker compose up -d` — starts Postgres, Redis, and Directus
3. `npm install`
4. `npm run directus:schema:apply` then `npm run directus:permissions:apply` (the latter prints a `DIRECTUS_SERVICE_TOKEN` — paste it into both `.env` files)
5. `npm run dev`

## External Dependencies

### Core Dependencies
- React ecosystem (React, React DOM, React Query)
- Express.js with TypeScript support
- `@directus/sdk` for the Directus data layer
- `@clerk/clerk-react` and `@clerk/express` for authentication
- Google Maps JavaScript API

### UI and Styling
- Radix UI component primitives
- Tailwind CSS for styling
- Lucide React for icons
- Class Variance Authority for component variants

### Development Tools
- Vite for fast development and building
- TypeScript for type safety
- ESBuild for server bundling
- PostCSS with Tailwind integration
- `tsx` for running the `directus/` schema/permissions apply scripts

## Deployment Strategy

### Build Process
- **Client Build**: Vite builds React app to `dist/public`
- **Server Build**: ESBuild bundles TypeScript server to `dist/index.js`
- **Production Script**: `dist/start.js` handles environment setup
- **Static Assets**: Served from `dist/public` directory

### Environment Configuration
See `.env.example` for the full list: `DIRECTUS_URL` / `DIRECTUS_SERVICE_TOKEN`, `CLERK_SECRET_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_PUBLISHABLE_KEY` / `CLERK_WEBHOOK_SIGNING_SECRET`, `ADMIN_EMAILS`, `GOOGLE_MAPS_API_KEY`, `PORT`.

### Health Monitoring
- `/api/healthcheck`: Endpoint discovery for monitoring systems
- `/api/app-status`: Overall application health check
- `/api/directus-health`: Directus connectivity verification
- CORS-enabled endpoints for external monitoring

### Deployment Targets
- **Replit**: Native deployment with Cloud Run integration
- **Docker**: Containerized deployment option (app itself; Directus/Postgres/Redis via `docker-compose.yml`, or a managed Directus instance)
- **Traditional Hosting**: Standard Node.js hosting compatibility

## User Preferences
Preferred communication style: Simple, everyday language.

## Changelog
Changelog:
- July 2026. Refactored backend from Supabase/Drizzle to Directus, and authentication from Replit Auth to Clerk.
- December 11, 2025. Added Replit Auth integration with OpenID Connect for user authentication
- June 26, 2025. Initial setup
