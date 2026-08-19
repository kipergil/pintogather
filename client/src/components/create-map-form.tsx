import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { isUpgradeableError, upgradeToastAction } from "@/lib/upgradeToast";
import { useAuth } from "@/contexts/AuthContext";
import { Compass, Copy, ExternalLink, ImageIcon, Loader2, Lock, MapPinned, MessageSquareText, Plus, Save, Upload, Users } from "lucide-react";
import { Link } from "wouter";
import { TIER_LIMITS } from "@shared/limits";
import { DISCOVER_STATUS_LABELS } from "@shared/enums";
import type { ItemType, PinColor, PinIcon } from "@shared/enums";
import { PinStylePicker } from "@/components/pin-style-picker";
import { OptionalSection } from "@/components/optional-section";
import { DiscoverListingFields, type DiscoverListingValue } from "@/components/discover-listing-fields";
import { APP_NAME } from "@/lib/branding";

const LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5MB, matches the server-side limit
const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

interface MapDetailsFormData {
  name: string;
  description: string;
  noteLabel: string;
  notePrompt: string;
  brandingLogoUrl: string;
  showOnProfile: boolean;
  requirePinApproval: boolean;
  defaultPinColor: PinColor | null;
  defaultPinIcon: PinIcon | null;
  /** How this collection is filed on the public Discover page, and whether its owner has asked to be listed there. */
  discover: DiscoverListingValue;
}

interface CreateMapFormProps {
  onCreated?: () => void;
  /** When set, the form edits this existing map instead of creating a new one. */
  mapId?: string;
  /** shareUrl is only used to show the public branded-page link in edit mode — it's never submitted. */
  initialValues?: Partial<MapDetailsFormData> & { shareUrl?: string; itemType?: ItemType };
  /** Chosen on the item-type-picker step just before this form; undefined when editing (itemType is fixed after creation, never re-chosen). */
  itemType?: ItemType;
}

/** Example names, so the field suggests what a collection of this kind is for. */
const NAME_PLACEHOLDER: Record<ItemType, string> = {
  location: "e.g. Our favourite coffee spots",
  link: "e.g. Worth reading this month",
  recommendation: "e.g. What to watch next",
};

/** Example note prompts — what the owner might ask contributors for. */
const NOTE_PROMPT_PLACEHOLDER: Record<ItemType, string> = {
  location: "What makes this place worth a visit?",
  link: "Why is this worth reading?",
  recommendation: "Why do you recommend it?",
};

