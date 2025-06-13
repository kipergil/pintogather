import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Copy, Mail, Trash2, Users, Shield, Globe, Lock } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ShareSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapCollection: {
    id: string;
    name: string;
    shareUrl: string;
    isPublic?: boolean;
    defaultPermission?: string;
    ownerId?: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  permission: string;
  status: string;
  createdAt: string;
}

export function ShareSettingsModal({ isOpen, onClose, mapCollection }: ShareSettingsModalProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState("readonly");
  const [isPublic, setIsPublic] = useState(mapCollection.isPublic || false);
  const [defaultPermission, setDefaultPermission] = useState(mapCollection.defaultPermission || "readonly");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing invitations
  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ['/api/maps', mapCollection.id, 'invitations'],
    enabled: isOpen
  });

  // Update map permissions
  const updatePermissionsMutation = useMutation({
    mutationFn: async (data: { isPublic: boolean; defaultPermission: string }) => {
      return apiRequest(`/api/maps/${mapCollection.id}/permissions`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maps', mapCollection.shareUrl] });
      toast({
        title: "Permissions updated",
        description: "Map sharing permissions have been updated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update map permissions.",
        variant: "destructive"
      });
    }
  });

  // Send invitation
  const sendInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; permission: string }) => {
      return apiRequest(`/api/maps/${mapCollection.id}/invitations`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maps', mapCollection.id, 'invitations'] });
      setInviteEmail("");
      toast({
        title: "Invitation sent",
        description: "Map invitation has been sent successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send invitation.",
        variant: "destructive"
      });
    }
  });

  // Delete invitation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest(`/api/invitations/${invitationId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maps', mapCollection.id, 'invitations'] });
      toast({
        title: "Invitation removed",
        description: "Invitation has been removed successfully."
      });
    }
  });

  const handleSavePermissions = () => {
    updatePermissionsMutation.mutate({ isPublic, defaultPermission });
  };

  const handleSendInvitation = () => {
    if (!inviteEmail.trim()) return;
    sendInvitationMutation.mutate({ email: inviteEmail, permission: invitePermission });
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard.`
    });
  };

  const getShareUrl = () => {
    const baseUrl = window.location.origin;
    const permission = defaultPermission === 'editable' ? '?mode=edit' : '?mode=view';
    return `${baseUrl}/map/${mapCollection.shareUrl}${permission}`;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share "{mapCollection.name}"
          </DialogTitle>
          <DialogDescription>
            Configure sharing permissions and invite collaborators to your map.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Public Sharing Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <h3 className="font-semibold">Public Access</h3>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Make map publicly accessible</Label>
                <p className="text-sm text-gray-600">
                  Anyone with the link can access this map
                </p>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>

            {isPublic && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Default permission for visitors</Label>
                  <Select value={defaultPermission} onValueChange={setDefaultPermission}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="readonly">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Read-only (view pins only)
                        </div>
                      </SelectItem>
                      <SelectItem value="editable">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Editable (can add pins)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Share link</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={getShareUrl()} 
                      readOnly 
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(getShareUrl(), "Share link")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleSavePermissions}
              disabled={updatePermissionsMutation.isPending}
              className="w-full"
            >
              {updatePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
            </Button>
          </div>

          <Separator />

          {/* Email Invitations */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <h3 className="font-semibold">Invite by Email</h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Email address</Label>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Permission level</Label>
                <Select value={invitePermission} onValueChange={setInvitePermission}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="readonly">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Read-only (view pins only)
                      </div>
                    </SelectItem>
                    <SelectItem value="editable">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Editable (can add pins)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSendInvitation}
                disabled={!inviteEmail.trim() || sendInvitationMutation.isPending}
                className="w-full"
              >
                {sendInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </div>

          {/* Existing Invitations */}
          {Array.isArray(invitations) && invitations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold">Pending Invitations</h3>
                <div className="space-y-2">
                  {(invitations as Invitation[]).map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{invitation.email}</span>
                          <Badge className={getStatusBadgeColor(invitation.status)}>
                            {invitation.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            {invitation.permission === 'readonly' ? (
                              <Lock className="h-3 w-3" />
                            ) : (
                              <Shield className="h-3 w-3" />
                            )}
                            {invitation.permission}
                          </span>
                          <span>
                            Sent {new Date(invitation.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                        disabled={deleteInvitationMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}