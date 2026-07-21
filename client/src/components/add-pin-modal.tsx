import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { PlacesSearch } from "./places-search";
import {
  MapPin,
  Plus,
  Search,
  MousePointer2,
  AtSign,
  ChevronDown,
  Link2,
} from "lucide-react";

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

const NOTE_MAX_LENGTH = 280;

const emptyForm: PinFormData = {
  userName: "",
  twitterHandle: "",
  instagramHandle: "",
  linkedinHandle: "",
  note: "",
};

export function AddPinModal({ isOpen, onClose, mapCollection, selectedLocation: initialLocation }: AddPinModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"search" | "custom">(initialLocation ? "custom" : "search");
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [showSocialLinks, setShowSocialLinks] = useState(false);

  const [formData, setFormData] = useState<PinFormData>(emptyForm);

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
    }
  }, [isOpen, initialLocation]);

  useEffect(() => {
    if (isOpen && user) {
      const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ");
      setFormData((prev) => ({
        ...prev,
        userName: fullName || prev.userName,
        twitterHandle: user.twitterHandle || prev.twitterHandle,
        instagramHandle: user.instagramHandle || prev.instagramHandle,
        linkedinHandle: user.linkedinHandle || prev.linkedinHandle,
      }));
      if (user.twitterHandle || user.instagramHandle || user.linkedinHandle) {
        setShowSocialLinks(true);
      }
    } else if (isOpen && !user) {
      setFormData(emptyForm);
    }
  }, [isOpen, user]);

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
        title: "Pin added",
        description: "Your pin is now live on the map.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${mapCollection.shareUrl}`] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't add pin",
        description: error.message || "Please try again",
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
    setFormData(emptyForm);
    setLocationData(null);
    setSelectedPlace(null);
    setSelectedLocation(null);
    setActiveTab("search");
    setShowSocialLinks(false);
    onClose();
  };

  const hasValidLocation = activeTab === "search" ? !!selectedPlace : !!selectedLocation;
  const socialLinksFilledCount = [formData.twitterHandle, formData.instagramHandle, formData.linkedinHandle].filter(
    Boolean
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-[9999] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 min-w-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="h-4 w-4" />
            </div>
            Add a pin
          </DialogTitle>
          <DialogDescription>Search for a place, or use the spot you picked on the map.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "custom")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search" className="flex items-center gap-2" data-testid="tab-search">
                <Search className="h-4 w-4" />
                Search
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex items-center gap-2" data-testid="tab-custom">
                <MousePointer2 className="h-4 w-4" />
                Map location
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-3 space-y-3">
              <PlacesSearch
                onPlaceSelect={handlePlaceSelect}
                placeholder="Search restaurants, cafes, landmarks..."
              />

              {selectedPlace && <LocationPreview title={selectedPlace.name} subtitle={selectedPlace.address} />}
            </TabsContent>

            <TabsContent value="custom" className="mt-3">
              {isLoadingLocation ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-xl border border-border bg-muted/40 p-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                  Looking up address...
                </div>
              ) : selectedLocation ? (
                <LocationPreview
                  title={locationData?.address || `${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}`}
                  subtitle={[locationData?.city, locationData?.state].filter(Boolean).join(", ") || undefined}
                />
              ) : (
                <div className="text-sm text-muted-foreground text-center py-6 rounded-xl border border-dashed border-border">
                  Click anywhere on the map to drop a pin here
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="userName">Your name</Label>
            <Input
              id="userName"
              type="text"
              placeholder="How should we credit this pin?"
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              required
              autoFocus={!!initialLocation}
              data-testid="input-user-name"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pinNote">Note</Label>
              <span className="text-xs text-muted-foreground">
                {formData.note.length}/{NOTE_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="pinNote"
              placeholder="What makes this place worth pinning?"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value.slice(0, NOTE_MAX_LENGTH) })}
              rows={2}
              data-testid="input-note"
            />
          </div>

          <Collapsible open={showSocialLinks} onOpenChange={setShowSocialLinks}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                data-testid="button-toggle-social-links"
              >
                <span className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Social links {socialLinksFilledCount > 0 && `(${socialLinksFilledCount} added)`}
                  <span className="text-xs font-normal text-muted-foreground/70">optional</span>
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showSocialLinks ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2.5">
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="X (Twitter) handle"
                  value={formData.twitterHandle}
                  onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                  className="pl-9"
                  data-testid="input-twitter"
                />
              </div>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Instagram handle"
                  value={formData.instagramHandle}
                  onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                  className="pl-9"
                  data-testid="input-instagram"
                />
              </div>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="LinkedIn profile"
                  value={formData.linkedinHandle}
                  onChange={(e) => setFormData({ ...formData, linkedinHandle: e.target.value })}
                  className="pl-9"
                  data-testid="input-linkedin"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            Anyone with access to this map can see the details you add here.
          </p>

          <div className="flex gap-3 pt-1">
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
              {createPinMutation.isPending ? "Adding..." : "Add pin"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LocationPreview({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="font-medium text-foreground text-sm truncate">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
      </div>
    </div>
  );
}
