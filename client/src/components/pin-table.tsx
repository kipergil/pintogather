import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { Search, Download, MapPin, Trash2, Twitter, Instagram, Linkedin, Edit, Crown } from "lucide-react";
import { useLocation } from "wouter";

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

export function PinTable({ pins, mapOwnerId, shareUrl }: PinTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { canExportCSV, userGroup } = useUserPermissions();

  // Check if user can delete a pin (map owner or pin creator)
  const canDeletePin = (pin: Pin) => {
    if (!user) return false;
    return user.id === mapOwnerId || user.id === pin.userId;
  };

  // Check if user can edit a pin (only pin creator)
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
        title: "Success",
        description: "Pin deleted successfully",
      });
      // Invalidate specific map data to update UI immediately
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
    if (!canExportCSV) {
      toast({
        title: "Upgrade Required",
        description: "CSV export is available for Basic and Premium users. Upgrade your account to access this feature.",
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
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Search and Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-neutral-400" />
          <Input
            placeholder="Search pins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full sm:w-64"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportPins}
          disabled={filteredPins.length === 0}
          className={!canExportCSV ? "opacity-50" : ""}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
          {!canExportCSV && <Crown className="h-3 w-3 ml-1 text-yellow-500" />}
        </Button>
      </div>

      {filteredPins.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 mb-2">
            {pins.length === 0 ? "No pins yet" : "No pins match your search"}
          </h3>
          <p className="text-neutral-600">
            {pins.length === 0 
              ? "Click on the map to add the first pin to this collection."
              : "Try adjusting your search terms."
            }
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="block lg:hidden space-y-4">
            {filteredPins.map((pin) => (
              <Card key={pin.id} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {pin.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-neutral-900">{pin.userName}</h4>
                        <p className="text-sm text-neutral-500">{formatDate(pin.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {canEditPin(pin) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPin(pin)}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 touch-target"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeletePin(pin) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePin(pin.id)}
                          disabled={deletePinMutation.isPending}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 touch-target"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {(pin.city || pin.town || pin.country || pin.postcode) && (
                    <div className="space-y-1 mb-2">
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-neutral-400 mt-0.5" />
                        <p className="text-sm text-neutral-600">
                          {[pin.city, pin.town, pin.country, pin.postcode].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {pin.note && (
                    <p className="text-sm text-neutral-600 mb-3 italic">"{pin.note}"</p>
                  )}
                  
                  <div className="flex items-center space-x-3">
                    {pin.twitterHandle && (
                      <a
                        href={`https://twitter.com/${pin.twitterHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <Twitter className="h-4 w-4" />
                      </a>
                    )}
                    {pin.instagramHandle && (
                      <a
                        href={`https://instagram.com/${pin.instagramHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-500 hover:text-pink-700"
                      >
                        <Instagram className="h-4 w-4" />
                      </a>
                    )}
                    {pin.linkedinHandle && (
                      <a
                        href={`https://linkedin.com/in/${pin.linkedinHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Linkedin className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-neutral-900">Contributor</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-900">Town</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-900">Country</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-900">Postcode</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-900">Social Links</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-900">Added</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPins.map((pin) => (
                  <tr key={pin.id} className="border-b border-gray-100 hover:bg-neutral-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {pin.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900">{pin.userName}</div>
                          {pin.note && (
                            <div className="text-sm text-neutral-500 line-clamp-1">{pin.note}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div className="text-neutral-900">
                        {[pin.city, pin.town].filter(Boolean).join(', ') || '-'}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div className="text-neutral-900">
                        {pin.country || '-'}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div className="text-neutral-900">
                        {pin.postcode || '-'}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex space-x-2">
                        {pin.twitterHandle && (
                          <a
                            href={`https://twitter.com/${pin.twitterHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <Twitter className="h-4 w-4" />
                          </a>
                        )}
                        {pin.instagramHandle && (
                          <a
                            href={`https://instagram.com/${pin.instagramHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pink-500 hover:text-pink-700"
                          >
                            <Instagram className="h-4 w-4" />
                          </a>
                        )}
                        {pin.linkedinHandle && (
                          <a
                            href={`https://linkedin.com/in/${pin.linkedinHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Linkedin className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-neutral-500">
                      {formatDate(pin.createdAt)}
                    </td>
                    <td className="py-4 px-4">
                      {canDeletePin(pin) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePin(pin.id)}
                          disabled={deletePinMutation.isPending}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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