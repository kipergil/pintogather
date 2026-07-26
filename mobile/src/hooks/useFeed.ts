import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/api";
import type { FeedMapItem } from "../../../shared/schema";

export const FEED_QUERY_KEY = "/api/feed";

interface FeedResponse {
  items: FeedMapItem[];
  followingCount: number;
}

export function useFeed() {
  return useQuery<FeedResponse>({
    queryKey: [FEED_QUERY_KEY],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}
