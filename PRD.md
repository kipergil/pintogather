# PinTogather - Product Requirements Document (PRD)

**Version:** 1.0  
**Last Updated:** November 25, 2025  
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
| **Contributor** | Invited user with edit access | Add, edit, delete pins on shared maps | Schema ready, partial implementation |
| **Viewer** | User with read-only access | View maps and pins; cannot modify content | Schema ready, partial implementation |
| **Admin** | Platform administrator | Manage user tiers; platform-wide controls | Implemented |

### 2.2 Subscription Tiers

| Tier | Price | Features | Status |
|------|-------|----------|--------|
| **Freemium** | Free | Basic map creation, standard features | Implemented (default tier) |
| **Basic** | £2/month | Expanded collaboration, priority support | Schema ready, UI placeholder |
| **Premium** | £7/month | Unlimited maps, advanced sharing, premium features | Schema ready, UI placeholder |

**Note:** Tier-based feature restrictions are not yet enforced. The `userGroup` field exists in the database but doesn't gate features currently.

### 2.3 Tier Management
- Users default to "freemium" tier upon registration
- Admins can upgrade/downgrade user tiers via admin panel
- Tier stored in user profile (`userGroup` field)

---

## 3. Core Features

### 3.1 User Authentication & Profile Management

#### What's Implemented
- **Provider**: Supabase Authentication (email/password only)
- **Session Management**: JWT-based with localStorage persistence
- **Auth UI**: Modal-based login/signup flows
- **Profile Storage**: User profiles stored in PostgreSQL

#### Profile Features (Implemented)
- Full name management
- Social media handles (Twitter/X, Instagram, LinkedIn)
- User group/tier tracking
- Profile creation and update timestamps

#### Current Limitations
- **No Google OAuth**: Only email/password authentication is working
- **No automatic profile sync**: Profile creation requires manual trigger
- **Client-side auth trust**: API endpoints accept userId from client without server-side session verification (security risk)
- **Fallback patterns**: App may allow limited anonymous interactions when auth fails

---

### 3.2 Map Management

#### Map Collection Properties
| Field | Type | Description | Status |
|-------|------|-------------|--------|
| `id` | varchar(255) | Unique identifier | Implemented |
| `name` | text | Map name (unique per platform) | Implemented |
| `description` | text | Optional map description | Implemented |
| `shareUrl` | text | Unique URL for sharing | Implemented |
| `ownerId` | varchar(255) | Owner's user ID | Implemented |
| `isPublic` | boolean | Public visibility toggle | Implemented |
| `defaultPermission` | text | Default permission ("readonly"/"editable") | Schema ready |
| `createdAt` | timestamp | Creation timestamp | Implemented |

#### Map Operations

| Operation | Status | Notes |
|-----------|--------|-------|
| Create Map | Implemented | Name + optional description, auto-generates share URL |
| View Maps | Implemented | Dashboard shows owned maps with pin counts |
| Filter Maps | Implemented | Filter by owned/contributed maps |
| Delete Map | Partial | UI modal works, API has userId verification issues |
| Edit Map | Implemented | Update sharing settings and permissions |

#### Known Issues
- **Delete API Error**: Deletion modal UI works but API call fails due to userId passing issues
- **No server-side ownership verification**: Delete trusts client-provided userId

---

### 3.3 Pin Management

#### Pin Properties
| Field | Type | Description | Status |
|-------|------|-------------|--------|
| `id` | varchar(255) | Unique identifier | Implemented |
| `mapId` | varchar(255) | Associated map collection | Implemented |
| `userId` | varchar(255) | Creator's user ID (optional) | Implemented |
| `userName` | text | Creator's display name | Implemented |
| `latitude`/`longitude` | decimal | GPS coordinates | Implemented |
| `address` | text | Formatted address | Implemented |
| `city`, `state`, `town`, `borough`, `postcode`, `country` | text | Location details | Implemented |
| `twitterHandle`, `instagramHandle`, `linkedinHandle` | text | Social media links | Implemented |
| `note` | text | Optional pin note | Implemented |
| `createdAt` | timestamp | Creation timestamp | Implemented |

#### Pin Operations

| Operation | Status | Notes |
|-----------|--------|-------|
| Add Pin | Implemented | Click map → geocode → fill form → save |
| View Pins | Implemented | Map markers + table view |
| Edit Pin | Implemented | Modify handles, notes, location |
| Delete Pin | Implemented | Remove from map and database |
| Reverse Geocoding | Implemented | Uses OpenStreetMap Nominatim API |

