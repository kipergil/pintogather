/**
 * Same bridging pattern as the web app's clerkTokenStore.ts, backed by the
 * shared, platform-agnostic implementation — see shared/auth-token-bridge.ts.
 * Registered from <ClerkTokenBridge> in app/_layout.tsx.
 */
import { createTokenBridge } from "../../../shared/auth-token-bridge";

const bridge = createTokenBridge();

export const setClerkGetToken = bridge.setGetToken;
export const getClerkToken = bridge.getToken;
