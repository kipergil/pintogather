import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/api";
import type { InsertMapCollection, InsertPin, MapCollection, Pin, UpdateMapDetails } from "../../../shared/schema";

export type MapListItem = MapCollection & { pinCount: number };

export function useMaps(archivedOnly = false) {
  return useQuery<MapListItem[]>({
    queryKey: archivedOnly ? ["/api/maps?archivedOnly=true"] : ["/api/maps"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}

export function useArchiveMaps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mapIds: string[]) => {
      const res = await apiRequest("POST", "/api/maps/archive", { mapIds });
      return (await res.json()) as { archivedCount: number; archivedIds: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps?archivedOnly=true"] });
    },
  });
}

export function useUnarchiveMaps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mapIds: string[]) => {
      const res = await apiRequest("POST", "/api/maps/unarchive", { mapIds });
      return (await res.json()) as { restoredCount: number; restoredIds: string[]; skippedDueToLimit: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps?archivedOnly=true"] });
    },
  });
}

type CreateMapInput = Pick<
  InsertMapCollection,
  "name" | "description" | "noteLabel" | "notePrompt" | "requirePinApproval" | "defaultPinColor" | "defaultPinIcon"
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

export function useUpdateMapPermissions(mapId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { isPublic: boolean; defaultPermission: "readonly" | "editable" }) => {
      const res = await apiRequest("PUT", `/api/maps/${mapId}/permissions`, data);
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
  hasPinCustomization: boolean;
  /** Set when this map is a clone of another — permanent credit to the original, never editable. Null if the original was deleted. */
  forkedFrom: { name: string; shareUrl: string; ownerName: string | null } | null;
}

export function useMap(shareUrl: string | undefined) {
  return useQuery<MapDetail>({
    queryKey: [`/api/maps/${shareUrl}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!shareUrl,
  });
}

export function useCloneMap(shareUrl: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/maps/${shareUrl}/clone`);
      return (await res.json()) as MapDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
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

export function usePin(pinId: string | undefined) {
  return useQuery<Pin>({
    queryKey: [`/api/pins/${pinId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!pinId,
  });
}

type PinEditableFields = Pick<
  InsertPin,
  "title" | "twitterHandle" | "instagramHandle" | "linkedinHandle" | "note" | "photoUrl" | "pinColor" | "pinIcon"
>;

export function useUpdatePin(pinId: string | undefined, shareUrl: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PinEditableFields>) => {
      const res = await apiRequest("PUT", `/api/pins/${pinId}`, data);
      return (await res.json()) as Pin;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pins/${pinId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
    },
  });
}

export function useDeletePin(shareUrl: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pinId: string) => {
      await apiRequest("DELETE", `/api/pins/${pinId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
  });
}

export function useBulkDeletePins(shareUrl: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pinIds: string[]) => {
      const res = await apiRequest("POST", "/api/pins/bulk-delete", { pinIds });
      return (await res.json()) as { deletedCount: number; skippedCount: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
  });
}

export function useReorderPins(shareUrl: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pinIds: string[]) => {
      await apiRequest("PUT", `/api/maps/${shareUrl}/pins/reorder`, { pinIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
    },
  });
}

export function useBulkImportPins(shareUrl: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pins: Array<Omit<InsertPin, "mapId" | "userId">>) => {
      const res = await apiRequest("POST", `/api/maps/${shareUrl}/pins/bulk`, { pins });
      return (await res.json()) as { created: Pin[]; updated: Pin[]; skippedDueToLimit: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
  });
}
