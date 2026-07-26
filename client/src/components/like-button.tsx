import { useState } from "react";
import { Heart } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface LikeButtonProps {
  mapId: string;
  liked: boolean;
  likeCount: number;
  /** Query keys to invalidate after a successful toggle, so counts stay in sync in other open views. */
  invalidateKeys?: string[];
  className?: string;
}

export function LikeButton({ mapId, liked, likeCount, invalidateKeys = [], className }: LikeButtonProps) {
  const { user, login } = useAuth();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<{ liked: boolean; count: number } | null>(null);

  const display = optimistic ?? { liked, count: likeCount };

  // Takes the pre-click "was it liked" state as an explicit argument rather
  // than reading `display.liked` from closure — by the time this async
  // function runs, the optimistic setState below may already have flipped
  // it, which would silently invert which HTTP method gets sent.
  const mutation = useMutation({
    mutationFn: async (wasLiked: boolean) => {
      const method = wasLiked ? "DELETE" : "POST";
      const response = await apiRequest(method, `/api/maps/${mapId}/like`);
      return response.json() as Promise<{ liked: boolean; likeCount: number }>;
    },
    onSuccess: (result) => {
      setOptimistic({ liked: result.liked, count: result.likeCount });
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: () => {
      // Roll back the optimistic flip on failure.
      setOptimistic(null);
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      login();
      return;
    }
    const wasLiked = display.liked;
    setOptimistic({ liked: !wasLiked, count: display.count + (wasLiked ? -1 : 1) });
    mutation.mutate(wasLiked);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mutation.isPending}
      className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
        display.liked ? "text-rose-600" : "text-muted-foreground hover:text-rose-600"
      } ${className ?? ""}`}
      data-testid={`button-like-map-${mapId}`}
    >
      <Heart className={`h-4 w-4 ${display.liked ? "fill-current" : ""}`} />
      {display.count}
    </button>
  );
}
