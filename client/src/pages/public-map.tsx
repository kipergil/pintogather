import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Users } from "lucide-react";
import { SimpleGoogleMap } from "@/components/simple-google-map";
import { PinTable } from "@/components/pin-table";

interface PublicMapProps {
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
  pinCount: number;
  pins: Array<{
    id: string;
    userName: string;
    userId?: string;
    latitude: string;
    longitude: string;
    address?: string;
    city?: string;
    state?: string;
    borough?: string;
    postcode?: string;
    country?: string;
    twitterHandle?: string;
    instagramHandle?: string;
    linkedinHandle?: string;
    note?: string;
    googleMapsUrl?: string | null;
    createdAt: string;
  }>;
}

/**
 * Read-only, branding-independent view of a map — meant to be shared as its
 * own standalone link. No PinTogather header, no sign-in, no editing: just
 * the owner's optional logo, the map description, and the pins.
 */
export default function PublicMap({ params }: PublicMapProps) {
  const { data: mapCollection, isLoading, error } = useQuery<MapCollection>({
    queryKey: [`/api/maps/${params.shareUrl}`],
  });
  const [focusRequest, setFocusRequest] = useState<{ pinId: string; nonce: number } | null>(null);

  useEffect(() => {
    if (mapCollection?.name) {
      document.title = mapCollection.name;
    }
  }, [mapCollection?.name]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  if (error || !mapCollection) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground mb-1">Map not found</h1>
          <p className="text-sm text-muted-foreground">This link is no longer valid.</p>
        </div>
      </main>
    );
  }

  const contributorsCount = new Set(mapCollection.pins.map((pin) => pin.userName)).size;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div>
          {mapCollection.brandingLogoUrl && (
            <img
              src={mapCollection.brandingLogoUrl}
              alt=""
              className="h-10 max-w-[200px] object-contain mb-4"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground break-words">{mapCollection.name}</h1>
          {mapCollection.description && (
            <p className="text-muted-foreground mt-1.5">{mapCollection.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {mapCollection.pinCount} {mapCollection.pinCount === 1 ? "pin" : "pins"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {contributorsCount} {contributorsCount === 1 ? "contributor" : "contributors"}
            </span>
          </div>
        </div>

        <SimpleGoogleMap mapCollection={mapCollection} readOnly focusRequest={focusRequest} />

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Pins <span className="text-muted-foreground font-normal">({mapCollection.pinCount})</span>
          </h2>
          <PinTable
            pins={mapCollection.pins}
            mapOwnerId={mapCollection.ownerId}
            noteLabel={mapCollection.noteLabel}
            readOnly
            onPinSelect={(pinId) => setFocusRequest({ pinId, nonce: Date.now() })}
          />
        </div>
      </div>
    </main>
  );
}
