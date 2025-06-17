import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, MapPin, AlertCircle, Download } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleGoogleMap } from "@/components/simple-google-map";
import { PinTable } from "@/components/pin-table";
import { ShareModal } from "@/components/share-modal";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth-modal";
import { useToast } from "@/hooks/use-toast";

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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

  const exportToCSV = () => {
    if (!mapCollection.pins.length) {
      toast({
        title: "No data to export",
        description: "This map has no pins to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      'Name',
      'Address',
      'City',
      'State',
      'Country',
      'Latitude',
      'Longitude',
      'Twitter',
      'Instagram',
      'LinkedIn',
      'Note',
      'Date Added'
    ];

    const csvData = mapCollection.pins.map(pin => [
      pin.userName || '',
      pin.address || '',
      pin.city || '',
      pin.state || '',
      pin.country || '',
      pin.latitude || '',
      pin.longitude || '',
      pin.twitterHandle || '',
      pin.instagramHandle || '',
      pin.linkedinHandle || '',
      pin.note || '',
      new Date(pin.createdAt).toLocaleDateString()
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${mapCollection.name}-pins.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV exported",
      description: `${mapCollection.pins.length} pins exported to ${mapCollection.name}-pins.csv`,
    });
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Anonymous User Notice */}
      {!user && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-900">Viewing as Guest</h3>
                <p className="text-sm text-amber-800 mt-1">
                  You're viewing this map as a guest. You can pin locations, but they will be saved anonymously. 
                  <button 
                    onClick={() => setIsAuthModalOpen(true)}
                    className="font-medium underline hover:no-underline ml-1"
                  >
                    Sign in or sign up
                  </button>
                  {" "}to pin with your profile and connect with the community.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map Header */}
      <Card>
        <CardContent className="p-6">
          {/* Title Row with Action Buttons */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-neutral-900">{mapCollection.name}</h2>
              {mapCollection.description && (
                <p className="text-neutral-600 mt-1">{mapCollection.description}</p>
              )}
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsShareModalOpen(true)}
              >
                Share
              </Button>
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center space-x-4 mb-4">
            <span className="text-sm text-neutral-500">
              <MapPin className="h-4 w-4 inline mr-1" />
              {mapCollection.pinCount} pins
            </span>
            <span className="text-sm text-neutral-500">
              <Users className="h-4 w-4 inline mr-1" />
              {contributorsCount} contributors
            </span>
          </div>

          {/* Community Note */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-1">Community Collaboration</h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                  This is a shared community map where anyone with the URL can view and add pins. 
                  Click anywhere on the map to add your location and connect with others in the community!
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map View */}
      <SimpleGoogleMap mapCollection={mapCollection} />
      
      {/* Pin Table - Always shown at bottom */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Pins ({mapCollection.pinCount})</h3>
          <PinTable pins={mapCollection.pins} mapOwnerId={mapCollection.ownerId} shareUrl={mapCollection.shareUrl} />
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
