import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { setClerkGetToken } from "@/lib/token-bridge";

/** Publishes Clerk's `getToken` to a module-level store so the plain-fetch API client (src/lib/api.ts) can attach a session token outside of React. Mirrors the web app's identically-named component in client/src/main.tsx. */
export function ClerkTokenBridge({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    setClerkGetToken(getToken);
    return () => setClerkGetToken(null);
  }, [getToken]);

  return <>{children}</>;
}
