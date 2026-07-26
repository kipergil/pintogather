import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

/**
 * Guards a screen that lives outside the (tabs) group's own auth check
 * (e.g. map/create, map/[shareUrl]) — redirects to sign-in if the session
 * isn't there. The web app allows anonymous guest viewing of a public map;
 * this boilerplate keeps things simple by requiring sign-in everywhere for
 * now (see mobile/README.md's "what's not implemented yet" list).
 */
export function useRequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/(auth)/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  return { isLoaded, isSignedIn };
}
