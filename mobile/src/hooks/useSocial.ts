import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

/** Follow/unfollow a user by username, with an optimistic flip mirroring client/src/components/follow-button.tsx. */
export function useFollow(username: string, invalidateKeys: string[] = []) {
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const mutation = useMutation({
    mutationFn: async (wasFollowing: boolean) => {
      const method = wasFollowing ? "DELETE" : "POST";
      const res = await apiRequest(method, `/api/users/${username}/follow`);
      return (await res.json()) as { following: boolean; followerCount: number };
    },
    onSuccess: (result) => {
      setOptimistic(result.following);
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: () => setOptimistic(null),
  });

  const toggle = (currentlyFollowing: boolean) => {
    setOptimistic(!currentlyFollowing);
    mutation.mutate(currentlyFollowing);
  };

  return { optimistic, toggle, isPending: mutation.isPending };
}

/** Like/unlike a map, with an optimistic flip mirroring client/src/components/like-button.tsx. */
export function useLike(mapId: string, invalidateKeys: string[] = []) {
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<{ liked: boolean; count: number } | null>(null);

  const mutation = useMutation({
    mutationFn: async (wasLiked: boolean) => {
      const method = wasLiked ? "DELETE" : "POST";
      const res = await apiRequest(method, `/api/maps/${mapId}/like`);
      return (await res.json()) as { liked: boolean; likeCount: number };
    },
    onSuccess: (result) => {
      setOptimistic({ liked: result.liked, count: result.likeCount });
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: () => setOptimistic(null),
  });

  const toggle = (currentlyLiked: boolean, currentCount: number) => {
    setOptimistic({ liked: !currentlyLiked, count: currentCount + (currentlyLiked ? -1 : 1) });
    mutation.mutate(currentlyLiked);
  };

  return { optimistic, toggle, isPending: mutation.isPending };
}
