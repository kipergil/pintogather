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
preview in a browser, with the caveats noted below about maps.

The web app's API server must be running and reachable at `EXPO_PUBLIC_API_URL`
(see `../README.md` for `npm run dev` at the repo root, default port 5000).

### Environment variables

Copy `.env.example` to `.env` and fill in:

- `EXPO_PUBLIC_API_URL` — base URL of the PinTogather API (e.g.
  `http://localhost:5000` for local dev, or your deployed API's origin).
- `EXPO_PUBLIC_WEB_APP_URL` — base URL for shareable web links (e.g.
  `/map/:shareUrl`). Optional — defaults to `EXPO_PUBLIC_API_URL`, which is
  correct whenever the web app and API share an origin.
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

This app covers the full core product loop plus most of the web app's
secondary features. Feature-parity summary (✅ implemented, ❌ not yet):

**Auth** — sign in/up/out ✅ · deep-link return-to-map after auth ❌ · admin
panel ❌

**Maps** — list (My Maps + archived) ✅ · create/edit/delete ✅ · default pin
color/icon (tier-gated) ✅ · custom note label/prompt ✅ · show-on-profile
toggle ✅ · archive/restore (tier-gated) ✅ · CSV export ✅ · fit-all-pins ✅ ·
custom branding logo upload ❌

**Pins** — native map with colored/iconed markers ✅ · tap-to-add (name,
note, socials, per-pin color/icon) ✅ · anonymous/guest add ✅ · edit/delete ✅
· pending-approval indicator ✅ · Google Maps link ✅ · bulk import via
paste-list + tap-to-place ✅ · venue search/autocomplete ❌ · pin table/list
view alongside the map ❌ · screenshot/AI-suggested import ❌

**Sharing & collaboration** — native share sheet (copy link + OS share) ✅ ·
invite by email with seat usage ✅ · accept-invitation deep link ✅ ·
public/guest map viewing (no forced sign-in wall) ✅

**Social** — profile editing (username, bio, socials) with live availability
check ✅ · public profile screen ✅ · follow/unfollow ✅ · like/unlike ✅ ·
Feed tab ✅

**Discovery** — Discover tab with category/country filters ✅ · city filter ❌

**Monetization** — Pricing screen, usage meters, Stripe Checkout/Billing
Portal via in-app browser ✅ · upgrade CTAs on tier-limit errors ✅

## Code sharing with the web app

- `../shared/schema.ts` — Drizzle/Zod schema and inferred types, used as-is.
- `../shared/enums.ts`, `../shared/limits.ts`, `../shared/pricing.ts` — used
  as-is for tier gates and pricing copy.
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

A few small pieces are intentionally **duplicated** rather than shared,
because the web originals depend on browser/DOM APIs with no RN equivalent
(canvas, `google.maps` types, `Blob`/`URL.createObjectURL`): `src/lib/
pin-styles.ts`, `src/lib/curated-maps.ts`, `src/lib/social-links.ts`, and
`src/lib/csv-export.ts`. Each has a comment pointing at its web counterpart.

## Known limitations of the web-preview target

`react-native-maps` has no web implementation. Every screen that needs a real
map (`app/map/[shareUrl].tsx`, `app/map/import/[shareUrl].tsx`) has a
`.web.tsx` sibling — a platform-specific fallback used only when running via
`expo start --web` / Expo Router's web target; native iOS/Android builds use
the real `.tsx` file untouched. This is a Metro/Expo Router convention
(`.web.tsx` / `.ios.tsx` / `.android.tsx` / `.native.tsx` override the base
file per platform).

`react-native-web` also ships `Alert.alert()` as a documented no-op stub, so
every confirmation prompt (delete map/pin, archive map) can't be triggered by
clicking through on the web-preview target — they work normally on a real
device/simulator. Similarly, `Share.share()` opening the OS share sheet can
only be confirmed not to crash on web preview, not exercised end-to-end.

## Verifying changes

- `npm run check` — `tsc --noEmit`.
- `npx expo start --web` — fastest way to sanity-check screens and data
  fetching without a simulator, with the caveats above.
- Final verification on a real iOS/Android device or simulator is still
  recommended before shipping, since this was primarily developed and
  verified via the web preview target in a sandboxed environment without
  simulators available.
