import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

/**
 * Guards a screen that lives outside the (tabs) group's own auth check and
 * has no anonymous use case (map/create, map/edit, map/edit-pin) — redirects
 * to sign-in if the session isn't there. map/[shareUrl] deliberately does
 * NOT use this: like the web app's /map/:shareUrl, viewing a map and adding
 * a pin to it both work for signed-out guests.
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
