/**
 * Bridges a UI framework's reactive auth token getter (e.g. Clerk's
 * `useAuth().getToken`) to plain-JS callers like a fetch-based API client
 * that live outside of React's render tree and can't call hooks directly.
 *
 * Shared between the web app (client/src/lib/clerkTokenStore.ts) and the
 * mobile app, since the bridging logic itself has no DOM/React-Native
 * dependency — only *which* getToken function gets registered differs per
 * platform.
 */
export type GetTokenFn = () => Promise<string | null>;

export interface TokenBridge {
  /** Called once (in a `useEffect`, so it runs after the first render) to register the live getToken function. */
  setGetToken: (fn: GetTokenFn | null) => void;
  /** Resolves the current auth token, or null if signed out or never registered. */
  getToken: () => Promise<string | null>;
}

export function createTokenBridge(): TokenBridge {
  let getTokenFn: GetTokenFn | null = null;

  // A bridge consumer registers its getToken via a useEffect, which only
  // runs after the initial render — any request fired by a descendant
  // during that first render (e.g. on a hard page load / cold app start)
  // would otherwise race ahead of it and go out with no auth token at all,
  // silently treated as anonymous. getToken() below waits briefly on this
  // instead of returning null right away.
  let resolveReady: (() => void) | null = null;
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  function setGetToken(fn: GetTokenFn | null): void {
    getTokenFn = fn;
    if (fn && resolveReady) {
      resolveReady();
      resolveReady = null;
    }
  }

  async function getToken(): Promise<string | null> {
    if (!getTokenFn) {
      await Promise.race([readyPromise, new Promise((resolve) => setTimeout(resolve, 2000))]);
    }
    if (!getTokenFn) return null;
    return getTokenFn();
  }

  return { setGetToken, getToken };
}
