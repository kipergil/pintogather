/**
 * Holds a reference to Clerk's `getToken` so plain `fetch` calls outside of
 * React components (queryClient.ts) can attach a session token. Populated
 * once by <ClerkTokenBridge> (mounted inside <ClerkProvider> in main.tsx).
 *
 * Thin wrapper over the platform-agnostic bridge in shared/ — see
 * shared/auth-token-bridge.ts for the actual logic, which the mobile app's
 * equivalent file also instantiates.
 */
import { createTokenBridge } from "@shared/auth-token-bridge";

const bridge = createTokenBridge();

export const setClerkGetToken = bridge.setGetToken;
export const getClerkToken = bridge.getToken;
