import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Copy, Share2, Mail, Trash2, Shield, Lock } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUpgradeableError, upgradeToastAction } from "@/lib/upgradeToast";
import { Link as WouterLink } from "wouter";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The map's short share id (e.g. "abc123"), NOT a full URL — this component builds the full /map/:shareUrl link itself. */
  shareUrl: string;
  mapName: string;
  /** Real DB id of the map, needed for the owner-only invitation endpoints. */
  mapId: string;
  /** Only the map owner can invite collaborators by email or see the seat count. */
  isOwner: boolean;
  /** False on surfaces that already have their own copy-link/social share UI (e.g. the map-detail page's SharePopover) — this dialog then opens straight to the invite section. Defaults to true. */
  showLinkAndSocial?: boolean;
}

interface Invitation {
  id: string;
  email: string;
  permission: string;
  status: string;
  createdAt: string;
  token: string;
}

interface InvitationsResponse {
  invitations: Invitation[];
  seatsUsed: number;
  seatLimit: number;
}

export function ShareModal({ isOpen, onClose, shareUrl, mapName, mapId, isOwner, showLinkAndSocial = true }: ShareModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState("readonly");

  // `shareUrl` is just the map's short id (e.g. "abc123") — the actual
  // shareable link is this id under /map/. Building it here rather than
  // expecting callers to pass a full URL keeps MapCollectionSummary/props
  // simple (just the id) while still showing/copying a real, working link.
  const fullShareUrl = `${window.location.origin}/map/${shareUrl}`;

  const invitationsUrl = `/api/maps/${mapId}/invitations`;
  const { data: invitationsData } = useQuery<InvitationsResponse>({
    queryKey: [invitationsUrl],
    enabled: isOpen && isOwner,
  });
  const invitations = invitationsData?.invitations ?? [];
  const seatsUsed = invitationsData?.seatsUsed ?? 0;
  const seatLimit = invitationsData?.seatLimit ?? Infinity;
  const seatLimitReached = seatsUsed >= seatLimit;

  const sendInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; permission: string }) => {
      const response = await apiRequest("POST", invitationsUrl, data);
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [invitationsUrl] });
      setInviteEmail("");
      // Naming the address turns a restatement into something you can act on
      // when it's the wrong one.
      toast({ title: "Invitation sent", description: `We emailed ${variables.email}.` });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't send invitation",
        description: error.message || "Please try again",
        variant: "destructive",
        action: isUpgradeableError(error) ? upgradeToastAction() : undefined,
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest("DELETE", `/api/invitations/${invitationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [invitationsUrl] });
      toast({ title: "Invitation removed", description: "Invitation has been removed successfully." });
    },
  });

  const handleSendInvitation = () => {
    if (!inviteEmail.trim()) return;
    sendInvitationMutation.mutate({ email: inviteEmail, permission: invitePermission });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      toast({ title: "Link copied", variant: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: "Couldn't copy", description: "Select the link and copy it manually", variant: "destructive" });
    }
  };

  const copyInviteLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invitations/${token}`);
      toast({ title: "Invite link copied", description: "Share it directly if email doesn't arrive.", variant: "success" });
    } catch (error) {
      toast({ title: "Couldn't copy", description: "Select the link and copy it manually", variant: "destructive" });
    }
  };

  const shareToSocial = (platform: string) => {
    const text = `Check out this collaborative map: ${mapName}`;
    const url = encodeURIComponent(fullShareUrl);
    const textEncoded = encodeURIComponent(text);

    let shareUrl_platform = "";

    switch (platform) {
      case "twitter":
        shareUrl_platform = `https://twitter.com/intent/tweet?text=${textEncoded}&url=${url}`;
        break;
      case "facebook":
        shareUrl_platform = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case "whatsapp":
        shareUrl_platform = `https://wa.me/?text=${textEncoded}%20${url}`;
        break;
    }

    if (shareUrl_platform) {
      window.open(shareUrl_platform, "_blank", "noopener,noreferrer");
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "declined":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md max-h-[85vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Share2 className="h-5 w-5 mr-2" />
            {showLinkAndSocial ? "Share collection" : "Invite collaborators"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {showLinkAndSocial && (
            <>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">How Collaboration Works</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Anyone with this URL can view the map</li>
                  <li>• Visitors can add pins by clicking the map or searching for a venue</li>
                  <li>• Contributors automatically appear in your map collections</li>
                  <li>• Map owners can delete any pin, contributors can only delete their own</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shareUrl">Public link</Label>
                <div className="flex">
                  <Input
                    id="shareUrl"
                    value={fullShareUrl}
                    readOnly
                    onFocus={(e) => e.currentTarget.blur()}
                    className="flex-1 bg-neutral-50"
                    data-testid="input-share-url"
                  />
                  <Button onClick={copyToClipboard} className="ml-2" variant={copied ? "default" : "outline"} data-testid="button-copy-share-url">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-neutral-500">Anyone with this link can view and contribute to your map</p>
              </div>

              <div className="space-y-2">
                <Label>Share on social</Label>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => shareToSocial("twitter")}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                    size="sm"
                  >
                    <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                    </svg>
                    Twitter
                  </Button>
                  <Button
                    onClick={() => shareToSocial("facebook")}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </Button>
                  <Button
                    onClick={() => shareToSocial("whatsapp")}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    size="sm"
                  >
                    <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.886 3.488" />
                    </svg>
                    WhatsApp
                  </Button>
                </div>
              </div>
            </>
          )}

          {isOwner && (
            <>
              {showLinkAndSocial && <Separator />}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <h4 className="font-medium">Invite by Email</h4>
                  </div>
                  {Number.isFinite(seatLimit) && (
                    <span className="text-sm text-gray-600" data-testid="seat-usage">
                      {seatsUsed} / {seatLimit} seats
                    </span>
                  )}
                </div>

                {seatLimitReached ? (
                  <div
                    className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground"
                    data-testid="seat-limit-locked-notice"
                  >
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">This map has reached its {seatLimit}-collaborator limit for this plan.</span>
                    <WouterLink href="/pricing" className="font-medium text-primary hover:underline shrink-0">
                      Upgrade
                    </WouterLink>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={invitePermission} onValueChange={setInvitePermission}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="readonly">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              Read-only
                            </div>
                          </SelectItem>
                          <SelectItem value="editable">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Editable
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleSendInvitation}
                      disabled={!inviteEmail.trim() || sendInvitationMutation.isPending}
                      className="w-full"
                      size="sm"
                    >
                      {sendInvitationMutation.isPending ? "Sending…" : "Send invitation"}
                    </Button>
                  </div>
                )}

                {invitations.length > 0 && (
                  <div className="space-y-2">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{invitation.email}</span>
                            <Badge className={getStatusBadgeColor(invitation.status)}>{invitation.status}</Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            {invitation.permission === "readonly" ? (
                              <Lock className="h-3 w-3" />
                            ) : (
                              <Shield className="h-3 w-3" />
                            )}
                            {invitation.permission}
                          </div>
                        </div>
                        <div className="flex items-center shrink-0">
                          {invitation.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyInviteLink(invitation.token)}
                              title="Copy invite link"
                              data-testid={`button-copy-invite-link-${invitation.id}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                            disabled={deleteInvitationMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
