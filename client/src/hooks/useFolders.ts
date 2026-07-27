import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import type { Folder, InsertFolder, UpdateFolder } from "@shared/schema";

/** This account's private map-organization folders, flat — components assemble the nested tree from parentFolderId. */
export function useFolders() {
  const { isAuthenticated } = useAuth();
  return useQuery<Folder[]>({
    queryKey: ["/api/folders"],
    enabled: isAuthenticated,
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
      // A deleted folder unfiles its maps (and promotes its subfolders) —
      // both of those are reflected in map/folder listings.
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
  });
}
