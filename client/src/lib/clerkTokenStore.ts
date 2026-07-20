/**
 * Holds a reference to Clerk's `getToken` so plain `fetch` calls outside of
 * React components (queryClient.ts) can attach a session token. Populated
 * once by <ClerkTokenBridge> (mounted inside <ClerkProvider> in main.tsx).
 */
type GetTokenFn = () => Promise<string | null>;

let getTokenFn: GetTokenFn | null = null;

export function setClerkGetToken(fn: GetTokenFn | null): void {
  getTokenFn = fn;
}

export async function getClerkToken(): Promise<string | null> {
  if (!getTokenFn) return null;
  return getTokenFn();
}