#### Current Limitations
- **Anonymous pins allowed**: Pins can be created without userId (userId is optional)
- **No permission enforcement**: Anyone can currently edit/delete any pin
- **CSV export**: UI reference exists but feature may not be fully functional

---

### 3.4 Sharing & Collaboration

#### What's Implemented

**Permission Schema:**
| Permission Level | Intended Capabilities | Enforcement Status |
|-----------------|---------------------|-------------------|
| **Readonly** | View map and pins only | Not enforced |
| **Editable** | Add, edit, delete pins | Not enforced |

**Map Visibility:**
- Private/Public toggle exists in schema
- Share URL generation works
- No visibility enforcement in API (all maps accessible via share URL)

**Map Viewers Table (Schema Ready):**
| Field | Description | Status |
|-------|-------------|--------|
| `id` | Unique identifier | Schema |
| `mapId` | Map reference | Schema |
| `userId` | Viewer's user ID | Schema |
| `role` | viewer/contributor | Schema |
| `permission` | readonly/editable | Schema |

**Invitation System (Partial):**

| Feature | Status | Notes |
|---------|--------|-------|
| Create invitation | Implemented | Creates token, stores in DB |
| List invitations | Implemented | Shows pending invitations |
| Delete invitation | Implemented | Removes from DB |
| Accept invitation | Partial | Updates status but doesn't create map_viewer record |
| Email notifications | Not implemented | SendGrid prepared but not wired |

#### Critical Gaps
- **Accepting invitations doesn't grant access**: The accept endpoint marks invitation as accepted but doesn't add user to map_viewers
- **No permission enforcement**: API doesn't check if user has view/edit rights
- **No email sending**: Invitations are created but not emailed to recipients

---

### 3.5 Google Maps Integration

#### What's Implemented
- **API Key**: Server-side configuration (working)
- **Map Display**: Interactive Google Maps rendering
- **Markers**: Standard Google Maps Marker (deprecated but functional)
- **Click-to-add**: Select location by clicking map
- **Touch controls**: Single-finger dragging on mobile
- **Zoom controls**: +/- button controls

#### Map Settings
- Default center: London, UK (51.5074, -0.1278)
- Default zoom level: 10
- Disabled: Street view, map type selector, full-screen button
- Gesture handling: "greedy" (easier mobile use)

#### Current Limitations
- **Deprecated Marker API**: Using `google.maps.Marker` instead of recommended `AdvancedMarkerElement`
- **Venue search disabled**: Components exist but removed from UI
- **No Places autocomplete**: Removed for simplified UX

---

## 4. Technical Architecture

### 4.1 Stack Overview

| Layer | Technology | Status |
|-------|------------|--------|
| **Frontend** | React 18, TypeScript, Vite | Implemented |
| **UI Framework** | Radix UI, Tailwind CSS | Implemented |
| **State Management** | TanStack Query (React Query v5) | Implemented |
| **Routing** | Wouter | Implemented |
| **Backend** | Express.js, TypeScript | Implemented |
| **Database** | PostgreSQL (via Neon) | Implemented |
| **ORM** | Drizzle ORM | Implemented |
| **Authentication** | Supabase Auth | Partial |
| **Maps** | Google Maps JavaScript API | Implemented |

### 4.2 Project Structure

```
├── client/
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── contexts/       # React contexts (Auth)
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Utility libraries
│       └── pages/          # Route pages
├── server/
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database operations
│   └── vite.ts            # Vite integration
└── shared/
    └── schema.ts          # Drizzle schema & types
```

### 4.3 Key Frontend Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `simple-google-map.tsx` | Google Maps display with pin markers | Active |
| `add-pin-modal.tsx` | Form for creating new pins | Active |
| `create-map-form.tsx` | Map collection creation form | Active |
| `delete-map-modal.tsx` | Confirmation modal for map deletion | Active (API issues) |
| `share-modal.tsx` | Sharing link display | Active |
| `share-settings-modal.tsx` | Permission and invitation management | Active |
| `pin-table.tsx` | Tabular pin display with actions | Active |
| `profile-modal.tsx` | User profile view/edit | Active |
| `auth-modal.tsx` | Login/signup flows | Active |
| `activity-feed.tsx` | Recent activity display | Active |

**Unused/Legacy Components:**
- `google-map-view.tsx`, `google-map-view-fixed.tsx`, `map-view.tsx`, `map-view-old.tsx` - replaced by simple-google-map
- `venue-search.tsx`, `venue-search-simple.tsx` - feature removed from UI
- `test-map.tsx`, `simple-map.tsx` - development/testing only

