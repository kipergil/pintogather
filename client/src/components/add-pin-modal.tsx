import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";
import { MapPin, Plus } from "lucide-react";

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

export function AddPinModal({ isOpen, onClose, mapCollection, selectedLocation }: AddPinModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<PinFormData>({
    userName: "",
    twitterHandle: "",
    instagramHandle: "",
    linkedinHandle: "",
    note: "",
  });

  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Load user profile data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadUserProfile();
    } else if (isOpen && !user) {
      // Reset form when no user is logged in
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
    
    setProfileLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error loading profile:', error);
      } else if (data) {
        setFormData({
          userName: data.full_name || "",
          twitterHandle: data.twitter_handle || "",
          instagramHandle: data.instagram_handle || "",
          linkedinHandle: data.linkedin_handle || "",
          note: "",
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Fetch location data when selectedLocation changes
  useEffect(() => {
    if (!selectedLocation || !isOpen) {
      setLocationData(null);
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
          borough: "",
          postcode: "",
          country: "",
        });
      } finally {
        setIsLoadingLocation(false);
      }
    };

    fetchLocationData();
  }, [selectedLocation, isOpen]);

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
      console.error('Pin creation error:', error);
      let errorMessage = "Failed to add pin";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.userName.trim()) {
      toast({
        title: "Error",
        description: "Your name is required",
        variant: "destructive",
      });
      return;
    }

    if (!selectedLocation || !locationData) {
      toast({
        title: "Error",
        description: "Location data is not available",
        variant: "destructive",
      });
      return;
    }

    const pinData = {
      userId: user?.id || null,
      userName: formData.userName.trim(),
      latitude: selectedLocation.lat.toString(),
      longitude: selectedLocation.lng.toString(),
      address: locationData.address || null,
      city: locationData.city || null,
      state: locationData.state || null,
      borough: locationData.borough || null,
      postcode: locationData.postcode || null,
      country: locationData.country || null,
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
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle>Add New Pin</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Location Info */}
          <div className="bg-neutral-50 rounded-lg p-4">
            <h4 className="font-medium text-neutral-900 mb-2 flex items-center">
              <MapPin className="h-4 w-4 text-accent mr-2" />
              Selected Location
            </h4>
            {isLoadingLocation ? (
              <div className="text-sm text-neutral-600">Loading location data...</div>
            ) : selectedLocation ? (
              <div className="text-sm text-neutral-600 space-y-1">
                <div>
                  <span className="font-medium">Coordinates:</span>{" "}
                  {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                </div>
                {locationData?.address && (
                  <div>
                    <span className="font-medium">Address:</span>{" "}
                    {locationData.address}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-neutral-600">No location selected</div>
            )}
          </div>

          {/* User Info */}
          <div className="space-y-2">
            <Label htmlFor="userName">Your Name *</Label>
            <Input
              id="userName"
              type="text"
              placeholder="Enter your name"
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              required
            />
          </div>

          {/* Social Links */}
          <div className="space-y-3">
            <Label>Social Links (Optional)</Label>
            
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-3 text-blue-500">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </div>
                <Input
                  placeholder="Twitter handle (without @)"
                  value={formData.twitterHandle}
                  onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <div className="absolute left-3 top-3 text-pink-500">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.621 5.367 11.988 11.988 11.988s11.987-5.367 11.987-11.988C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.321-1.295C3.897 14.475 3.365 13.48 3.365 12.017s.532-2.458 1.763-3.676C6.001 7.536 7.152 7.046 8.449 7.046s2.448.49 3.321 1.295c1.231 1.218 1.763 2.213 1.763 3.676s-.532 2.458-1.763 3.676c-.873.805-2.024 1.295-3.321 1.295z"/>
                  </svg>
                </div>
                <Input
                  placeholder="Instagram handle (without @)"
                  value={formData.instagramHandle}
                  onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <div className="absolute left-3 top-3 text-blue-600">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
                <Input
                  placeholder="LinkedIn profile URL or handle"
                  value={formData.linkedinHandle}
                  onChange={(e) => setFormData({ ...formData, linkedinHandle: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <Label htmlFor="pinNote">Note (Optional)</Label>
            <Textarea
              id="pinNote"
              placeholder="Add a note about this location"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button 
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="flex-1"
              disabled={createPinMutation.isPending || isLoadingLocation}
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
