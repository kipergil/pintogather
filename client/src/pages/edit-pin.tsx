import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, AtSign, ExternalLink, ImageIcon, Link2, MapPin, MapPinned, Save, Loader2, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { PinStylePicker } from "@/components/pin-style-picker";
import { OptionalSection } from "@/components/optional-section";
import { VenueDetailsFields } from "@/components/venue-details-fields";
import { SocialLinksFields } from "@/components/social-links-fields";
import type { PinColor, PinIcon, VenueType } from "@shared/enums";
import type { VenueDetails } from "@/components/venue-details-fields";
import { ITEM_NOUN } from "@shared/vocabulary";

const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5MB, matches the server-side limit
const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

interface EditPinProps {
  params: {
    shareUrl: string;
    pinId: string;
  };
}

interface PinFormFields {
  title: string;
  url: string;
  twitterHandle: string;
  instagramHandle: string;
  linkedinHandle: string;
  note: string;
  photoUrl: string | null;
  pinColor: PinColor | null;
  pinIcon: PinIcon | null;
}

/** The pin's own fields, plus the venue facts VenueDetailsFields manages. */
type PinFormData = PinFormFields & VenueDetails;

interface PinRecord {
  id: string;
  userId: string | null;
  title: string;
  itemType?: "location" | "link" | "recommendation";
  address?: string;
  url?: string | null;
  twitterHandle?: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  note?: string;
  googleMapsUrl?: string | null;
  /** The venue's own site, from Google Places — the source for social suggestions. */
  website?: string | null;
  venueType?: VenueType | null;
  priceLevel?: number | null;
  editorialSummary?: string | null;
  city?: string | null;
  state?: string | null;
  town?: string | null;
  borough?: string | null;
  postcode?: string | null;
  country?: string | null;
  photoUrl?: string | null;
  pinColor?: PinColor | null;
  pinIcon?: PinIcon | null;
}

interface MapCollectionSettings {
  noteLabel?: string | null;
  notePrompt?: string | null;
  hasPinCustomization?: boolean;
}

/**
 * One labelled group of fields. The edit form used to be a single column of
 * eight unrelated inputs; grouping them means you can find the one you came
 * for without reading all of them.
 */
