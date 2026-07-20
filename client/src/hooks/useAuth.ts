import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

/** Fetches the app's own user record (Directus profile) for the signed-in Clerk session. */
export function useAuth() {
  const { isLoaded, isSignedIn } = useClerkAuth();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    enabled: isLoaded && isSignedIn,
    retry: false,
  });

  return {
    user: isSignedIn ? user : undefined,
    isLoading: !isLoaded || (isSignedIn && isLoading),
    isAuthenticated: !!isSignedIn && !!user,
  };
}
