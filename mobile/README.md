# PinTogather Mobile

A React Native (Expo) app for iOS and Android, sharing auth, data-fetching, and
domain logic with the web app (`../client`) via `../shared/*.ts`. This app is
NOT part of an npm/yarn/pnpm workspace — it's a self-contained Expo project
(same pattern as `../directus/`) with its own `package.json`/`node_modules`,
reaching into `../shared` with plain relative imports.

## Getting started

```bash
cd mobile
npm install
cp .env.example .env   # then fill in the values, see below
npx expo start
```

This prints a QR code — scan it with the Expo Go app on a physical device, or
press `i`/`a` to launch an iOS Simulator / Android Emulator if you have one
configured locally. `npx expo start --web` also works as a quick sanity-check
preview in a browser, with the caveat noted below about maps.

The web app's API server must be running and reachable at `EXPO_PUBLIC_API_URL`
(see `../README.md` for `npm run dev` at the repo root, default port 5000).

### Environment variables

Copy `.env.example` to `.env` and fill in:

- `EXPO_PUBLIC_API_URL` — base URL of the PinTogather API (e.g.
  `http://localhost:5000` for local dev, or your deployed API's origin).
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — same Clerk **publishable** key as the
  web app's `client/.env` (`VITE_CLERK_PUBLISHABLE_KEY`). Using the same
  Clerk project means accounts are shared between web and mobile.
- `GOOGLE_MAPS_API_KEY_IOS` / `GOOGLE_MAPS_API_KEY_ANDROID` — needed to render
  the native map on device. These must be keys with the **Maps SDK for iOS**
  / **Maps SDK for Android** enabled respectively — distinct from the web
  app's Maps JavaScript API key. Not required for `expo start --web`.

`EXPO_PUBLIC_*` vars are inlined into the JS bundle automatically by Expo; no
further wiring is needed.

## What's implemented

This is a boilerplate covering the core loop, not full feature parity with
the web app:

- **Auth** — sign in, sign up (with email verification code), sign out, via
  Clerk (`@clerk/clerk-expo`). Session tokens are cached with
  `expo-secure-store`.
- **My Maps** — list of the signed-in user's map collections.
- **Create/edit/delete map** — name, description, show-on-profile, custom
  note label/prompt, default pin color/icon (tier-gated).
- **Map Detail** — native map (`react-native-maps`) with colored/iconed
  pins, tap-to-add-pin, per-pin edit/delete, a Google Maps link, and
  anonymous guest viewing + pin-adding (no forced sign-in), matching the
  web app's `/map/:shareUrl` behavior.
- **Profile** — signed-in user's avatar/name/email, sign out.

Not implemented (deferred — out of scope for this boilerplate): sharing,
Discover, Feed, follows/likes, Stripe billing UI, collaboration/invites,
bulk import, admin panel.

## Code sharing with the web app

- `../shared/schema.ts` — Drizzle/Zod schema and inferred types, used as-is.
- `../shared/api-client.ts` — `createApiClient({ baseUrl, getToken,
  includeCredentials })`: the same request/query/error-handling logic used by
  both platforms. Mobile instantiates it in `src/lib/api.ts` with an absolute
  `baseUrl`, no credentials, and Bearer-token auth only; the web app
  instantiates it in `client/src/lib/queryClient.ts` with a relative
  `baseUrl` and `includeCredentials: true`.
- `../shared/auth-token-bridge.ts` — `createTokenBridge()`: lets a React
  component outside the query-client module (here, `src/components/
  ClerkTokenBridge.tsx`) register Clerk's `getToken` function for the API
  client to call. Mirrors `client/src/main.tsx`'s equivalent bridge.

Files importing from `../shared` use plain relative paths (e.g.
`../../../shared/api-client`) rather than a path alias — see the comment in
`babel.config.js` for why a cross-repo alias was dropped.

## Known limitation: maps on web preview

`react-native-maps` has no web implementation. `app/map/[shareUrl].web.tsx` is
a platform-specific fallback (a plain pin list, no map) used only when running
via `expo start --web` / Expo Router's web target — native iOS/Android builds
use `app/map/[shareUrl].tsx` with the real map. This is a Metro/Expo Router
convention (`.web.tsx` / `.ios.tsx` / `.android.tsx` / `.native.tsx` override
the base file per platform), not a limitation of the real app.

## Verifying changes

- `npm run check` — `tsc --noEmit`.
- `npx expo start --web` — fastest way to sanity-check screens and data
  fetching without a simulator.
- Final verification on a real iOS/Android device or simulator is still
  recommended before shipping, since this was primarily developed and
  verified via the web preview target in a sandboxed environment without
  simulators available.
