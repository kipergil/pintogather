import { useQuery } from "@tanstack/react-query";
import { CreateMapForm } from "@/components/create-map-form";
import { ActivityFeed } from "@/components/activity-feed";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Share2, ExternalLink, LogIn, MapPin, Check, X, Crown, Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DeleteMapModal } from "@/components/delete-map-modal";
import { useState } from "react";

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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteMapModal, setDeleteMapModal] = useState<{ isOpen: boolean; map: MapCollection | null }>({
    isOpen: false,
    map: null
  });
  const { data: ownedMaps = [], isLoading: isLoadingOwned } = useQuery<MapCollection[]>({
    queryKey: ["/api/maps", user?.id, "owned"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maps?ownedOnly=true");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !authLoading && !!user?.id,
  });

  const { data: contributedMaps = [], isLoading: isLoadingContributed } = useQuery<MapCollection[]>({
    queryKey: ["/api/maps", user?.id, "contributed"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maps?contributedOnly=true");
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
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-neutral-900 mb-4">Pin Your World Together</h2>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
          Create collaborative maps where communities gather, share locations, and build connections through shared experiences.
        </p>
        
        {user && (
          <div className="max-w-md mx-auto mb-8">
            <Button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              size="lg"
              className="w-full"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create New Map
              {showCreateForm ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>
            
            {showCreateForm && (
              <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <CreateMapForm />
              </div>
            )}
          </div>
        )}
        
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

      {/* Activity Feed - visible only to anonymous users */}
      {!user && (
        <div className="max-w-2xl mx-auto mb-12">
          <ActivityFeed />
        </div>
      )}

      {/* Pricing Tiers - visible only to anonymous users */}
      {!user && (
        <div className="max-w-5xl mx-auto mb-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-3">Choose Your Plan</h2>
            <p className="text-neutral-600">Free plan available now. Premium features coming soon!</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Free Plan */}
            <Card className="relative">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-lg">Free</CardTitle>
                <div className="text-2xl font-bold">$0</div>
                <p className="text-sm text-neutral-600">Perfect for getting started</p>
                <Badge variant="secondary" className="bg-green-100 text-green-800">Available Now</Badge>
              </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Create unlimited maps</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Add unlimited pins</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Share maps with anyone</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Community collaboration</span>
                </li>
                <li className="flex items-center">
                  <X className="h-4 w-4 text-red-400 mr-3" />
                  <span className="text-sm text-neutral-500">CSV export</span>
                </li>
                <li className="flex items-center">
                  <X className="h-4 w-4 text-red-400 mr-3" />
                  <span className="text-sm text-neutral-500">Venue search</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Basic Plan */}
          <Card className="relative border-blue-200">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-lg text-blue-700">Basic</CardTitle>
              <div className="text-2xl font-bold">£2<span className="text-base font-normal">/month</span></div>
              <p className="text-sm text-neutral-600">Enhanced collaboration tools</p>
              <Badge variant="outline" className="border-orange-200 text-orange-700">Coming Soon</Badge>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Everything in Free</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">CSV export for data analysis</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Venue search integration</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Priority support</span>
                </li>
                <li className="flex items-center">
                  <X className="h-4 w-4 text-red-400 mr-3" />
                  <span className="text-sm text-neutral-500">Advanced analytics</span>
                </li>
                <li className="flex items-center">
                  <X className="h-4 w-4 text-red-400 mr-3" />
                  <span className="text-sm text-neutral-500">Custom branding</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="relative border-purple-200 bg-gradient-to-b from-purple-50 to-white">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-purple-600 text-white">
                <Crown className="h-3 w-3 mr-1" />
                Most Popular
              </Badge>
            </div>
            <CardHeader className="text-center pb-4 pt-6">
              <CardTitle className="text-lg text-purple-700">Premium</CardTitle>
              <div className="text-2xl font-bold">£7<span className="text-base font-normal">/month</span></div>
              <p className="text-sm text-neutral-600">Full-featured collaboration platform</p>
              <Badge variant="outline" className="border-orange-200 text-orange-700">Coming Soon</Badge>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Everything in Basic</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Advanced analytics dashboard</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Custom map branding</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">API access for integrations</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">White-label options</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-3" />
                  <span className="text-sm">Dedicated support</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

          <div className="text-center mt-8">
            <p className="text-sm text-neutral-600">
              Join our waitlist to be notified when premium features become available!
            </p>
          </div>
        </div>
      )}

      {!user && (
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
                          <Link href={`/map/${map.shareUrl}`} className="flex-1">
                            <Button variant="default" size="sm" className="w-full">
                              <MapPin className="h-4 w-4 mr-2" />
                              View Map
                            </Button>
                          </Link>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setDeleteMapModal({ isOpen: true, map })}
                            className="px-3"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                        
                        <Link href={`/map/${map.shareUrl}`} className="w-full">
                          <Button variant="default" size="sm" className="w-full">
                            <MapPin className="h-4 w-4 mr-2" />
                            View Map
                          </Button>
                        </Link>
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
                <p className="text-sm text-blue-800 mb-4">Click the "Create New Map" button above to start a new collaborative map. Give it a descriptive name and optional description.</p>
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

      {/* Use Cases Section */}
      <div className="mt-20 mb-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">Perfect for Every Community</h2>
          <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
            Discover how teams, families, and communities use PinTogather to connect and share meaningful locations
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Team Locations */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-teal-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  <path d="M16 16h3v2h-3v3h-2v-3h-3v-2h3v-3h2v3z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Team Locations</h3>
              <p className="text-neutral-600 mb-4">Create maps for your team members so everyone knows where colleagues are located. Build stronger connections across distributed teams.</p>
              <div className="text-sm text-teal-600 font-medium">Perfect for: Remote teams, distributed workforces, company offices</div>
            </CardContent>
          </Card>

          {/* Remote Teams */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Distributed Teams</h3>
              <p className="text-neutral-600 mb-4">Connect remote workers across the globe. Share office locations, coworking spaces, and team meetup spots.</p>
              <div className="text-sm text-blue-600 font-medium">Perfect for: Remote companies, digital nomads, freelance networks</div>
            </CardContent>
          </Card>

          {/* Families */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zM4 18v-6h2.5l6 6H4zm6.5 0v-6h2l6 6h-8zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Family Connections</h3>
              <p className="text-neutral-600 mb-4">Keep families connected across cities and countries. Share homes, vacation spots, and special places that matter.</p>
              <div className="text-sm text-pink-600 font-medium">Perfect for: Extended families, military families, expats</div>
            </CardContent>
          </Card>

          {/* Friends */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 17v2H2v-2s0-4 7-4 7 4 7 4zM12.5 7.5A3.5 3.5 0 1 0 9 4a3.5 3.5 0 0 0 3.5 3.5zM15.5 7.5A3.5 3.5 0 1 0 19 4a3.5 3.5 0 0 0-3.5 3.5z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Friend Groups</h3>
              <p className="text-neutral-600 mb-4">Plan hangouts and discover new spots together. Share favorite restaurants, bars, and hidden gems with your crew.</p>
              <div className="text-sm text-green-600 font-medium">Perfect for: College friends, hobby groups, social circles</div>
            </CardContent>
          </Card>

          {/* Clubs & Communities */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Clubs & Organizations</h3>
              <p className="text-neutral-600 mb-4">Build community around shared interests. Map club locations, event venues, and member meetup spots.</p>
              <div className="text-sm text-purple-600 font-medium">Perfect for: Sports clubs, book clubs, volunteer groups</div>
            </CardContent>
          </Card>

          {/* Businesses */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Brand Locations</h3>
              <p className="text-neutral-600 mb-4">Showcase franchise locations and venues. Let customers discover and share their favorite brand experiences.</p>
              <div className="text-sm text-orange-600 font-medium">Perfect for: Franchises, restaurant chains, retail networks</div>
            </CardContent>
          </Card>



          {/* Events */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Event Planning</h3>
              <p className="text-neutral-600 mb-4">Coordinate gatherings and celebrations. Share venues, accommodation options, and local recommendations with attendees.</p>
              <div className="text-sm text-indigo-600 font-medium">Perfect for: Weddings, conferences, reunion planning</div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-lg text-neutral-600 mb-6">Ready to bring your community together?</p>
          {!user && (
            <Link href="/auth">
              <Button size="lg" className="px-8 py-3">
                <LogIn className="h-5 w-5 mr-2" />
                Get Started Free
              </Button>
            </Link>
          )}
        </div>
      </div>

      </main>

      {/* Delete Map Modal */}
      {deleteMapModal.map && (
        <DeleteMapModal
          isOpen={deleteMapModal.isOpen}
          onClose={() => setDeleteMapModal({ isOpen: false, map: null })}
          mapCollection={deleteMapModal.map}
        />
      )}
    </>
  );
}