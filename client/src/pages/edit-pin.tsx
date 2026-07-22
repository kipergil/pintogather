import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, AtSign, ExternalLink, Link2, MapPin, Save, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EditPinProps {
  params: {
    shareUrl: string;
    pinId: string;
  };
}

interface PinFormData {
  userName: string;
  twitterHandle: string;
  instagramHandle: string;
  linkedinHandle: string;
  note: string;
}

interface PinRecord {
  id: string;
  userId: string | null;
  userName: string;
  address?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  note?: string;
  googleMapsUrl?: string | null;
}

interface MapCollectionSettings {
  noteLabel?: string | null;
  notePrompt?: string | null;
}

export default function EditPin({ params }: EditPinProps) {
  const { shareUrl, pinId } = params;
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PinFormData>({
    userName: "",
    twitterHandle: "",
    instagramHandle: "",
    linkedinHandle: "",
    note: "",
  });

  // Fetch pin data
  const { data: pin, isLoading: pinLoading, error: pinError } = useQuery<PinRecord>({
    queryKey: [`/api/pins/${pinId}`],
  });

  // Fetch the map's custom note label/prompt, if configured
  const { data: mapCollection } = useQuery<MapCollectionSettings>({
    queryKey: [`/api/maps/${shareUrl}`],
  });
  const noteLabel = mapCollection?.noteLabel || "Note";
  const notePrompt = mapCollection?.notePrompt || null;

  // Populate form when pin data loads, falling back to the signed-in user's
  // own profile for empty fields
  useEffect(() => {
    if (pin) {
      // Check if user owns this pin
      if (user && pin.userId !== user.id) {
        toast({
          title: "Access Denied",
          description: "You can only edit pins you created.",
          variant: "destructive",
        });
        setLocation(`/map/${shareUrl}`);
        return;
      }

      const fullName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ");
      setFormData({
        userName: pin.userName || fullName || "",
        twitterHandle: pin.twitterHandle || user?.twitterHandle || "",
        instagramHandle: pin.instagramHandle || user?.instagramHandle || "",
        linkedinHandle: pin.linkedinHandle || user?.linkedinHandle || "",
        note: pin.note || "",
      });
    }
  }, [pin, user, shareUrl, setLocation, toast]);

  const updatePinMutation = useMutation({
    mutationFn: async (data: PinFormData) => {
      const response = await apiRequest("PUT", `/api/pins/${pinId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/pins/${pinId}`] });
      toast({
        title: "Pin Updated",
        description: "Your pin has been updated successfully.",
        variant: "success",
      });
      setLocation(`/map/${shareUrl}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pin",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userName.trim()) return;

    setLoading(true);
    try {
      updatePinMutation.mutate({
        userName: formData.userName,
        twitterHandle: formData.twitterHandle || "",
        instagramHandle: formData.instagramHandle || "",
        linkedinHandle: formData.linkedinHandle || "",
        note: formData.note || "",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update pin",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (pinLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-7 w-7 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-lg font-semibold">Loading pin...</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pinError || !pin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8 text-center">
            <h2 className="text-lg font-semibold mb-2">Pin not found</h2>
            <p className="text-muted-foreground mb-5 text-sm">
              This pin doesn't exist or you don't have permission to edit it.
            </p>
            <Link href={`/map/${shareUrl}`}>
              <Button className="w-full">Back to map</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto p-4 py-10">
        <Link href={`/map/${shareUrl}`}>
          <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to map
          </Button>
        </Link>

        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit pin</h1>
          </div>
          {pin.address && <p className="text-sm text-muted-foreground ml-11">{pin.address}</p>}
          {pin.googleMapsUrl && (
            <a
              href={pin.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline ml-11 mt-1"
              data-testid="link-google-maps"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on Google Maps
            </a>
          )}
        </div>

        <Card className="border-border">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="userName">Your name</Label>
                <Input
                  id="userName"
                  type="text"
                  placeholder="Enter your name"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  required
                  data-testid="input-user-name"
                />
              </div>

              <div className="space-y-2.5">
                <Label className="text-sm text-muted-foreground">Social links (optional)</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="X (Twitter) handle or URL"
                    value={formData.twitterHandle}
                    onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                    className="pl-9"
                    data-testid="input-twitter"
                  />
                </div>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Instagram handle or URL"
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    className="pl-9"
                    data-testid="input-instagram"
                  />
                </div>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="LinkedIn handle or URL"
                    value={formData.linkedinHandle}
                    onChange={(e) => setFormData({ ...formData, linkedinHandle: e.target.value })}
                    className="pl-9"
                    data-testid="input-linkedin"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">{noteLabel} (optional)</Label>
                {notePrompt && <p className="text-xs text-muted-foreground -mt-1">{notePrompt}</p>}
                <Textarea
                  id="note"
                  placeholder={notePrompt || "Add a note about this location..."}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={3}
                  data-testid="input-note"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Link href={`/map/${shareUrl}`} className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || updatePinMutation.isPending || !formData.userName.trim()}
                  data-testid="button-update-pin"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading || updatePinMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}