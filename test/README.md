# Tests

Vitest, two projects, one command.

```bash
npm test              # everything
npm run test:watch    # watch mode
npm run test:server   # node project only
npm run test:client   # jsdom project only
npm run test:coverage # + coverage report in coverage/
npm run ci            # what CI runs: typecheck -> test -> build -> mobile typecheck
```

## Layout

| Project  | Environment | Covers                                    |
| -------- | ----------- | ----------------------------------------- |
| `server` | node        | `server/**/*.test.ts`, `shared/**/*.test.ts` |
| `client` | jsdom       | `client/**/*.test.{ts,tsx}`               |

Tests sit next to the code they cover rather than in a mirrored tree, so a
file and its test move together.

## What's covered, and why those things

The suite is aimed at logic where a mistake is silent — validation, security
guards, parsing, tier gates — rather than at raising a coverage number.

- **`shared/schema.test.ts`** — the per-item-type geo requirement. A missing
  `itemType` defaults to `"location"` and therefore demands coordinates;
  that default is what made the bulk-route ordering bug possible, so it's
  pinned down explicitly.
- **`shared/geo.test.ts`** — distance and route ordering, including the
  deliberate `null`-sequence-means-zero behaviour.
- **`server/lib/link-preview.test.ts`** — the SSRF guard. Every blocked
  range (loopback, RFC1918, link-local, CGNAT, IPv6 ULA, IPv4-mapped) plus
  the boundaries just outside them, the DNS-rebinding case, and
  fail-closed-on-malformed-input.
- **`server/lib/extract-items.test.ts`** — parsing Claude's reply, including
  prose-wrapped and fenced JSON, bare string arrays, and dropping URLs that
  aren't absolute http(s).
- **`server/routes.api.test.ts`** — real Express via supertest: auth, access
  control, tier caps, and that a pin's `itemType`/`userId`/`mapId`/`approved`
  come from the server rather than the request body.
- **`client/src/lib/item-parsing.test.ts`** — paste/file parsing per item
  type, including the messy-link-line cases.
- **`client/src/components/image-dropzone.test.tsx`** — clipboard paste,
  drag-drop, picker, the 4-image cap, and that a text paste isn't swallowed.
- **`client/src/lib/csv-export.test.ts`** — CSV escaping (commas, quotes,
  newlines) and per-item-type columns.

## Mocking boundary

Only genuine external edges are mocked: Directus (`server/storage.ts`),
Clerk (`server/clerkAuth.ts`), Anthropic, `node:dns`, and outbound `fetch`.
Express, its middleware, and Zod all run for real, because that wiring is
where the bugs worth catching live — a handler tested in isolation would
step straight over them.

`test/setup.server.ts` supplies dummy credentials so a run never depends on
a local `.env` and never reaches a real service.

## Not covered

- **The Expo app.** React Native components need the `jest-expo` toolchain,
  which isn't set up. `npm --prefix mobile run check` (typecheck) is the
  mobile gate in CI until it is. Logic shared with the web app is covered by
  the `shared/` tests.
- **Anything behind Clerk auth in a real browser.** The route tests cover the
  server side of those flows; the signed-in UI itself isn't driven end to
  end.
- **Real Directus/Stripe/Anthropic calls.** Deliberately — they'd make the
  suite slow, flaky, and dependent on network and credentials.

## Adding a test

Put it beside the code, name it `*.test.ts` (or `.tsx` for anything that
renders). Both projects are typechecked by `npm run check`, so a test that
doesn't compile fails the build.

One Vitest gotcha worth knowing: `beforeEach(() => someMock.mockReset())`
returns the mock, and Vitest treats a returned function as a teardown
callback — it will then *call your mock* after each test. Use a block body:
`beforeEach(() => { someMock.mockReset(); })`.
