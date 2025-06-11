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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
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

  // Load user profile data to auto-populate form
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      // Try to load from localStorage first
      const localProfile = localStorage.getItem(`profile_${user.id}`);
      if (localProfile) {
        return JSON.parse(localProfile);
      }
      
      // Try Supabase as fallback
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (!error && data) {
            return data;
          }
        } catch (error) {
          console.log('No profile found in Supabase');
        }
      }
      
      return null;
    },
    enabled: !!user,
  });

  // Auto-populate form from profile data
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        userName: profile.full_name || "",
        twitterHandle: profile.twitter_handle || "",
        instagramHandle: profile.instagram_handle || "",
        linkedinHandle: profile.linkedin_handle || "",
      }));
    }
  }, [profile]);

  // Get location from URL parameters or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lng = urlParams.get('lng');
    const address = urlParams.get('address');
    const venueName = urlParams.get('venue');
    
    if (lat && lng) {
      const location = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: address ? decodeURIComponent(address) : undefined
      };
      setSelectedLocation(location);
      
      // If venue name is provided from search, pre-populate the userName field
      if (venueName) {
        const decodedVenueName = decodeURIComponent(venueName);
        setFormData(prev => ({
          ...prev,
          userName: decodedVenueName
        }));
      }
      
      // Only fetch location data if we don't already have address from venue search
      if (!address) {
        fetchLocationData(location.lat, location.lng);
      } else {
        // Parse the provided address for location data
        const addressParts = address.split(',').map(part => part.trim());
        setLocationData({
          address: addressParts[0] || '',
          city: addressParts[1] || '',
          state: addressParts[2] || '',
          town: '',
          borough: '',
          postcode: '',
          country: addressParts[addressParts.length - 1] || ''
        });
      }
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
      // Invalidate multiple cache keys to ensure UI updates
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/maps'] });
      toast({
        title: "Pin added successfully!",
        description: "Your pin has been added to the map.",
        variant: "default",
      });
      
      // Navigate back to map
      setLocation(`/map/${shareUrl}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error adding pin",
        description: error.message || "Failed to add pin to map",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLocation || !formData.userName.trim()) {
      return;
    }

    setLoading(true);
    
    try {
      const pinData = {
        userName: formData.userName.trim(),
        latitude: selectedLocation.lat.toString(),
        longitude: selectedLocation.lng.toString(),
        address: locationData?.address || selectedLocation.address || "",
        city: locationData?.city || "",
        state: locationData?.state || "",
        borough: locationData?.borough || "",
        postcode: locationData?.postcode || "",
        country: locationData?.country || "",
        twitterHandle: formData.twitterHandle.trim(),
        instagramHandle: formData.instagramHandle.trim(),
        linkedinHandle: formData.linkedinHandle.trim(),
        note: formData.note.trim(),
        userId: user?.id || null,
      };

      await createPinMutation.mutateAsync(pinData);
    } catch (error) {
      console.error('Error adding pin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof PinFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!selectedLocation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Loading location...</p>
          <Link href={`/map/${shareUrl}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Map
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <MapPin className="h-6 w-6 mr-3 text-gray-600" />
            <h1 className="text-2xl font-bold text-gray-900">Add Pin to Map</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-lg">
                <Save className="h-5 w-5 mr-2" />
                Pin Details
              </CardTitle>
              <Link href={`/map/${shareUrl}`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Map
                </Button>
              </Link>
            </div>
            {locationData?.address && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <div className="flex items-center mb-2">
                  <MapPin className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900">Selected Location</span>
                </div>
                <p className="text-sm text-blue-800">{locationData.address}</p>
                <div className="text-xs text-blue-600 mt-1">
                  {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="userName" className="text-sm font-medium">
                  Name *
                </Label>
                <Input
                  id="userName"
                  type="text"
                  value={formData.userName}
                  onChange={(e) => handleInputChange('userName', e.target.value)}
                  placeholder="Your name"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="twitterHandle" className="text-sm font-medium">
                  Twitter Handle
                </Label>
                <Input
                  id="twitterHandle"
                  type="text"
                  value={formData.twitterHandle}
                  onChange={(e) => handleInputChange('twitterHandle', e.target.value)}
                  placeholder="@username"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="instagramHandle" className="text-sm font-medium">
                  Instagram Handle
                </Label>
                <Input
                  id="instagramHandle"
                  type="text"
                  value={formData.instagramHandle}
                  onChange={(e) => handleInputChange('instagramHandle', e.target.value)}
                  placeholder="@username"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="linkedinHandle" className="text-sm font-medium">
                  LinkedIn Handle
                </Label>
                <Input
                  id="linkedinHandle"
                  type="text"
                  value={formData.linkedinHandle}
                  onChange={(e) => handleInputChange('linkedinHandle', e.target.value)}
                  placeholder="@username"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="note" className="text-sm font-medium">
                  Note
                </Label>
                <Textarea
                  id="note"
                  value={formData.note}
                  onChange={(e) => handleInputChange('note', e.target.value)}
                  placeholder="Add a note about this location..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Privacy Notice:</strong> Your location and details will be visible to anyone with access to this map. 
                  Only share information you're comfortable making public.
                </p>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading || !formData.userName.trim() || createPinMutation.isPending}
                  className="w-full"
                >
                  {loading || createPinMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding Pin...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Add Pin
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}