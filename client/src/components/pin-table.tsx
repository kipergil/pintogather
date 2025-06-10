import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Download, MapPin, Trash2, Twitter, Instagram, Linkedin, ExternalLink } from "lucide-react";

interface Pin {
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
}

interface PinTableProps {
  pins: Pin[];
  mapOwnerId?: string;
}

export function PinTable({ pins, mapOwnerId }: PinTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const deletePinMutation = useMutation({
    mutationFn: async (pinId: string) => {
      await apiRequest("DELETE", `/api/pins/${pinId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pin deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete pin",
        variant: "destructive",
      });
    },
  });

  const filteredPins = pins.filter(pin =>
    pin.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.note?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportPins = () => {
    const csvContent = [
      ["Name", "Address", "City", "State", "Postcode", "Twitter", "Instagram", "LinkedIn", "Note", "Added Date"].join(","),
      ...filteredPins.map(pin => [
        pin.userName,
        pin.address || "",
        pin.city || "",
        pin.state || "",
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
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">All Pins</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPins}
              disabled={filteredPins.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-neutral-400" />
              <Input
                placeholder="Search pins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-neutral-900">Contributor</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-900">Location</th>
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
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        {pin.address && (
                          <div className="font-medium text-neutral-900 line-clamp-1">{pin.address}</div>
                        )}
                        <div className="text-neutral-500">
                          {[pin.city, pin.state, pin.postcode].filter(Boolean).join(', ')}
                        </div>
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
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                            </svg>
                          </a>
                        )}
                        {pin.instagramHandle && (
                          <a
                            href={`https://instagram.com/${pin.instagramHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pink-500 hover:text-pink-700"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.621 5.367 11.988 11.988 11.988s11.987-5.367 11.987-11.988C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.321-1.295C3.897 14.475 3.365 13.48 3.365 12.017s.532-2.458 1.763-3.676C6.001 7.536 7.152 7.046 8.449 7.046s2.448.49 3.321 1.295c1.231 1.218 1.763 2.213 1.763 3.676s-.532 2.458-1.763 3.676c-.873.805-2.024 1.295-3.321 1.295z"/>
                            </svg>
                          </a>
                        )}
                        {pin.linkedinHandle && (
                          <a
                            href={pin.linkedinHandle.startsWith('http') ? pin.linkedinHandle : `https://linkedin.com/in/${pin.linkedinHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-neutral-500">
                      {formatDate(pin.createdAt)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePinMutation.mutate(pin.id)}
                          disabled={deletePinMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
