import { useQuery } from "@tanstack/react-query";
import { CreateMapForm } from "@/components/create-map-form";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Share2, ExternalLink, LogIn, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface MapCollection {
  id: string;
  name: string;
  description?: string;
  shareUrl: string;
  createdAt: string;
  pinCount: number;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { data: ownedMaps = [], isLoading: isLoadingOwned } = useQuery<MapCollection[]>({
    queryKey: ["/api/maps", user?.id, "owned"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.id) {
        params.append('userId', user.id);
        params.append('ownedOnly', 'true');
      }
      const response = await fetch(`/api/maps?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch owned maps');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !authLoading && !!user?.id,
  });

  const { data: contributedMaps = [], isLoading: isLoadingContributed } = useQuery<MapCollection[]>({
    queryKey: ["/api/maps", user?.id, "contributed"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.id) {
        params.append('userId', user.id);
        params.append('contributedOnly', 'true');
      }
      const response = await fetch(`/api/maps?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch contributed maps');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !authLoading && !!user?.id,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const handleCopyMapUrl = async (shareUrl: string, mapName: string) => {
    try {
      const url = `${window.location.origin}/map/${shareUrl}`;
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: `Map "${mapName}" link copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-neutral-900 mb-4">Pin Your World Together</h2>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
          Create collaborative maps where communities gather, share locations, and build connections through shared experiences.
        </p>
        
        {!user && (
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600">1</span>
                </div>
                <h3 className="font-semibold mb-2">Create a Map</h3>
                <p className="text-sm text-neutral-600">Start by creating a new collaborative map with a name and description.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-600">2</span>
                </div>
                <h3 className="font-semibold mb-2">Share the URL</h3>
                <p className="text-sm text-neutral-600">Get a unique shareable URL that allows anyone to view and contribute to your map.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-600">3</span>
                </div>
                <h3 className="font-semibold mb-2">Pin Together</h3>
                <p className="text-sm text-neutral-600">Contributors click on the map to add pins and gather around shared locations and experiences.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {user ? (
        <div className="max-w-md mx-auto mb-12">
          <CreateMapForm />
        </div>
      ) : (
        <div className="max-w-md mx-auto mb-12 text-center">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-2">Get Started</h3>
              <p className="text-neutral-600 mb-4">Sign in to create maps where communities can pin together.</p>
              <Link href="/auth" className="w-full">
                <Button className="w-full">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In to Create Maps
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {user && (ownedMaps.length > 0 || isLoadingOwned) && (
        <div className="mt-12">
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-neutral-900 mb-6">Maps You Created</h3>
            
              {isLoadingOwned ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-gray-200 rounded mb-3"></div>
                        <div className="h-3 bg-gray-200 rounded mb-4"></div>
                        <div className="flex justify-between">
                          <div className="h-3 bg-gray-200 rounded w-20"></div>
                          <div className="flex space-x-2">
                            <div className="h-6 w-6 bg-gray-200 rounded"></div>
                            <div className="h-6 w-6 bg-gray-200 rounded"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(ownedMaps || []).map((map) => (
                    <Card key={map.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-semibold text-neutral-900 line-clamp-1">{map.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            Owner
                          </Badge>
                        </div>
                        
                        {map.description && (
                          <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{map.description}</p>
                        )}
                        
                        <div className="flex items-center justify-between text-sm text-neutral-500 mb-4">
                          <span>{map.pinCount} pins</span>
                          <span>{formatDate(map.createdAt)}</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.preventDefault();
                              handleCopyMapUrl(map.shareUrl, map.name);
                            }}
                          >
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                          </Button>
                          <Link href={`/map/${map.shareUrl}`} className="flex-1">
                            <Button variant="default" size="sm" className="w-full">
                              <MapPin className="h-4 w-4 mr-2" />
                              View Map
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Maps You Contributed To Section */}
      {user && (contributedMaps.length > 0 || isLoadingContributed) && (
        <div className="mt-12">
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-neutral-900 mb-6">Maps You Contributed To</h3>
            
              {isLoadingContributed ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-5 bg-neutral-200 rounded mb-3"></div>
                        <div className="h-4 bg-neutral-200 rounded mb-2"></div>
                        <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(contributedMaps || []).map((map) => (
                    <Card key={map.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-semibold text-neutral-900 line-clamp-1">{map.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            Contributor
                          </Badge>
                        </div>
                        
                        {map.description && (
                          <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{map.description}</p>
                        )}
                        
                        <div className="flex items-center justify-between text-sm text-neutral-500 mb-4">
                          <span>{map.pinCount} pins</span>
                          <span>{formatDate(map.createdAt)}</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.preventDefault();
                              handleCopyMapUrl(map.shareUrl, map.name);
                            }}
                          >
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                          </Button>
                          <Link href={`/map/${map.shareUrl}`} className="flex-1">
                            <Button variant="default" size="sm" className="w-full">
                              <MapPin className="h-4 w-4 mr-2" />
                              View Map
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step-by-step guide for signed-in users */}
      {user && (
        <div className="mt-16 mb-12">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-neutral-900 mb-2">Getting Started Guide</h3>
            <p className="text-neutral-600">Follow these simple steps to create your first collaborative map</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
            {/* Step 1 */}
            <Card className="border-2 border-blue-100 bg-blue-50/50">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h4 className="text-lg font-semibold text-blue-900 mb-3">Create Your Map</h4>
                <p className="text-sm text-blue-800 mb-4">Use the form above to create a new collaborative map. Give it a descriptive name and optional description.</p>
                <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">💡 Tip: Choose a clear name that describes the purpose of your map</p>
                </div>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="border-2 border-green-100 bg-green-50/50">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h4 className="text-lg font-semibold text-green-900 mb-3">Share Your Map</h4>
                <p className="text-sm text-green-800 mb-4">Copy the map URL and share it with friends, colleagues, or your community. Anyone with the link can view and add pins.</p>
                <div className="bg-white/70 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-green-700 font-medium">💡 Tip: Share via social media, email, or messaging apps</p>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="border-2 border-purple-100 bg-purple-50/50">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h4 className="text-lg font-semibold text-purple-900 mb-3">Pin Together</h4>
                <p className="text-sm text-purple-800 mb-4">Contributors click anywhere on the map to add pins with their information. Watch your community gather around shared locations!</p>
                <div className="bg-white/70 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-purple-700 font-medium">💡 Tip: Encourage detailed pin descriptions to build stronger connections</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}