export function CreateMapForm({ onCreated, mapId, initialValues, itemType }: CreateMapFormProps) {
  // Editing never re-chooses the type, so fall back to the collection's own
  // value there and to the only type that has a template step when creating.
  const kind: ItemType = itemType ?? initialValues?.itemType ?? "location";
  const namePlaceholder = NAME_PLACEHOLDER[kind];
  const notePlaceholder = NOTE_PROMPT_PLACEHOLDER[kind];
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEditing = !!mapId;

  const [formData, setFormData] = useState<MapDetailsFormData>({
    name: initialValues?.name ?? "",
    description: initialValues?.description ?? "",
    noteLabel: initialValues?.noteLabel ?? "",
    notePrompt: initialValues?.notePrompt ?? "",
    brandingLogoUrl: initialValues?.brandingLogoUrl ?? "",
    showOnProfile: initialValues?.showOnProfile ?? false,
    requirePinApproval: initialValues?.requirePinApproval ?? true,
    defaultPinColor: initialValues?.defaultPinColor ?? null,
    defaultPinIcon: initialValues?.defaultPinIcon ?? null,
    discover: initialValues?.discover ?? {
      curatedCategory: null,
      curatedCountry: null,
      curatedCity: null,
      discoverStatus: "none",
    },
  });
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const publicUrl = initialValues?.shareUrl ? `${window.location.origin}/p/${initialValues.shareUrl}` : null;
  const hasCustomBranding = TIER_LIMITS[user?.userGroup ?? "freemium"].customBranding;
  const hasPinCustomization = TIER_LIMITS[user?.userGroup ?? "freemium"].pinCustomization;

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > LOGO_MAX_BYTES) {
      toast({
        title: "File too large",
        description: "Please choose an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const response = await apiUpload("/api/uploads/logo", file);
      const { url } = await response.json();
      setFormData((prev) => ({ ...prev, brandingLogoUrl: url }));
      toast({ title: "Logo uploaded", variant: "success" });
    } catch (error: any) {
      toast({
        title: "Couldn't upload logo",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const copyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link copied", description: "Anyone with this link can view it", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy link", description: "Please copy it manually", variant: "destructive" });
    }
  };

  const createMapMutation = useMutation({
    mutationFn: async (data: MapDetailsFormData) => {
      const mapData = {
        name: data.name,
        description: data.description,
        noteLabel: data.noteLabel.trim() || null,
        notePrompt: data.notePrompt.trim() || null,
        brandingLogoUrl: data.brandingLogoUrl.trim() || null,
        requirePinApproval: data.requirePinApproval,
        defaultPinColor: data.defaultPinColor,
        defaultPinIcon: data.defaultPinIcon,
        ownerId: user?.id || null,
        itemType,
      };
      const response = await apiRequest("POST", "/api/maps", mapData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Collection created",
        description: `"${data.name}" is ready — start adding.`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maps", user?.id] });
      onCreated?.();
      // Straight into the add hub rather than an empty map — filling the
      // collection is the actual next step, and it's where the bulk/AI
      // importers live.
      setLocation(`/map/${data.shareUrl}/add?new=1`);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't create it",
        description: error.message || "Please try again",
        variant: "destructive",
        action: isUpgradeableError(error) ? upgradeToastAction() : undefined,
      });
    },
  });

  const updateMapMutation = useMutation({
    mutationFn: async (data: MapDetailsFormData) => {
      const mapData = {
        name: data.name,
        description: data.description,
        noteLabel: data.noteLabel.trim() || null,
        notePrompt: data.notePrompt.trim() || null,
        brandingLogoUrl: data.brandingLogoUrl.trim() || null,
        showOnProfile: data.showOnProfile,
        requirePinApproval: data.requirePinApproval,
        defaultPinColor: data.defaultPinColor,
        defaultPinIcon: data.defaultPinIcon,
        curatedCategory: data.discover.curatedCategory,
        curatedCountry: data.discover.curatedCountry,
        curatedCity: data.discover.curatedCity,
        // Only ever "none" or "pending" from here — the server rejects an
        // owner trying to write the admin's own verdict. An untouched
        // "approved"/"rejected" is left out of the payload entirely: sending
        // "none" for it would read as a withdrawal and quietly take a live
        // collection off Discover on an unrelated save.
        ...(data.discover.discoverStatus === "pending"
          ? { discoverStatus: "pending" as const }
          : data.discover.discoverStatus === "none"
            ? { discoverStatus: "none" as const }
            : {}),
      };
      const response = await apiRequest("PUT", `/api/maps/${mapId}/details`, mapData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Collection updated",
        description: "Your changes have been saved.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${data.shareUrl}`] });
      onCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save changes",
        description: error.message || "Please try again",
        variant: "destructive",
        action: isUpgradeableError(error) ? upgradeToastAction() : undefined,
      });
    },
  });

  const mutation = isEditing ? updateMapMutation : createMapMutation;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Name required",
        description: "Give your collection a name to continue",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mapName">Collection name *</Label>
        <Input
          id="mapName"
          type="text"
          placeholder={namePlaceholder}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          data-testid="input-map-name"
        />
        <p className="text-xs text-muted-foreground">
          {isEditing || (itemType ?? "location") === "location"
            ? "You'll invite people to pin their location or favourite spots here."
            : itemType === "link"
              ? "You'll invite people to add links here — paste a URL and it fills itself in."
              : "You'll invite people to add recs here — books, films, tools, anything worth passing on."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mapDescription">Description (optional)</Label>
        <Textarea
          id="mapDescription"
          placeholder="What's this collection for?"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          data-testid="input-map-description"
        />
      </div>

      <OptionalSection
        title="Who can add and see it"
        icon={<Users className="h-3.5 w-3.5" />}
        hint="Sensible defaults are already set: contributions wait for your approval, and the collection stays off your public profile until you say otherwise."
        testId="button-toggle-visibility"
      >
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="requirePinApproval">Require approval for new items</Label>
            <p className="text-xs text-muted-foreground">
              Pins from anyone but you stay hidden until you approve them. Turn this off to have them go live right away.
            </p>
          </div>
          <Switch
            id="requirePinApproval"
            checked={formData.requirePinApproval}
            onCheckedChange={(checked) => setFormData({ ...formData, requirePinApproval: checked })}
            data-testid="switch-require-pin-approval"
          />
        </div>

        {isEditing && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3.5">
            <div className="space-y-0.5">
              <Label htmlFor="showOnProfile">Show on public profile</Label>
              <p className="text-xs text-muted-foreground">
                List this collection on your public profile page. Hidden ones stay private to you.
              </p>
            </div>
            <Switch
              id="showOnProfile"
              checked={formData.showOnProfile}
              onCheckedChange={(checked) => setFormData({ ...formData, showOnProfile: checked })}
              data-testid="switch-show-on-profile"
            />
          </div>
        )}
      </OptionalSection>

      <OptionalSection
        title="Customise the note question"
        icon={<MessageSquareText className="h-3.5 w-3.5" />}
        hint={`Ask contributors something specific instead of a generic "Note" — e.g. "Favourite dish" with the prompt "What should people order here?"`}
        defaultOpen={!!(initialValues?.noteLabel || initialValues?.notePrompt)}
        testId="button-toggle-note-customization"
      >
          <div className="space-y-2">
            <Label htmlFor="noteLabel">Note field label</Label>
            <Input
              id="noteLabel"
              type="text"
              placeholder="Note"
              value={formData.noteLabel}
              onChange={(e) => setFormData({ ...formData, noteLabel: e.target.value })}
              maxLength={60}
              data-testid="input-note-label"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notePrompt">Note prompt</Label>
            <Textarea
              id="notePrompt"
              placeholder={notePlaceholder}
              value={formData.notePrompt}
              onChange={(e) => setFormData({ ...formData, notePrompt: e.target.value })}
              rows={2}
              data-testid="input-note-prompt"
            />
          </div>
      </OptionalSection>

      <OptionalSection
        title="Public branding"
        icon={<ImageIcon className="h-3.5 w-3.5" />}
        hint={`Add your own logo and this collection gets a clean, read-only public page with no ${APP_NAME} branding — just your logo, the description above, and the collection itself.`}
        defaultOpen={!!initialValues?.brandingLogoUrl}
        testId="button-toggle-branding"
      >
          {hasCustomBranding ? (
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept={LOGO_ACCEPT}
                  className="hidden"
                  onChange={handleLogoFileChange}
                  data-testid="input-logo-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoFileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  data-testid="button-upload-logo"
                >
                  {isUploadingLogo ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 mr-2" />
                      Upload image
                    </>
                  )}
                </Button>
                {formData.brandingLogoUrl.trim() && (
                  <img
                    src={formData.brandingLogoUrl.trim()}
                    alt="Logo preview"
                    className="h-10 max-w-[160px] object-contain rounded border border-border p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                    onLoad={(e) => {
                      (e.target as HTMLImageElement).style.display = "block";
                    }}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or paste an image URL</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Input
                id="brandingLogoUrl"
                type="text"
                placeholder="https://yoursite.com/logo.png"
                value={formData.brandingLogoUrl}
                onChange={(e) => setFormData({ ...formData, brandingLogoUrl: e.target.value })}
                maxLength={500}
                data-testid="input-branding-logo-url"
              />
            </div>
          ) : (
            <div
              className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground"
              data-testid="branding-locked-notice"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">Custom branding is a Premium feature.</span>
              <Link href="/pricing" className="font-medium text-primary hover:underline shrink-0">
                Upgrade
              </Link>
            </div>
          )}

          {publicUrl && (
            <div className="space-y-1.5">
              <Label>Public page link</Label>
              <div className="flex gap-2">
                <Input value={publicUrl} readOnly className="bg-muted/40 text-xs" data-testid="input-public-url" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={copyPublicUrl}
                  data-testid="button-copy-public-url"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="shrink-0" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" data-testid="link-preview-public-url">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link instead of the regular one to hide {APP_NAME} branding entirely.
              </p>
            </div>
          )}
      </OptionalSection>

      {isEditing && (
        <OptionalSection
          title="Feature it on Discover"
          icon={<Compass className="h-3.5 w-3.5" />}
          hint="Tell people what this collection covers, and ask us to feature it on the public Discover page. Filling these in doesn't publish anything on its own."
          defaultOpen={formData.discover.discoverStatus !== "none"}
          badge={
            formData.discover.discoverStatus !== "none" ? (
              <span className="text-xs font-normal text-primary shrink-0" data-testid="badge-discover-status">
                {DISCOVER_STATUS_LABELS[formData.discover.discoverStatus]}
              </span>
            ) : undefined
          }
          testId="button-toggle-discover"
        >
          <DiscoverListingFields
            value={formData.discover}
            onChange={(discover) => setFormData({ ...formData, discover })}
          />
        </OptionalSection>
      )}

      {(itemType ?? "location") === "location" && (
      <OptionalSection
        title="Default pin colour & icon"
        icon={<MapPinned className="h-3.5 w-3.5" />}
        hint="Set the default look for pins in this collection. Contributors can still override it per pin."
        defaultOpen={!!(initialValues?.defaultPinColor || initialValues?.defaultPinIcon)}
        testId="button-toggle-pin-style"
      >
          {hasPinCustomization ? (
            <PinStylePicker
              color={formData.defaultPinColor}
              icon={formData.defaultPinIcon}
              onChange={({ color, icon }) => setFormData({ ...formData, defaultPinColor: color, defaultPinIcon: icon })}
              noneLabel="Plain (app default)"
            />
          ) : (
            <div
              className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground"
              data-testid="pin-style-locked-notice"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">Custom pin colours & icons are a Basic/Premium feature.</span>
              <Link href="/pricing" className="font-medium text-primary hover:underline shrink-0">
                Upgrade
              </Link>
            </div>
          )}
      </OptionalSection>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-map-form">
        {isEditing ? (
          <>
            <Save className="h-4 w-4 mr-2" />
            {mutation.isPending ? "Saving…" : "Save changes"}
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            {mutation.isPending ? "Creating…" : "Create collection"}
          </>
        )}
      </Button>
    </form>
  );
}
