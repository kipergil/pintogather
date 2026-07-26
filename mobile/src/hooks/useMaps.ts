import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/api";
import type { InsertMapCollection, InsertPin, MapCollection, Pin } from "../../../shared/schema";

export type MapListItem = MapCollection & { pinCount: number };

export function useMaps() {
  return useQuery<MapListItem[]>({
    queryKey: ["/api/maps"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}

export function useCreateMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Pick<InsertMapCollection, "name" | "description">) => {
      const res = await apiRequest("POST", "/api/maps", data);
      return (await res.json()) as MapCollection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
  });
}

/** The shape GET /api/maps/:shareUrl actually returns — MapCollection plus its pins and a few display-time-computed fields (see server/routes.ts). */
export interface MapDetail extends MapCollection {
  ownerName: string | null;
  pins: Pin[];
  pinCount: number;
  maxPins: number;
  likeCount: number;
  likedByViewer: boolean;
}

export function useMap(shareUrl: string | undefined) {
  return useQuery<MapDetail>({
    queryKey: [`/api/maps/${shareUrl}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!shareUrl,
  });
}

export function useAddPin(shareUrl: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<InsertPin, "mapId" | "userId">) => {
      const res = await apiRequest("POST", `/api/maps/${shareUrl}/pins`, data);
      return (await res.json()) as Pin;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
  });
}