### 4.4 Key Pages

| Page | Route | Purpose |
|------|-------|---------|
| Home | `/` | Dashboard with map list |
| Map Detail | `/map/:shareUrl` | Interactive map view |
| Profile | `/profile` | User profile management |
| Admin | `/admin` | Admin panel for user management |
| Auth | `/auth` | Authentication page |
| Add Pin | `/add-pin/:mapId` | Pin creation page |
| Edit Pin | `/edit-pin/:pinId` | Pin editing page |
| Not Found | `*` | 404 page |

---

## 5. Database Schema

### 5.1 Tables Overview

| Table | Purpose | Status |
|-------|---------|--------|
| `profiles` | User profile information | Active |
| `map_collections` | Map metadata and settings | Active |
| `pins` | Location markers with metadata | Active |
| `map_viewers` | Permission grants for maps | Schema only (not populated) |
| `map_invitations` | Email invitation tracking | Active |
| `admin_users` | Admin user registry | Active |

### 5.2 Schema Diagram

```
┌─────────────────┐     ┌─────────────────┐
│    profiles     │     │  admin_users    │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ userId (UK)     │     │ email (UK)      │
│ fullName        │     │ userId (UK)     │
│ twitterHandle   │     │ createdAt       │
│ instagramHandle │     └─────────────────┘
│ linkedinHandle  │
│ userGroup       │
│ createdAt       │
│ updatedAt       │
└─────────────────┘
         │
         │ ownerId (not enforced FK)
         ▼
┌─────────────────┐
│ map_collections │
├─────────────────┤
│ id (PK)         │◄──────────────────┐
│ name (UK)       │                   │
│ description     │                   │
│ shareUrl (UK)   │                   │
│ ownerId         │                   │
│ isPublic        │                   │
│ defaultPermission│                  │
│ createdAt       │                   │
└─────────────────┘                   │
         │                            │
         │ mapId (FK, cascade)        │ mapId (FK, cascade)
         ▼                            │
┌─────────────────┐     ┌─────────────┴───┐
│      pins       │     │   map_viewers   │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ mapId (FK)      │     │ mapId (FK)      │
│ userId          │     │ userId          │
│ userName        │     │ role            │
│ latitude        │     │ permission      │
│ longitude       │     │ createdAt       │
│ address         │     └─────────────────┘
│ city, state...  │           (not used)
│ social handles  │
│ note            │     ┌─────────────────┐
│ createdAt       │     │ map_invitations │
└─────────────────┘     ├─────────────────┤
                        │ id (PK)         │
                        │ mapId (FK)      │
                        │ email           │
                        │ permission      │
                        │ invitedBy       │
                        │ status          │
                        │ token (UK)      │
                        │ expiresAt       │
                        │ createdAt       │
                        └─────────────────┘
```

### 5.3 Data Integrity Notes
- **Cascade deletes**: Pins and invitations delete when parent map is deleted (via FK constraint)
- **map_viewers cascade**: Defined in schema but table isn't populated
- **No FK from map_collections to profiles**: ownerId is just a varchar, not enforced

---

## 6. API Endpoints

### 6.1 Health & Configuration

| Method | Endpoint | Auth | Status |
|--------|----------|------|--------|
| GET | `/api/healthcheck` | None | Implemented |
| GET | `/api/app-status` | None | Implemented |
| GET | `/api/supabase-health` | None | Implemented |
| GET | `/api/config` | None | Implemented |

