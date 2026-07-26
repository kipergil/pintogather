import { useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface FollowButtonProps {
  username: string;
  following: boolean;
  /** Query keys to invalidate after a successful toggle (e.g. the profile query) so counts refresh. */
  invalidateKeys?: string[];
}

export function FollowButton({ username, following, invalidateKeys = [] }: FollowButtonProps) {
  const { user, login } = useAuth();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const isFollowing = optimistic ?? following;

  // The mutation takes the pre-click state as an explicit argument rather
  // than reading `isFollowing` from closure — by the time this async
  // function actually runs, a re-render (from the optimistic setState below)
  // may already have flipped that value, which would silently invert which
  // HTTP method gets sent.
  const mutation = useMutation({
    mutationFn: async (wasFollowing: boolean) => {
      const method = wasFollowing ? "DELETE" : "POST";
      const response = await apiRequest(method, `/api/users/${username}/follow`);
      return response.json() as Promise<{ following: boolean; followerCount: number }>;
    },
    onSuccess: (result) => {
      setOptimistic(result.following);
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: () => setOptimistic(null),
  });

  const handleClick = () => {
    if (!user) {
      login();
      return;
    }
    setOptimistic(!isFollowing);
    mutation.mutate(isFollowing);
  };

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      onClick={handleClick}
      disabled={mutation.isPending}
      data-testid={`button-follow-${username}`}
    >
      {isFollowing ? (
        <>
          <UserCheck className="h-4 w-4 mr-1.5" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Follow
        </>
      )}
    </Button>
  );
}
