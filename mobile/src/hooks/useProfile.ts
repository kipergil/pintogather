import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/api";
import type { PublicProfile, UpdateProfile, User } from "../../../shared/schema";

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateProfile) => {
      const res = await apiRequest("PUT", "/api/profile", data);
      return (await res.json()) as User;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}

export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

/** Debounced live availability check, mirroring client/src/pages/profile.tsx's behavior. */
export function useUsernameAvailability(candidate: string, currentUsername: string | null | undefined) {
  const [status, setStatus] = useState<UsernameStatus>("idle");

  useEffect(() => {
    const trimmed = candidate.trim().toLowerCase();
    if (!trimmed || trimmed === (currentUsername || "")) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    const timeout = setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/users/${encodeURIComponent(trimmed)}/availability`);
        const data = (await res.json()) as { available: boolean; reason?: string };
        setStatus(data.available ? "available" : data.reason === "invalid" ? "invalid" : "taken");
      } catch {
        setStatus("idle");
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [candidate, currentUsername]);

  return status;
}

export function usePublicProfile(username: string | undefined) {
  return useQuery<PublicProfile>({
    queryKey: [`/api/profile/${username}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!username,
  });
}
