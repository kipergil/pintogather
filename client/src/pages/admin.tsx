import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Compass, Search, Shield, Users, Settings, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { OpenInDirectusButton } from "@/components/open-in-directus-button";
import { CURATED_CATEGORY_LABELS } from "@/lib/curated-maps";
import type { CuratedCategory } from "@shared/enums";

interface UserProfile {
  id: string;
  fullName: string | null;
  twitterHandle?: string | null;
  instagramHandle?: string | null;
  linkedinHandle?: string | null;
  userGroup: string;
}

interface AdminMapSummary {
  id: string;
  name: string;
  shareUrl: string;
  ownerId: string | null;
  ownerName: string | null;
  curated: boolean;
  curatedCategory: CuratedCategory | null;
  createdAt: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // The server re-checks is_admin on every admin request; this only gates
  // client-side navigation.
  const isAdmin = !!user?.isAdmin;

  useEffect(() => {
    if (user && !isAdmin) {
      setLocation('/');
    }
  }, [user, isAdmin, setLocation]);

  const { data: users = [], isLoading } = useQuery<UserProfile[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/users");
      return response.json();
    },
    enabled: !!user && isAdmin,
  });

  const { data: maps = [], isLoading: mapsLoading } = useQuery<AdminMapSummary[]>({
    queryKey: ['admin', 'maps'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/maps");
      return response.json();
    },
    enabled: !!user && isAdmin,
  });

  const [mapSearch, setMapSearch] = useState("");
  const filteredMaps = useMemo(() => {
    const query = mapSearch.trim().toLowerCase();
    if (!query) return maps;
    return maps.filter(
      (m) => m.name.toLowerCase().includes(query) || (m.ownerName ?? "").toLowerCase().includes(query),
    );
  }, [maps, mapSearch]);

  const updateUserGroupMutation = useMutation({
    mutationFn: async ({ userId, userGroup }: { userId: string; userGroup: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/group`, { userGroup });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({
        title: "User group updated",
        description: "The user's group has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleUserGroupChange = (userId: string, userGroup: string) => {
    updateUserGroupMutation.mutate({ userId, userGroup });
  };

  const getUserGroupColor = (userGroup: string) => {
    switch (userGroup) {
      case 'premium':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'basic':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'freemium':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-600">Please sign in to access the admin panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
              <Link href="/">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
              <p className="text-gray-600">Manage user groups and permissions</p>
            </div>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
              <Badge className="bg-purple-100 text-purple-800">Premium</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.userGroup === 'premium').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Basic Users</CardTitle>
              <Badge className="bg-blue-100 text-blue-800">Basic</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.userGroup === 'basic').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : users.length > 0 ? (
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{user.fullName || "(no name set)"}</h3>
                          <p className="text-sm text-gray-500">ID: {user.id}</p>
                        </div>
                        <Badge className={getUserGroupColor(user.userGroup)}>
                          {user.userGroup}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Select
                        value={user.userGroup}
                        onValueChange={(value) => handleUserGroupChange(user.id, value)}
                        disabled={updateUserGroupMutation.isPending}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="freemium">Freemium</SelectItem>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                      <OpenInDirectusButton collection="directus_users" itemId={user.id} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No users found</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5" />
              Map Curation
            </CardTitle>
            <p className="text-sm text-gray-500">
              Convert any user's map into a curated /discover entry — the owner stays the same.
            </p>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by collection name or owner…"
                value={mapSearch}
                onChange={(e) => setMapSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-admin-maps"
              />
            </div>

            {mapsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : filteredMaps.length > 0 ? (
              <div className="space-y-3">
                {filteredMaps.map((map) => (
                  <div
                    key={map.id}
                    className="flex items-center justify-between gap-3 p-4 border rounded-lg"
                    data-testid={`row-admin-map-${map.id}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{map.name}</h3>
                        {map.curated && (
                          <Badge className="bg-primary/10 text-primary border-primary/30 gap-1">
                            <Compass className="h-3 w-3" />
                            Curated{map.curatedCategory ? ` · ${CURATED_CATEGORY_LABELS[map.curatedCategory]}` : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        Owner: {map.ownerName || "(no owner)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant={map.curated ? "outline" : "default"}
                        size="sm"
                        onClick={() => setLocation(`/admin/maps/${map.id}/curate`)}
                        data-testid={`button-curate-map-${map.id}`}
                      >
                        {map.curated ? "Edit curation" : "Curate"}
                      </Button>
                      <OpenInDirectusButton collection="map_collections" itemId={map.id} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Compass className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No maps found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}