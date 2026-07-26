import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/api";
import type { MapInvitation } from "../../../shared/schema";

interface InvitationsResponse {
  invitations: MapInvitation[];
  seatsUsed: number;
  seatLimit: number;
}

export function useInvitations(mapId: string | undefined) {
  return useQuery<InvitationsResponse>({
    queryKey: [`/api/maps/${mapId}/invitations`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!mapId,
  });
}

export function useSendInvitation(mapId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; permission: "readonly" | "editable" }) => {
      const res = await apiRequest("POST", `/api/maps/${mapId}/invitations`, data);
      return (await res.json()) as MapInvitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${mapId}/invitations`] });
    },
  });
}

export function useDeleteInvitation(mapId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      await apiRequest("DELETE", `/api/invitations/${invitationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${mapId}/invitations`] });
    },
  });
}

export interface InvitationPreview {
  status: "pending" | "accepted" | "declined";
  permission: "readonly" | "editable";
  expiresAt: string;
  expired: boolean;
  mapName: string;
  mapShareUrl?: string;
  inviterName: string;
}

export function useInvitationPreview(token: string | undefined) {
  return useQuery<InvitationPreview>({
    queryKey: [`/api/invitations/${token}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!token,
  });
}

export function useAcceptInvitation(token: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invitations/${token}/accept`, {});
      return (await res.json()) as { message: string; mapShareUrl?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
  });
}