### 6.2 Maps

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/maps` | Query param userId | Implemented | Returns empty if no userId |
| POST | `/api/maps` | Body includes ownerId | Implemented | No auth verification |
| GET | `/api/maps/:shareUrl` | None | Implemented | Anyone with URL can access |
| DELETE | `/api/maps/:mapId` | Body includes userId | Buggy | userId verification fails |
| PUT | `/api/maps/:mapId/permissions` | None | Implemented | No ownership check |

### 6.3 Pins

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| POST | `/api/maps/:shareUrl/pins` | None | Implemented | No permission check |
| GET | `/api/pins/:id` | None | Implemented | |
| PUT | `/api/pins/:id` | None | Implemented | No ownership check |
| DELETE | `/api/pins/:id` | None | Implemented | No ownership check |

### 6.4 Invitations

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| POST | `/api/maps/:mapId/invitations` | None | Implemented | No ownership check |
| GET | `/api/maps/:mapId/invitations` | None | Implemented | |
| POST | `/api/invitations/:token/accept` | None | Partial | Doesn't create viewer record |
| DELETE | `/api/invitations/:id` | None | Implemented | |

### 6.5 Profiles & Admin

| Method | Endpoint | Auth | Status | Notes |
|--------|----------|------|--------|-------|
| GET | `/api/profile/:userId` | None | Implemented | |
| GET | `/api/admin/users` | Header x-user-email | Implemented | Checks admin_users table |
| PUT | `/api/admin/users/:userId/group` | Header x-user-email | Implemented | |

### 6.6 Utilities

| Method | Endpoint | Auth | Status |
|--------|----------|------|--------|
| GET | `/api/geocode` | None | Implemented |
| POST | `/api/run-migration` | Service role key | Implemented |

---

## 7. User Interface

### 7.1 Design System
- **Framework**: Tailwind CSS with Radix UI primitives
- **Icons**: Lucide React
- **Theme**: Light mode only (dark mode CSS ready but not wired)
- **Responsive**: Mobile-friendly with touch optimizations

### 7.2 Key UI Patterns
- Modal dialogs for forms and confirmations
- Card-based layouts for map listings
- Interactive map with click-to-add pins
- Table views for pin management
- Toast notifications for feedback

---

## 8. Security Assessment

### 8.1 Critical Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Client-trusted userId | Critical | API endpoints trust client-provided userId for ownership checks |
| No auth middleware | High | Most endpoints lack authentication verification |
| No permission enforcement | High | Anyone can edit/delete any map or pin with the right IDs |
| Missing rate limiting | Medium | APIs vulnerable to abuse |

### 8.2 Recommendations (Not Yet Implemented)
1. Add server-side session verification using Supabase JWT
2. Implement middleware to extract userId from auth token
3. Add ownership checks before destructive operations
4. Implement rate limiting on all endpoints
5. Validate permission levels before allowing edits

---

## 9. Known Bugs & Issues

### 9.1 Active Bugs

| Bug | Severity | Description | Workaround |
|-----|----------|-------------|------------|
| Delete map API error | High | DELETE /api/maps/:mapId fails due to userId issues | None - debugging in progress |
| Invitation accept incomplete | Medium | Accepting doesn't grant map access | Manual database entry |
| Deprecated Google Marker | Low | Console warning about deprecated API | Functional, cosmetic issue |

### 9.2 Missing Functionality

| Feature | Priority | Status |
|---------|----------|--------|
| Email notifications | High | SendGrid configured but not wired |
| Permission enforcement | High | Schema ready, no enforcement |
| Google OAuth | Medium | Not implemented |
| Tier-based limits | Low | Schema ready, not enforced |
| Real-time updates | Low | Not implemented |
| CSV export | Low | Partial/unclear status |

---

## 10. Deployment

### 10.1 Environment Variables

| Variable | Required | Description | Status |
|----------|----------|-------------|--------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | Configured |
| `SUPABASE_URL` | Yes | Supabase project URL | Configured |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key | Configured |
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key | Configured |
| `SENDGRID_API_KEY` | No | SendGrid API key (for email) | Not configured |

### 10.2 Build Process
1. Client: Vite builds React app to `dist/public`
2. Server: ESBuild bundles TypeScript to `dist/index.js`
3. Production: `dist/start.js` handles environment setup

### 10.3 Health Monitoring
- `/api/healthcheck` for endpoint discovery
- `/api/app-status` for load balancer health checks
- CORS-enabled for external monitoring systems

---

## 11. Technical Debt Summary

| Area | Issue | Priority |
|------|-------|----------|
| Map components | Multiple legacy components need cleanup | Low |
| Auth enforcement | Client-side only, needs server validation | Critical |
| Invitation flow | Incomplete - doesn't create viewer records | High |
| Venue search | Components exist but feature removed | Low |
| Schema vs migration | Some discrepancies between Drizzle schema and DB | Medium |

---

## 12. Appendix

### 12.1 Glossary
- **Map Collection**: A named container for pins
- **Pin**: A geographic marker with metadata
- **Share URL**: Unique identifier for accessing a map
- **Viewer**: User with access to a shared map
- **Contributor**: User who can edit a shared map

### 12.2 Version History
| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Nov 25, 2025 | Initial PRD documenting current state with accurate implementation status |

---

*This document reflects the actual current implementation state of PinTogather. Features marked as "schema ready" or "partial" are not fully functional. Security issues are documented for prioritization.*
