import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { AuthModal } from "@/components/auth-modal";
import { AlertCircle, Loader2, LogIn, MapPinned, Shield, Lock } from "lucide-react";

interface AcceptInvitationProps {
  params: { token: string };
}

interface InvitationPreview {
  status: "pending" | "accepted" | "declined";
  permission: "readonly" | "editable";
  expiresAt: string;
  expired: boolean;
  mapName: string;
  mapShareUrl?: string;
  inviterName: string;
}

export default function AcceptInvitation({ params }: AcceptInvitationProps) {
  const { token } = params;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const {
    data: invitation,
    isLoading,
    error,
  } = useQuery<InvitationPreview>({
    queryKey: [`/api/invitations/${token}`],
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/invitations/${token}/accept`, {});
      return response.json() as Promise<{ message: string; mapShareUrl?: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      toast({ title: "You're in!", description: `You've joined "${invitation?.mapName}".`, variant: "success" });
      setLocation(data.mapShareUrl ? `/map/${data.mapShareUrl}` : "/");
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't accept invitation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <InvitationCard
        icon={<AlertCircle className="h-8 w-8 text-destructive" />}
        title="Invitation not found"
        description="This invitation link is invalid or has been removed."
      />
    );
  }

  if (invitation.expired) {
    return (
      <InvitationCard
        icon={<AlertCircle className="h-8 w-8 text-destructive" />}
        title="Invitation expired"
        description="This invitation has expired. Ask whoever invited you to send a new one."
      />
    );
  }

  if (invitation.status !== "pending") {
    return (
      <InvitationCard
        icon={<AlertCircle className="h-8 w-8 text-muted-foreground" />}
        title="Invitation already used"
        description="This invitation has already been accepted or declined."
        action={
          invitation.mapShareUrl && (
            <Button onClick={() => setLocation(`/map/${invitation.mapShareUrl}`)} data-testid="button-go-to-map">
              Go to collection
            </Button>
          )
        }
      />
    );
  }

  return (
    <>
      <InvitationCard
        icon={<MapPinned className="h-8 w-8 text-primary" />}
        title={`Join "${invitation.mapName}"`}
        description={
          <>
            <strong>{invitation.inviterName}</strong> invited you to collaborate on this collection.
          </>
        }
        action={
          <div className="space-y-3 w-full">
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              {invitation.permission === "editable" ? (
                <Shield className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              You'll be able to {invitation.permission === "editable" ? "add and edit items" : "view everything in it"}
            </div>
            {user ? (
              <Button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="w-full"
                data-testid="button-accept-invitation"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Accept invitation"
                )}
              </Button>
            ) : (
              <Button onClick={() => setIsAuthModalOpen(true)} className="w-full" data-testid="button-signin-to-accept">
                <LogIn className="h-4 w-4 mr-2" />
                Sign in to accept
              </Button>
            )}
          </div>
        }
      />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} returnUrl={`/invitations/${token}`} />
    </>
  );
}

function InvitationCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-3">
          {icon}
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          {action && <div className="w-full mt-2">{action}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
