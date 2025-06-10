import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { reverseGeocode, type LocationData } from "@/lib/map-utils";
import { ArrowLeft, MapPin, Save } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AddPinProps {
  params: {
    shareUrl: string;
  };
}

interface PinFormData {
  userName: string;
  twitterHandle: string;
  instagramHandle: string;
  linkedinHandle: string;
  note: string;
}

export default function AddPin({ params }: AddPinProps) {
  const { shareUrl } = params;
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);
  
  const [formData, setFormData] = useState<PinFormData>({
    userName: "",
    twitterHandle: "",
    instagramHandle: "",
    linkedinHandle: "",
    note: "",
  });

  // Get location from URL parameters or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lng = urlParams.get('lng');
    
    if (lat && lng) {
      const location = {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      };
      setSelectedLocation(location);
      fetchLocationData(location.lat, location.lng);
    } else {
      // Redirect back to map if no location provided
      setLocation(`/map/${shareUrl}`);
    }
  }, [shareUrl, setLocation]);

  const fetchLocationData = async (lat: number, lng: number) => {
    try {
      const data = await reverseGeocode(lat, lng);
      setLocationData(data);
      setSelectedLocation(prev => prev ? { ...prev, address: data?.address } : null);
    } catch (error) {
      console.error('Error fetching location data:', error);
    }
  };

  const createPinMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/maps/${shareUrl}/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to add pin');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maps', shareUrl] });
      toast({
        title: "Pin Added",
        description: "Your pin has been added to the map successfully.",
      });
      setLocation(`/map/${shareUrl}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add pin",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation || !formData.userName.trim()) return;

    setLoading(true);
    try {
      const pinData = {
        userName: formData.userName,
        latitude: selectedLocation.lat.toString(),
        longitude: selectedLocation.lng.toString(),
        address: locationData?.address || selectedLocation.address,
        city: locationData?.city,
        state: locationData?.state,
        town: locationData?.town,
        borough: locationData?.borough,
        postcode: locationData?.postcode,
        country: locationData?.country,
        twitterHandle: formData.twitterHandle || null,
        instagramHandle: formData.instagramHandle || null,
        linkedinHandle: formData.linkedinHandle || null,
        note: formData.note || null,
        userId: user?.id || null,
      };

      createPinMutation.mutate(pinData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add pin",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!selectedLocation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">No Location Selected</h2>
            <p className="text-gray-600 mb-4">Please select a location on the map first.</p>
            <Link href={`/map/${shareUrl}`}>
              <Button className="w-full">Back to Map</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 py-8 mobile-safe-area">
        <div className="mb-6">
          <Link href={`/map/${shareUrl}`}>
            <Button variant="ghost" size="sm" className="mb-4 touch-target">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Map
            </Button>
          </Link>
          
          <div className="flex items-center mb-2">
            <MapPin className="h-6 w-6 mr-3 text-gray-600" />
            <h1 className="text-2xl font-bold text-gray-900">Add Pin to Map</h1>
          </div>
          
          {locationData?.address && (
            <p className="text-sm text-gray-600">
              Location: {locationData.address}
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pin Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="userName">Your Name *</Label>
                <Input
                  id="userName"
                  type="text"
                  placeholder="Enter your name"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  className="h-12 text-base touch-target"
                  required
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Social Media (Optional)</Label>
                
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                    </div>
                    <Input
                      placeholder="Twitter handle (without @)"
                      value={formData.twitterHandle}
                      onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                      className="pl-12 h-12 text-base touch-target"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pink-500">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.621 5.367 11.988 11.988 11.988s11.987-5.367 11.987-11.988C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.321-1.295C3.897 14.475 3.365 13.48 3.365 12.017s.532-2.458 1.763-3.676C6.001 7.536 7.152 7.046 8.449 7.046s2.448.49 3.321 1.295c1.231 1.218 1.763 2.213 1.763 3.676s-.532 2.458-1.763 3.676c-.873.805-2.024 1.295-3.321 1.295z"/>
                      </svg>
                    </div>
                    <Input
                      placeholder="Instagram handle (without @)"
                      value={formData.instagramHandle}
                      onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                      className="pl-12 h-12 text-base touch-target"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </div>
                    <Input
                      placeholder="LinkedIn profile URL or handle"
                      value={formData.linkedinHandle}
                      onChange={(e) => setFormData({ ...formData, linkedinHandle: e.target.value })}
                      className="pl-12 h-12 text-base touch-target"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note (Optional)</Label>
                <Textarea
                  id="note"
                  placeholder="Add a note about this location..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="min-h-[100px] text-base resize-none"
                  rows={4}
                />
              </div>

              <div className="pt-4">
                <Button 
                  type="submit"
                  className="w-full h-12 text-base touch-target"
                  disabled={loading || createPinMutation.isPending || !formData.userName.trim()}
                >
                  <Save className="h-5 w-5 mr-2" />
                  {loading || createPinMutation.isPending ? "Adding Pin..." : "Add Pin to Map"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}