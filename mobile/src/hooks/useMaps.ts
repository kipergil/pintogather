import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/api";
import type { InsertMapCollection, InsertPin, MapCollection, Pin, UpdateMapDetails } from "../../../shared/schema";

export type MapListItem = MapCollection & { pinCount: number };

export function useMaps() {
  return useQuery<MapListItem[]>({
    queryKey: ["/api/maps"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}

type CreateMapInput = Pick<
  InsertMapCollection,
  "name" | "description" | "noteLabel" | "notePrompt" | "defaultPinColor" | "defaultPinIcon"
>;

export function useCreateMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateMapInput) => {
      const res = await apiRequest("POST", "/api/maps", data);
      return (await res.json()) as MapCollection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
  });
}

export function useUpdateMap(mapId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateMapDetails) => {
      const res = await apiRequest("PUT", `/api/maps/${mapId}/details`, data);
      return (await res.json()) as MapCollection;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${data.shareUrl}`] });
    },
  });
}

export function useDeleteMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mapId: string) => {
      await apiRequest("DELETE", `/api/maps/${mapId}`);
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
