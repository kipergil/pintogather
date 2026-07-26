import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/api";
import type { User } from "../../../shared/schema";

/** The signed-in user's own backend record (plan tier, username, bio, ...) — distinct from Clerk's `useUser()`, which only knows Clerk-side profile fields. */
export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}
