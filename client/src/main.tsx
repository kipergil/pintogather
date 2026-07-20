import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import App from "./App";
import { setClerkGetToken } from "./lib/clerkTokenStore";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

/** Publishes Clerk's `getToken` to a module-level store so plain `fetch` calls
 * outside of React (queryClient.ts) can attach a session token. */
function ClerkTokenBridge({ children }: { children: React.ReactNode }) {
  const { getToken } = useClerkAuth();

  useEffect(() => {
    setClerkGetToken(getToken);
    return () => setClerkGetToken(null);
  }, [getToken]);

  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
    <ClerkTokenBridge>
      <App />
    </ClerkTokenBridge>
  </ClerkProvider>,
);
