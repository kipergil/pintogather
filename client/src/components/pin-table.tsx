import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Download, MapPin, Trash2, Twitter, Instagram, Linkedin, Edit } from "lucide-react";
import { useLocation } from "wouter";
import { getInitials } from "@/lib/map-utils";

interface Pin {
  id: string;
  userName: string;
  userId?: string;
  latitude: string;
  longitude: string;
  address?: string;
  city?: string;
  state?: string;
  town?: string;
  borough?: string;
  postcode?: string;
  country?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  note?: string;
  createdAt: string;
}

interface PinTableProps {
  pins: Pin[];
  mapOwnerId?: string;
  shareUrl?: string;
}

const AVATAR_PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarClasses(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function SocialLinks({ pin }: { pin: Pin }) {
  if (!pin.twitterHandle && !pin.instagramHandle && !pin.linkedinHandle) {
    return <span className="text-sm text-muted-foreground/60">—</span>;
  }
  return (
    <div className="flex items-center gap-2.5">
      {pin.twitterHandle && (
        <a
          href={`https://twitter.com/${pin.twitterHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Twitter className="h-4 w-4" />
        </a>
      )}
      {pin.instagramHandle && (
        <a
          href={`https://instagram.com/${pin.instagramHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Instagram className="h-4 w-4" />
        </a>
      )}
      {pin.linkedinHandle && (
        <a
          href={`https://linkedin.com/in/${pin.linkedinHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Linkedin className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

export function PinTable({ pins, mapOwnerId, shareUrl }: PinTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const canDeletePin = (pin: Pin) => {
    if (!user) return false;
    return user.id === mapOwnerId || user.id === pin.userId;
  };

  const canEditPin = (pin: Pin) => {
    if (!user) return false;
    return user.id === pin.userId;
  };

  const handleEditPin = (pin: Pin) => {
    if (shareUrl) {
      setLocation(`/map/${shareUrl}/edit-pin/${pin.id}`);
    }
  };

  const deletePinMutation = useMutation({
    mutationFn: async (pinId: string) => {
      await apiRequest("DELETE", `/api/pins/${pinId}`);
    },
    onSuccess: () => {
      toast({
        title: "Pin deleted",
        description: "The pin has been removed from this map.",
        variant: "success",
      });
      if (shareUrl) {
        queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete pin",
        variant: "destructive",
      });
    },
  });

  const handleDeletePin = (pinId: string) => {
    if (window.confirm("Are you sure you want to delete this pin?")) {
      deletePinMutation.mutate(pinId);
    }
  };

  const filteredPins = pins.filter(pin =>
    pin.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.note?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportPins = () => {
    if (filteredPins.length === 0) {
      toast({
        title: "Nothing to export",
        description: "There are no pins matching your current search.",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ["Name", "Town", "Country", "Postcode", "Twitter", "Instagram", "LinkedIn", "Note", "Added Date"].join(","),
      ...filteredPins.map(pin => [
        pin.userName,
        [pin.city, pin.town].filter(Boolean).join(', ') || "",
        pin.country || "",
        pin.postcode || "",
        pin.twitterHandle || "",
        pin.instagramHandle || "",
        pin.linkedinHandle || "",
        pin.note || "",
        new Date(pin.createdAt).toLocaleDateString()
      ].map(field => `"${field}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "map-pins.csv";
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exported",
      description: `${filteredPins.length} pin${filteredPins.length === 1 ? "" : "s"} exported.`,
      variant: "success",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 sm:flex-none">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search pins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full sm:w-64"
            data-testid="input-search-pins"
          />
        </div>
        {user?.isAdmin && (
          <Button variant="outline" size="sm" onClick={exportPins} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {filteredPins.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-muted/30">
          <MapPin className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">
            {pins.length === 0 ? "No pins yet" : "No pins match your search"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {pins.length === 0
              ? "Click on the map to add the first pin to this collection."
              : "Try adjusting your search terms."
            }
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="block lg:hidden space-y-3">
            {filteredPins.map((pin) => (
              <Card key={pin.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${avatarClasses(pin.userName)}`}>
                        <span className="text-sm font-semibold">{getInitials(pin.userName)}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground text-sm">{pin.userName}</h4>
                        <p className="text-xs text-muted-foreground">{formatDate(pin.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canEditPin(pin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditPin(pin)}
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeletePin(pin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePin(pin.id)}
                          disabled={deletePinMutation.isPending}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {(pin.city || pin.town || pin.country || pin.postcode) && (
                    <div className="flex items-start gap-2 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        {[pin.city, pin.town, pin.country, pin.postcode].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}

                  {pin.note && <p className="text-sm text-foreground/80 mb-3 italic">&ldquo;{pin.note}&rdquo;</p>}

                  <SocialLinks pin={pin} />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contributor</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Added</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPins.map((pin) => (
                  <tr key={pin.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${avatarClasses(pin.userName)}`}>
                          <span className="text-xs font-semibold">{getInitials(pin.userName)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground text-sm truncate">{pin.userName}</div>
                          {pin.note && <div className="text-xs text-muted-foreground line-clamp-1">{pin.note}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-sm text-foreground">
                      {[pin.city, pin.town].filter(Boolean).join(', ') || pin.country || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <SocialLinks pin={pin} />
                    </td>
                    <td className="py-3.5 px-4 text-sm text-muted-foreground">
                      {formatDate(pin.createdAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        {canEditPin(pin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPin(pin)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeletePin(pin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePin(pin.id)}
                            disabled={deletePinMutation.isPending}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
