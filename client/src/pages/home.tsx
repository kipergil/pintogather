import { useQuery } from "@tanstack/react-query";
import { CreateMapForm } from "@/components/create-map-form";
import { Link } from "wouter";
import { Share2, ExternalLink } from "lucide-react";
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
  const { data: maps = [], isLoading } = useQuery<MapCollection[]>({
    queryKey: ["/api/maps"],
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
      {/* Hero Section */}
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-neutral-900 mb-4">Create Collaborative Maps</h2>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
          Build interactive maps where your community can add pins, share locations, and collaborate in real-time.
        </p>
      </div>

      {/* Create Map Form */}
      <div className="max-w-md mx-auto mb-12">
        <CreateMapForm />
      </div>

      {/* Recent Maps */}
      <div className="mt-12">
        <h3 className="text-xl font-semibold text-neutral-900 mb-6">Recent Map Collections</h3>
        
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
              <svg className="w-8 h-8 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No map collections yet</h3>
            <p className="text-neutral-600">Create your first map collection to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {maps.map((map) => (
              <Card key={map.id} className="hover:shadow-material-lg transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-neutral-900">{map.name}</h4>
                    <span className="bg-secondary/10 text-secondary text-xs px-2 py-1 rounded-full">
                      {map.pinCount} pins
                    </span>
                  </div>
                  <p className="text-neutral-600 text-sm mb-4 line-clamp-2">
                    {map.description || "No description provided"}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">
                      Created {formatDate(map.createdAt)}
                    </span>
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
    </main>
  );
}
