import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapView } from "@/components/map-view";
import { PinTable } from "@/components/pin-table";
import { ShareModal } from "@/components/share-modal";

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
    state?: string;
    borough?: string;
    postcode?: string;
    country?: string;
    twitterHandle?: string;
    instagramHandle?: string;
    linkedinHandle?: string;
    note?: string;
    createdAt: string;
  }>;
}

export default function MapDetail({ params }: MapDetailProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const { data: mapCollection, isLoading, error } = useQuery<MapCollection>({
    queryKey: [`/api/maps/${params.shareUrl}`],
  });

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </main>
    );
  }

  if (error || !mapCollection) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Map Not Found</h2>
            <p className="text-neutral-600 mb-4">
              The map collection you're looking for doesn't exist or the URL is invalid.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const contributorsCount = new Set(mapCollection.pins.map(pin => pin.userName)).size;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Map Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Link href="/">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <h2 className="text-2xl font-bold text-neutral-900">{mapCollection.name}</h2>
              </div>
              {mapCollection.description && (
                <p className="text-neutral-600 mb-2">{mapCollection.description}</p>
              )}
              <div className="flex items-center space-x-4">
                <span className="text-sm text-neutral-500">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  {mapCollection.pinCount} pins
                </span>
                <span className="text-sm text-neutral-500">
                  <Users className="h-4 w-4 inline mr-1" />
                  {contributorsCount} contributors
                </span>
              </div>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Collaborative Map:</strong> Anyone with this URL can view and add pins to this map. 
                  Share the link to invite others to contribute!
                </p>
              </div>
            </div>
            
            <Button
              onClick={() => setIsShareModalOpen(true)}
              className="bg-secondary hover:bg-secondary/90"
            >
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
              </svg>
              Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Map View */}
      <MapView mapCollection={mapCollection} />
      
      {/* Pin Table - Always shown at bottom */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Pins ({mapCollection.pinCount})</h3>
          <PinTable pins={mapCollection.pins} mapOwnerId={mapCollection.ownerId} />
        </CardContent>
      </Card>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={`${window.location.origin}/map/${mapCollection.shareUrl}`}
        mapName={mapCollection.name}
      />
    </main>
  );
}
