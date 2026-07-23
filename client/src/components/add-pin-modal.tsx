import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { PlacesSearch } from "./places-search";
import {
  MapPin,
  Plus,
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
    noteLabel?: string | null;
    notePrompt?: string | null;
  };
  /** Set when opened by clicking a spot on the map; left null when opened via the "Add a venue" search button. */
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

type LocationSource = "click" | "search";

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
  const noteLabel = mapCollection.noteLabel || "Note";
  const notePrompt = mapCollection.notePrompt || null;

  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [showSocialLinks, setShowSocialLinks] = useState(false);

  const [formData, setFormData] = useState<PinFormData>(emptyForm);

  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Opened by clicking the map: an initial location is provided, so we skip
  // straight to the pin details. Opened via "Add a venue": no location yet,
  // so a search box is shown first — see the render logic below.
  useEffect(() => {
    if (isOpen) {
      if (initialLocation) {
        setSelectedLocation(initialLocation);
        setLocationSource("click");
      } else {
        setSelectedLocation(null);
        setLocationSource(null);
      }
      setSelectedPlace(null);
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
    if (!selectedLocation || !isOpen || locationSource !== "click") return;

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
  }, [selectedLocation, isOpen, locationSource]);

  const handlePlaceSelect = (place: PlaceResult) => {
    setSelectedPlace(place);
    setSelectedLocation({
      lat: place.lat,
      lng: place.lng,
      address: place.address
    });
    setLocationSource("search");
    setLocationData({
      address: place.address,
      city: "",
      state: "",
      town: "",
      borough: "",
      postcode: "",
      country: ""
    });
    // Name the pin after the venue so search-built maps read as a list of places.
    setFormData((prev) => ({ ...prev, userName: place.name }));
  };

  const searchAgain = () => {
    setSelectedLocation(null);
    setSelectedPlace(null);
    setLocationSource(null);
    setLocationData(null);
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

    if (!selectedLocation) {
      toast({
        title: "Location required",
        description: "Please search and select a place, or pick a spot on the map",
        variant: "destructive",
      });
      return;
    }

    const pinData = {
      userId: user?.id || null,
      userName: formData.userName.trim(),
      latitude: selectedLocation.lat.toString(),
      longitude: selectedLocation.lng.toString(),
      address: locationSource === "search" ? selectedPlace?.address : (locationData?.address || null),
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
    setLocationSource(null);
    setShowSocialLinks(false);
    onClose();
  };

  const socialLinksFilledCount = [formData.twitterHandle, formData.instagramHandle, formData.linkedinHandle].filter(
    Boolean
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] z-[9999] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 min-w-0 shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="h-4 w-4" />
            </div>
            {!selectedLocation ? "Add a venue" : "Add a pin"}
          </DialogTitle>
          <DialogDescription>
            {!selectedLocation
              ? "Search for the place you want to pin."
              : "Fill in the details, then add it to the map."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 min-w-0">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-w-0">
          {!selectedLocation ? (
            <PlacesSearch
              onPlaceSelect={handlePlaceSelect}
              placeholder="Search restaurants, cafes, landmarks..."
            />
          ) : (
            <>
              {isLoadingLocation ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-xl border border-border bg-muted/40 p-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                  Looking up address...
                </div>
              ) : (
                <LocationPreview
                  title={
                    locationSource === "search"
                      ? selectedPlace?.name ?? ""
                      : locationData?.address || `${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}`
                  }
                  subtitle={
                    locationSource === "search"
                      ? selectedPlace?.address
                      : [locationData?.city, locationData?.state].filter(Boolean).join(", ") || undefined
                  }
                />
              )}
              {locationSource === "search" && (
                <button
                  type="button"
                  onClick={searchAgain}
                  className="text-xs font-medium text-primary hover:underline"
                  data-testid="button-search-different-venue"
                >
                  Search a different venue
                </button>
              )}

              <div className="space-y-2">
                <Label htmlFor="userName">Your name</Label>
                <Input
                  id="userName"
                  type="text"
                  placeholder="How should we credit this pin?"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  required
                  data-testid="input-user-name"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pinNote">{noteLabel}</Label>
                  <span className="text-xs text-muted-foreground">
                    {formData.note.length}/{NOTE_MAX_LENGTH}
                  </span>
                </div>
                {notePrompt && <p className="text-xs text-muted-foreground -mt-1.5">{notePrompt}</p>}
                <Textarea
                  id="pinNote"
                  placeholder={notePrompt || "What makes this place worth pinning?"}
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
                      placeholder="X (Twitter) handle or URL"
                      value={formData.twitterHandle}
                      onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                      className="pl-9"
                      data-testid="input-twitter"
                    />
                  </div>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Instagram handle or URL"
                      value={formData.instagramHandle}
                      onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                      className="pl-9"
                      data-testid="input-instagram"
                    />
                  </div>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="LinkedIn handle or URL"
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
            </>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 shrink-0 border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          {selectedLocation && (
            <Button
              type="submit"
              className="flex-1"
              disabled={createPinMutation.isPending || isLoadingLocation}
              data-testid="button-add-pin"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createPinMutation.isPending ? "Adding..." : "Add pin"}
            </Button>
          )}
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
