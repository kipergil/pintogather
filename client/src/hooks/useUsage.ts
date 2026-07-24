import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import type { UserGroup } from "@shared/enums";

export interface UsageSummary {
  userGroup: UserGroup;
  maps: { used: number; limit: number };
  aiSuggestions: { used: number; limit: number };
}

/** Account-wide usage vs. the signed-in user's tier limits — maps owned and today's AI-suggestion count. */
export function useUsage() {
  const { isAuthenticated } = useAuth();

  const { data: usage, isLoading } = useQuery<UsageSummary>({
    queryKey: ["/api/usage"],
    enabled: isAuthenticated,
  });

  return { usage, isLoading };
}
