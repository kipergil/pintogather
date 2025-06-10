import { useQuery } from "@tanstack/react-query";
import { CreateMapForm } from "@/components/create-map-form";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Share2, ExternalLink, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  const { data: maps = [], isLoading } = useQuery<MapCollection[]>({
    queryKey: ["/api/maps", user?.id],
    queryFn: () => {
      const params = new URLSearchParams();
      if (user?.id) {
        params.append('userId', user.id);
      }
      return fetch(`/api/maps?${params}`).then(res => res.json());
    },
    enabled: !authLoading,
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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-neutral-900 mb-4">Create Collaborative Maps</h2>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
          Build interactive maps where your community can add pins, share locations, and collaborate in real-time.
        </p>
        
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
              <h3 className="font-semibold mb-2">Collaborate</h3>
              <p className="text-sm text-neutral-600">Contributors click on the map to add pins and automatically become part of your collaborative project.</p>
            </CardContent>
          </Card>
        </div>
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
              <p className="text-neutral-600 mb-4">Sign in to create and manage your collaborative maps.</p>
              <Button 
                className="w-full"
                onClick={() => {
                  window.location.href = '/api/auth/signin';
                }}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In to Create Maps
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {user && (
        <div className="mt-12">
          <h3 className="text-xl font-semibold text-neutral-900 mb-6">Your Map Collections</h3>
        
          {isLoading ? (
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
          ) : maps.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="h-8 w-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2">No maps yet</h3>
              <p className="text-neutral-600">Create your first collaborative map to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {maps.map((map) => (
                <Card key={map.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold text-neutral-900 line-clamp-1">{map.name}</h4>
                    </div>
                    {map.description && (
                      <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{map.description}</p>
                    )}
                    <div className="flex justify-between items-center text-sm text-neutral-500 mb-4">
                      <span>{map.pinCount} pins</span>
                      <span>{formatDate(map.createdAt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(`${window.location.origin}/map/${map.shareUrl}`);
                          }}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Link href={`/map/${map.shareUrl}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}