function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function EditPin({ params }: EditPinProps) {
  const { shareUrl, pinId } = params;
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<PinFormData>({
    title: "",
    url: "",
    twitterHandle: "",
    instagramHandle: "",
    linkedinHandle: "",
    note: "",
    photoUrl: null,
    pinColor: null,
    pinIcon: null,
    website: "",
    venueType: null,
    priceLevel: null,
    editorialSummary: "",
    city: "",
    state: "",
    town: "",
    borough: "",
    postcode: "",
    country: "",
  });

  // Fetch pin data
  const { data: pin, isLoading: pinLoading, error: pinError } = useQuery<PinRecord>({
    queryKey: [`/api/pins/${pinId}`],
  });

  // Fetch the map's custom note label/prompt, if configured
  const { data: mapCollection } = useQuery<MapCollectionSettings>({
    queryKey: [`/api/maps/${shareUrl}`],
  });
  const noteLabel = mapCollection?.noteLabel || "Note";
  const notePrompt = mapCollection?.notePrompt || null;
  const hasPinCustomization = mapCollection?.hasPinCustomization ?? false;
  // This page edits any item type, so its headings follow the collection's
  // own noun rather than always saying "pin".
  const noun = ITEM_NOUN[pin?.itemType ?? "location"];
  const Noun = noun.one.charAt(0).toUpperCase() + noun.one.slice(1);
  // Venue and address details only mean anything for a place; a link or a
  // recommendation has no opening hours or postcode to correct.
  const isLocation = (pin?.itemType ?? "location") === "location";

  // Populate form when pin data loads, falling back to the signed-in user's
  // own profile for empty fields
  useEffect(() => {
    if (pin) {
      // Check if user owns this pin
      if (user && pin.userId !== user.id) {
        toast({
          title: "That's not yours to edit",
          description: "You can only edit what you added yourself.",
          variant: "destructive",
        });
        setLocation(`/map/${shareUrl}`);
        return;
      }

      setFormData({
        title: pin.title || "",
        url: pin.url || "",
        // Only what's on the pin. Inheriting the contributor's own handles
        // put a personal Instagram on a restaurant's pin without saying so;
        // SocialLinksFields offers them behind a button instead.
        twitterHandle: pin.twitterHandle || "",
        instagramHandle: pin.instagramHandle || "",
        linkedinHandle: pin.linkedinHandle || "",
        note: pin.note || "",
        photoUrl: pin.photoUrl ?? null,
        pinColor: pin.pinColor ?? null,
        pinIcon: pin.pinIcon ?? null,
        website: pin.website || "",
        venueType: pin.venueType ?? null,
        priceLevel: pin.priceLevel ?? null,
        editorialSummary: pin.editorialSummary || "",
        city: pin.city || "",
        state: pin.state || "",
        town: pin.town || "",
        borough: pin.borough || "",
        postcode: pin.postcode || "",
        country: pin.country || "",
      });
    }
  }, [pin, user, shareUrl, setLocation, toast]);

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > PHOTO_MAX_BYTES) {
      toast({
        title: "File too large",
        description: "Please choose an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const response = await apiUpload("/api/uploads/pin-photo", file);
      const { url } = await response.json();
      setFormData((prev) => ({ ...prev, photoUrl: url }));
    } catch (error: any) {
      toast({
        title: "Couldn't upload photo",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const updatePinMutation = useMutation({
    mutationFn: async (data: PinFormData) => {
      // Blanking a field has to reach the server as null, not "" — these are
      // nullable columns, and an empty string would read as a real (empty)
      // value on the pin rather than "not known".
      const orNull = (value: string) => value.trim() || null;
      const payload = {
        title: data.title,
        url: data.url,
        twitterHandle: data.twitterHandle,
        instagramHandle: data.instagramHandle,
        linkedinHandle: data.linkedinHandle,
        note: data.note,
        photoUrl: data.photoUrl,
        pinColor: data.pinColor,
        pinIcon: data.pinIcon,
        website: orNull(data.website),
        venueType: data.venueType,
        priceLevel: data.priceLevel,
        editorialSummary: orNull(data.editorialSummary),
        city: orNull(data.city),
        state: orNull(data.state),
        town: orNull(data.town),
        borough: orNull(data.borough),
        postcode: orNull(data.postcode),
        country: orNull(data.country),
      };
      const response = await apiRequest("PUT", `/api/pins/${pinId}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/pins/${pinId}`] });
      toast({
        title: `${Noun} updated`,
        variant: "success",
      });
      setLocation(`/map/${shareUrl}`);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save it",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      updatePinMutation.mutate(formData);
    } catch (error: any) {
      toast({
        title: "Couldn't save it",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (pinLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-7 w-7 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-lg font-semibold">Loading…</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pinError || !pin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8 text-center">
            <h2 className="text-lg font-semibold mb-2">Not found</h2>
            <p className="text-muted-foreground mb-5 text-sm">
              This pin doesn't exist or you don't have permission to edit it.
            </p>
            <Link href={`/map/${shareUrl}`}>
              <Button className="w-full">Back to collection</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto p-4 py-10">
        <Link href={`/map/${shareUrl}`}>
          <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to collection
          </Button>
        </Link>

        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit {noun.one}</h1>
          </div>
          {pin.address && <p className="text-sm text-muted-foreground ml-11">{pin.address}</p>}
          {pin.googleMapsUrl && (
            <a
              href={pin.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline ml-11 mt-1"
              data-testid="link-google-maps"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on Google Maps
            </a>
          )}
        </div>

        <Card className="border-border">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-7">
              <FormSection title="Basic details">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Venue name, or whatever this is about"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  data-testid="input-title"
                />
              </div>

              {pin.itemType && pin.itemType !== "location" && (
                <div className="space-y-2">
                  <Label htmlFor="itemUrl">{pin.itemType === "link" ? "URL" : "Link (optional)"}</Label>
                  <Input
                    id="itemUrl"
                    type="url"
                    placeholder="https://..."
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required={pin.itemType === "link"}
                    data-testid="input-item-url"
                  />
                </div>
              )}
              </FormSection>

              <FormSection
                title="Additional info"
                hint="Everything here is optional — add what's useful for this one."
              >
              <SocialLinksFields
                value={{
                  twitterHandle: formData.twitterHandle,
                  instagramHandle: formData.instagramHandle,
                  linkedinHandle: formData.linkedinHandle,
                }}
                onChange={(socials) => setFormData({ ...formData, ...socials })}
                website={pin.website}
              />

              <div className="space-y-2">
                <Label htmlFor="note">{noteLabel}</Label>
                {notePrompt && <p className="text-xs text-muted-foreground -mt-1">{notePrompt}</p>}
                <Textarea
                  id="note"
                  placeholder={notePrompt || "Add a note about this location…"}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={3}
                  data-testid="input-note"
                />
              </div>

              <div className="space-y-2">
                <Label>Photo</Label>
                {formData.photoUrl ? (
                  <div className="relative w-fit">
                    <img
                      src={formData.photoUrl}
                      alt="Preview"
                      className="h-24 w-24 rounded-lg object-cover border border-border"
                      data-testid="img-pin-photo-preview"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, photoUrl: null })}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center shadow"
                      aria-label="Remove photo"
                      data-testid="button-remove-photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={photoFileInputRef}
                      type="file"
                      accept={PHOTO_ACCEPT}
                      onChange={handlePhotoFileChange}
                      className="hidden"
                      data-testid="input-photo-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => photoFileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      data-testid="button-upload-photo"
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {isUploadingPhoto ? "Uploading…" : "Add a photo"}
                    </Button>
                  </>
                )}
              </div>

              </FormSection>

              {isLocation && (
                <FormSection
                  title="Venue details"
                  hint="Filled in from Google when this was added. Correct anything that's wrong or missing."
                >
                  <VenueDetailsFields
                    value={formData}
                    onChange={(details) => setFormData({ ...formData, ...details })}
                    noteLabel={noteLabel}
                  />
                </FormSection>
              )}

              {hasPinCustomization && (
                <FormSection title="Appearance" hint="How this pin looks on the map.">
                <OptionalSection
                  title="Pin color & icon"
                  icon={<MapPinned className="h-3.5 w-3.5" />}
                  hint="Leave this as the default to use the collection's usual pin style."
                  defaultOpen={!!(pin.pinColor || pin.pinIcon)}
                  testId="button-toggle-pin-style"
                >
                  <PinStylePicker
                    color={formData.pinColor}
                    icon={formData.pinIcon}
                    onChange={({ color, icon }) => setFormData({ ...formData, pinColor: color, pinIcon: icon })}
                    noneLabel="Collection default"
                  />
                </OptionalSection>
                </FormSection>
              )}

              <div className="flex gap-3 pt-1 border-t border-border">
                <Link href={`/map/${shareUrl}`} className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || updatePinMutation.isPending || isUploadingPhoto || !formData.title.trim()}
                  data-testid="button-update-pin"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading || updatePinMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}