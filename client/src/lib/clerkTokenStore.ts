/**
 * Holds a reference to Clerk's `getToken` so plain `fetch` calls outside of
 * React components (queryClient.ts) can attach a session token. Populated
 * once by <ClerkTokenBridge> (mounted inside <ClerkProvider> in main.tsx).
 */
type GetTokenFn = () => Promise<string | null>;

let getTokenFn: GetTokenFn | null = null;

// <ClerkTokenBridge> registers its getToken via a useEffect, which only runs
// after the initial render — any query fired by a descendant during that
// first render (e.g. on a hard page load) would otherwise race ahead of it
// and be sent with no auth token at all, silently treated as anonymous.
// getClerkToken() below waits on this instead of returning null right away.
let resolveReady: (() => void) | null = null;
const readyPromise = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

export function setClerkGetToken(fn: GetTokenFn | null): void {
  getTokenFn = fn;
  if (fn && resolveReady) {
    resolveReady();
    resolveReady = null;
  }
}

export async function getClerkToken(): Promise<string | null> {
  if (!getTokenFn) {
    await Promise.race([readyPromise, new Promise((resolve) => setTimeout(resolve, 2000))]);
  }
  if (!getTokenFn) return null;
  return getTokenFn();
}
