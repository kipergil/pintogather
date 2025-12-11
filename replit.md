# PinTogather - Collaborative Mapping Platform

## Overview
PinTogather is a full-stack collaborative mapping platform that allows users to create shared map collections where community members can add pins, share locations, and collaborate in real-time. Built with React, Express.js, and PostgreSQL/Supabase, it features Google Maps integration, user authentication, and a flexible permission system.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and bundling
- **UI Library**: Radix UI components with Tailwind CSS styling
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: Wouter for client-side routing
- **Maps**: Google Maps JavaScript API with fallback to OpenStreetMap
- **Authentication Context**: React Context API for user session management

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for PostgreSQL
- **Authentication**: Supabase Auth for user management
- **API Design**: RESTful endpoints with JSON responses
- **File Structure**: Clean separation between routes, storage, and utilities
- **Health Monitoring**: Comprehensive health check endpoints for production monitoring

### Data Storage Solutions
- **Primary Database**: PostgreSQL (via Supabase or direct connection)
- **ORM**: Drizzle ORM for type-safe database queries
- **Schema**: Well-defined tables for users, maps, pins, and permissions
- **Connection**: Environment-based configuration supporting multiple database providers

### Database Schema
The application uses seven main tables:
- `sessions`: Session storage for Replit Auth (required for authentication)
- `users`: User accounts from Replit Auth (id, email, name, profile image)
- `profiles`: User profile information and subscription tiers
- `map_collections`: Map metadata and sharing configuration
- `pins`: Location data with social media handles and notes
- `map_viewers`: Permission system for map access
- `map_invitations`: Email-based map sharing system

## Key Components

### Authentication System
- **Replit Auth**: Primary authentication using OpenID Connect (supports Google, GitHub, X, Apple, and email/password)
  - Login: Navigate to `/api/login`
  - Logout: Navigate to `/api/logout`
  - User data: GET `/api/auth/user` (requires authentication)
  - Frontend hook: `useAuth()` from `@/hooks/useAuth`
- **Supabase Auth**: Secondary authentication option with Google OAuth
- JWT session management with automatic token refresh
- Profile creation and management
- Role-based access control with user groups (freemium, basic, premium)

### Map Management
- **Map Collections**: Named, shareable map containers
- **Pin System**: Location-based pins with rich metadata
- **Permission System**: Owner/viewer/contributor roles with granular permissions
- **Sharing System**: Unique URLs for map sharing with privacy controls

### User Interface
- **Responsive Design**: Mobile-first approach with touch-friendly interactions
- **Component Library**: Reusable UI components built on Radix UI
- **Interactive Maps**: Google Maps integration with venue search capabilities
- **Real-time Updates**: Live collaboration through React Query cache invalidation

### External Integrations
- **Google Maps API**: Primary mapping service with Places API
- **Supabase**: Authentication and database hosting
- **OpenStreetMap/Nominatim**: Fallback geocoding service
- **Social Media**: Integration fields for Twitter, Instagram, LinkedIn

## Data Flow

### User Registration/Authentication
1. User accesses authentication page
2. Supabase handles authentication flow
3. Profile created in local database
4. User session established with JWT tokens
5. Automatic profile synchronization

### Map Creation and Sharing
1. Authenticated user creates map collection
2. Unique share URL generated
3. Map permissions configured (public/private)
4. Invitation system for collaboration
5. Real-time updates via React Query

### Pin Management
1. User selects location on map
2. Reverse geocoding provides address details
3. Pin form with social media and note fields
4. Database storage with map association
5. Immediate UI updates across all viewers

## External Dependencies

### Core Dependencies
- React ecosystem (React, React DOM, React Query)
- Express.js with TypeScript support
- Drizzle ORM with PostgreSQL adapter
- Supabase client library
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

## Deployment Strategy

### Build Process
- **Client Build**: Vite builds React app to `dist/public`
- **Server Build**: ESBuild bundles TypeScript server to `dist/index.js`
- **Production Script**: `dist/start.js` handles environment setup
- **Static Assets**: Served from `dist/public` directory

### Environment Configuration
- **Database**: `DATABASE_URL` for PostgreSQL connection
- **Authentication**: Supabase URL and keys
- **Google Maps**: API key for mapping services
- **Port Configuration**: Configurable via `PORT` environment variable

### Health Monitoring
- `/api/healthcheck`: Endpoint discovery for monitoring systems
- `/api/app-status`: Overall application health check
- `/api/supabase-health`: Database connectivity verification
- CORS-enabled endpoints for external monitoring

### Deployment Targets
- **Replit**: Native deployment with Cloud Run integration
- **Docker**: Containerized deployment option
- **Traditional Hosting**: Standard Node.js hosting compatibility

## User Preferences
Preferred communication style: Simple, everyday language.

## Changelog
Changelog:
- December 11, 2025. Added Replit Auth integration with OpenID Connect for user authentication
- June 26, 2025. Initial setup