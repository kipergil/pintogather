import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { PlacesSearch } from "./places-search";
import { MapPin, Plus, Search, MousePointer2, Building2, User, MessageSquare } from "lucide-react";

interface AddPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapCollection: {
    id: string;
    shareUrl: string;
  };
  selectedLocation: {
    lat: number;
    lng: number;
    address?: string;
  } | null;
}

interface LocationData {
  address: string;
  city: string;
  state: string;
  town: string;
  borough: string;
  postcode: string;
  country: string;
}

interface PinFormData {
  userName: string;
  twitterHandle: string;
  instagramHandle: string;
  linkedinHandle: string;
  note: string;
}

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export function AddPinModal({ isOpen, onClose, mapCollection, selectedLocation: initialLocation }: AddPinModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"search" | "custom">(initialLocation ? "custom" : "search");
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  
  const [formData, setFormData] = useState<PinFormData>({
    userName: "",
    twitterHandle: "",
    instagramHandle: "",
    linkedinHandle: "",
    note: "",
  });

  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialLocation) {
        setSelectedLocation(initialLocation);
        setActiveTab("custom");
      } else {
        setActiveTab("search");
      }
      loadUserProfile();
    }
  }, [isOpen, initialLocation]);

  useEffect(() => {
    if (isOpen && user) {
      loadUserProfile();
    } else if (isOpen && !user) {
      setFormData({
        userName: "",
        twitterHandle: "",
        instagramHandle: "",
        linkedinHandle: "",
        note: "",
      });
    }
  }, [isOpen, user]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      const localProfile = localStorage.getItem(`profile_${user.id}`);
      let profileData = null;

      if (localProfile) {
        profileData = JSON.parse(localProfile);
      } else {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
        profileData = { full_name: fullName };
      }

      if (profileData) {
        setFormData(prev => ({
          ...prev,
          userName: profileData.full_name || "",
          twitterHandle: profileData.twitter_handle || "",
          instagramHandle: profileData.instagram_handle || "",
          linkedinHandle: profileData.linkedin_handle || "",
        }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  useEffect(() => {
    if (!selectedLocation || !isOpen || activeTab === "search") {
      if (activeTab === "search") {
        setLocationData(null);
      }
      return;
    }

    const fetchLocationData = async () => {
      setIsLoadingLocation(true);
      try {
        const response = await fetch(
          `/api/geocode?lat=${selectedLocation.lat}&lng=${selectedLocation.lng}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setLocationData(data);
        } else {
          setLocationData({
            address: `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`,
            city: "",
            state: "",
            town: "",
            borough: "",
            postcode: "",
            country: "",
          });
        }
      } catch (error) {
        console.error('Failed to fetch location data:', error);
        setLocationData({
          address: `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`,
          city: "",
          state: "",
          town: "",
          borough: "",
          postcode: "",
          country: "",
        });
      } finally {
        setIsLoadingLocation(false);
      }
    };

    fetchLocationData();
  }, [selectedLocation, isOpen, activeTab]);

  const handlePlaceSelect = (place: PlaceResult) => {
    setSelectedPlace(place);
    setSelectedLocation({
      lat: place.lat,
      lng: place.lng,
      address: place.address
    });
    setLocationData({
      address: place.address,
      city: "",
      state: "",
      town: "",
      borough: "",
      postcode: "",
      country: ""
    });
  };

  const createPinMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/maps/${mapCollection.shareUrl}/pins`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pin added successfully!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${mapCollection.shareUrl}`] });
      handleClose();
    },
    onError: (error: any) => {
      let errorMessage = "Failed to add pin";
      let errorDetails = error.message || "Please try again";
      
      toast({
        title: errorMessage,
        description: errorDetails,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.userName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    const currentLocation = activeTab === "search" ? 
      (selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng, address: selectedPlace.address } : null) :
      selectedLocation;

    if (!currentLocation) {
      toast({
        title: "Location required",
        description: activeTab === "search" ? "Please search and select a place" : "No location selected",
        variant: "destructive",
      });
      return;
    }

    const pinData = {
      userId: user?.id || null,
      userName: formData.userName.trim(),
      latitude: currentLocation.lat.toString(),
      longitude: currentLocation.lng.toString(),
      address: activeTab === "search" ? selectedPlace?.address : (locationData?.address || null),
      city: locationData?.city || null,
      state: locationData?.state || null,
      borough: locationData?.borough || null,
      postcode: locationData?.postcode || null,
      country: locationData?.country || null,
      twitterHandle: formData.twitterHandle.trim() || null,
      instagramHandle: formData.instagramHandle.trim() || null,
      linkedinHandle: formData.linkedinHandle.trim() || null,
      note: formData.note.trim() || null,
    };

    createPinMutation.mutate(pinData);
  };

  const handleClose = () => {
    setFormData({
      userName: "",
      twitterHandle: "",
      instagramHandle: "",
      linkedinHandle: "",
      note: "",
    });
    setLocationData(null);
    setSelectedPlace(null);
    setSelectedLocation(null);
    setActiveTab("search");
    onClose();
  };

  const hasValidLocation = activeTab === "search" ? !!selectedPlace : !!selectedLocation;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Add New Pin
          </DialogTitle>
          <DialogDescription>
            Search for a place or use your selected location on the map
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "custom")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search" className="flex items-center gap-2" data-testid="tab-search">
                <Search className="h-4 w-4" />
                Search Place
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex items-center gap-2" data-testid="tab-custom">
                <MousePointer2 className="h-4 w-4" />
                Map Click
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  Search for a venue or address
                </Label>
                <PlacesSearch 
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="Search restaurants, cafes, landmarks..."
                />
              </div>

              {selectedPlace && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-green-900">{selectedPlace.name}</div>
                      <div className="text-sm text-green-700">{selectedPlace.address}</div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="mt-4">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                {isLoadingLocation ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                    Loading location details...
                  </div>
                ) : selectedLocation ? (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      {locationData?.address ? (
                        <>
                          <div className="font-medium text-gray-900">{locationData.address}</div>
                          {(locationData.city || locationData.state) && (
                            <div className="text-sm text-gray-600">
                              {[locationData.city, locationData.state].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-gray-700">
                          {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-2">
                    Click on the map to select a location
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                Tip: You can click anywhere on the map for a custom location
              </p>
            </TabsContent>
          </Tabs>

          <div className="border-t pt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userName" className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                Your Name *
              </Label>
              <Input
                id="userName"
                type="text"
                placeholder="Enter your name"
                value={formData.userName}
                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                required
                data-testid="input-user-name"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">Social Links (Optional)</Label>
              
              <div className="grid gap-3">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <Input
                    placeholder="X (Twitter) handle"
                    value={formData.twitterHandle}
                    onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                    className="pl-10"
                    data-testid="input-twitter"
                  />
                </div>

                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-500">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                    </svg>
                  </div>
                  <Input
                    placeholder="Instagram handle"
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    className="pl-10"
                    data-testid="input-instagram"
                  />
                </div>

                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                  <Input
                    placeholder="LinkedIn profile"
                    value={formData.linkedinHandle}
                    onChange={(e) => setFormData({ ...formData, linkedinHandle: e.target.value })}
                    className="pl-10"
                    data-testid="input-linkedin"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pinNote" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                Note (Optional)
              </Label>
              <Textarea
                id="pinNote"
                placeholder="Add a note about this location..."
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={2}
                data-testid="input-note"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="flex-1"
              disabled={createPinMutation.isPending || isLoadingLocation || !hasValidLocation}
              data-testid="button-add-pin"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createPinMutation.isPending ? "Adding..." : "Add Pin"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
