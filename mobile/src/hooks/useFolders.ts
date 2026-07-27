import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/api";
import type { Folder, InsertFolder, UpdateFolder } from "../../../shared/schema";

/** This account's private map-organization folders, flat — components assemble the nested tree from parentFolderId. */
export function useFolders() {
  return useQuery<Folder[]>({
    queryKey: ["/api/folders"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFolder) => {
      const res = await apiRequest("POST", "/api/folders", data);
      return (await res.json()) as Folder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, data }: { folderId: string; data: UpdateFolder }) => {
      const res = await apiRequest("PUT", `/api/folders/${folderId}`, data);
      return (await res.json()) as Folder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderId: string) => {
      await apiRequest("DELETE", `/api/folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps?archivedOnly=true"] });
    },
  });
}

export function useMoveMapToFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mapId, folderId }: { mapId: string; folderId: string | null }) => {
      const res = await apiRequest("PUT", `/api/maps/${mapId}/details`, { folderId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps?archivedOnly=true"] });
    },
  });
}
