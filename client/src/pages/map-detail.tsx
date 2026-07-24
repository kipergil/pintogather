import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, MapPin, AlertCircle, Settings, Share2, Crown, Upload, Menu, Download, Database, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SimpleGoogleMap } from "@/components/simple-google-map";
import { PinTable } from "@/components/pin-table";
import { ShareModal } from "@/components/share-modal";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth-modal";
import { useDirectusAdminUrl, buildDirectusAdminUrl } from "@/lib/directusAdmin";
import { useToast } from "@/hooks/use-toast";
import { downloadPinsCsv } from "@/lib/csv-export";
import { countDistinctContributors } from "@/lib/map-utils";

interface MapDetailProps {
  params: {
    shareUrl: string;
  };
}

interface MapCollection {
  id: string;
  name: string;
  description?: string;
  shareUrl: string;
  ownerId?: string;
  noteLabel?: string | null;
  notePrompt?: string | null;
  brandingLogoUrl?: string | null;
  showOnProfile?: boolean;
  createdAt: string;
  pinCount: number;
  pins: Array<{
    id: string;
    userName: string;
    userId?: string;
    latitude: string;
    longitude: string;
    address?: string;
    city?: string;
    town?: string;
    state?: string;
    borough?: string;
    postcode?: string;
    country?: string;
    twitterHandle?: string;
    instagramHandle?: string;
    linkedinHandle?: string;
    note?: string;
    googleMapsUrl?: string | null;
    approved?: boolean;
    createdAt: string;
  }>;
}

export default function MapDetail({ params }: MapDetailProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ pinId: string; nonce: number } | null>(null);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const directusUrl = useDirectusAdminUrl();

  const { data: mapCollection, isLoading, error } = useQuery<MapCollection>({
    queryKey: [`/api/maps/${params.shareUrl}`],
  });

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="h-96 bg-muted rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error || !mapCollection) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-border">
          <CardContent className="pt-8 pb-8 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Map not found</h2>
            <p className="text-muted-foreground mb-5">
              This map doesn't exist, or the link is no longer valid.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const contributorsCount = countDistinctContributors(mapCollection.pins);
  const isOwner = !!user && user.id === mapCollection.ownerId;
  const pendingCount = mapCollection.pins.filter((pin) => pin.approved === false).length;

  const exportPins = () => {
    if (mapCollection.pins.length === 0) {
      toast({
        title: "Nothing to export",
        description: "This map doesn't have any pins yet.",
        variant: "destructive",
      });
      return;
    }

    downloadPinsCsv(mapCollection.pins, mapCollection.noteLabel || "Note");

    toast({
      title: "CSV exported",
      description: `${mapCollection.pins.length} pin${mapCollection.pins.length === 1 ? "" : "s"} exported.`,
      variant: "success",
    });
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 animate-fade-in">
      {/* Anonymous User Notice */}
      {!user && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span>
            Viewing as a guest — pins save anonymously.{" "}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="font-medium underline hover:no-underline"
            >
              Sign in
            </button>{" "}
            to pin with your profile.
          </span>
        </div>
      )}

      {/* Map Header */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground break-words">{mapCollection.name}</h1>
                {isOwner && (
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary">
                    <Crown className="h-3 w-3" />
                    Owner
                  </Badge>
                )}
              </div>
              {mapCollection.description && (
                <p className="text-muted-foreground">{mapCollection.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/")}
                data-testid="button-back-to-home"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="button-map-menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {isOwner && (
                    <DropdownMenuItem
                      onClick={() => setLocation(`/map/${mapCollection.shareUrl}/edit`)}
                      data-testid="menu-item-edit-map"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Edit map
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setLocation(`/map/${mapCollection.shareUrl}/import`)}
                    data-testid="menu-item-import-pins"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import pins
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsShareModalOpen(true)} data-testid="menu-item-share-map">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  {isOwner && (
                    <DropdownMenuItem onClick={exportPins} data-testid="menu-item-export-csv">
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </DropdownMenuItem>
                  )}
                  {isOwner && directusUrl && (
                    <DropdownMenuItem asChild data-testid="menu-item-open-directus">
                      <a
                        href={buildDirectusAdminUrl(directusUrl, "map_collections", mapCollection.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Database className="h-4 w-4 mr-2" />
                        Open in Directus
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {mapCollection.pinCount} {mapCollection.pinCount === 1 ? "pin" : "pins"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {contributorsCount} {contributorsCount === 1 ? "contributor" : "contributors"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Map View */}
      <SimpleGoogleMap mapCollection={mapCollection} focusRequest={focusRequest} />

      {/* Pins management */}
      <Card className="border-border">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2 flex-wrap">
            Pins <span className="text-muted-foreground font-normal">({mapCollection.pinCount})</span>
            {isOwner && pendingCount > 0 && (
              <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 font-normal text-xs">
                <Clock className="h-3 w-3" />
                {pendingCount} pending review
              </Badge>
            )}
          </h2>
          <PinTable
            pins={mapCollection.pins}
            mapOwnerId={mapCollection.ownerId}
            shareUrl={mapCollection.shareUrl}
            noteLabel={mapCollection.noteLabel}
            onPinSelect={(pinId) => setFocusRequest({ pinId, nonce: Date.now() })}
          />
        </CardContent>
      </Card>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={`${window.location.origin}/map/${mapCollection.shareUrl}`}
        mapName={mapCollection.name}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        returnUrl={`/map/${params.shareUrl}`}
      />
    </main>
  );
}
