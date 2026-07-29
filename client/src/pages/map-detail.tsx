import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArchiveRestore, Users, MapPin, AlertCircle, Crown, Clock, Compass, Loader2, Plus } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapActionsMenu } from "@/components/map-actions-menu";
import { SimpleGoogleMap } from "@/components/simple-google-map";
import { PinTable } from "@/components/pin-table";
import { ShareModal } from "@/components/share-modal";
import { SharePopover } from "@/components/share-popover";
import { LikeButton } from "@/components/like-button";
import { ForkedFromBadge } from "@/components/forked-from-badge";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth-modal";
import { useDirectusAdminUrl } from "@/lib/directusAdmin";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUpgradeableError, upgradeToastAction } from "@/lib/upgradeToast";
import { downloadPinsCsv } from "@/lib/csv-export";
import { countDistinctContributors } from "@/lib/map-utils";
import { cn } from "@/lib/utils";
import type { CuratedCategory, ItemType, PinColor, PinIcon } from "@shared/enums";
import { CURATED_CATEGORY_LABELS } from "@/lib/curated-maps";
import { AddItemModal } from "@/components/add-item-modal";
import { hasCoordinates } from "@shared/geo";

interface MapDetailProps {
  params: {
    shareUrl: string;
  };
}

interface MapCollection {
  id: string;
  name: string;
  description?: string;
  shareUrl: string;
  ownerId?: string;
  /** The map owner's display name — used on the share-image card. Null for an orphaned map. */
  ownerName?: string | null;
  noteLabel?: string | null;
  notePrompt?: string | null;
  brandingLogoUrl?: string | null;
  showOnProfile?: boolean;
  archived?: boolean;
  curated?: boolean;
  curatedCategory?: CuratedCategory | null;
  likeCount: number;
  likedByViewer: boolean;
  /** Non-null iff this map is a clone of another — permanent, never editable. Used to gate the credit banner (see forkedFrom). */
  forkedFromMapId?: string | null;
  /** The live-resolved original for forkedFromMapId. Null both when this map was never cloned AND when it was but the original has since been deleted — use forkedFromMapId, not this, to tell those two apart. */
  forkedFrom?: { name: string; shareUrl: string; ownerName: string | null } | null;
  createdAt: string;
  pinCount: number;
  /** Owner-tier pin cap for this map — Infinity on premium. Used for the proactive "X / Y pins" nudge. */
  maxPins: number;
  defaultPinColor?: PinColor | null;
  defaultPinIcon?: PinIcon | null;
  /** Whether the map owner's current tier includes pin colors/icons — gates showing the picker to anyone adding/editing a pin here. */
  hasPinCustomization?: boolean;
  /** What kind of thing this collection holds — fixed at creation. "location" (a map of pins) is the default and only kind that predates this field. */
  itemType: ItemType;
  pins: Array<{
    id: string;
    title: string;
    contributorName?: string | null;
    userId?: string;
    itemType?: ItemType;
    latitude: string | null;
    longitude: string | null;
    address?: string;
    city?: string;
    town?: string;
    state?: string;
    borough?: string;
    postcode?: string;
    country?: string;
    twitterHandle?: string;
    instagramHandle?: string;
    linkedinHandle?: string;
    note?: string;
    googleMapsUrl?: string | null;
    url?: string | null;
    photoUrl?: string | null;
    venueType?: string | null;
    priceLevel?: number | null;
    website?: string | null;
    editorialSummary?: string | null;
    approved?: boolean;
    pinColor?: PinColor | null;
    pinIcon?: PinIcon | null;
    sequence?: number | null;
    createdAt: string;
  }>;
}

export default function MapDetail({ params }: MapDetailProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ pinId: string; nonce: number } | null>(null);
  // Portal target for PinTable's selected-pins bar, so it renders next to
  // the "Pins" title instead of pushing the pin list down when pins are selected.
  const [pinHeaderSlot, setPinHeaderSlot] = useState<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const directusUrl = useDirectusAdminUrl();
  const queryClient = useQueryClient();

  const { data: mapCollection, isLoading, error } = useQuery<MapCollection>({
    queryKey: [`/api/maps/${params.shareUrl}`],
  });

  // Deep link from search results (?pin=<id>) — focuses that pin once the
  // map's data has loaded. Consumed only once so it doesn't re-fire on every
  // background refetch of mapCollection.
  const consumedPinParamRef = useRef(false);
  useEffect(() => {
    if (consumedPinParamRef.current || !mapCollection) return;
    const pinId = new URLSearchParams(search).get("pin");
    if (pinId) {
      consumedPinParamRef.current = true;
      setFocusRequest({ pinId, nonce: Date.now() });
    }
  }, [mapCollection, search]);

  // Deep link from the home page's pending-approvals banner/badge
  // (?pinFilter=pending) — seeds PinTable's approval filter once on load.
  const initialApprovalFilter = new URLSearchParams(search).get("pinFilter") === "pending" ? "pending" : undefined;

  const restoreMapMutation = useMutation({
    mutationFn: async (mapId: string) => {
      const response = await apiRequest("POST", "/api/maps/unarchive", { mapIds: [mapId] });
      return response.json() as Promise<{ restoredCount: number; skippedDueToLimit: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${params.shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      if (result.restoredCount > 0) {
        toast({ title: "Map restored", description: "It's back on your home page.", variant: "success" });
      } else {
        toast({
          title: "Couldn't restore",
          description: "You've reached your plan's map limit. Upgrade or archive another map first.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Couldn't restore map", description: error.message || "Please try again", variant: "destructive" });
    },
  });

  const cloneMapMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/maps/${params.shareUrl}/clone`);
      return response.json() as Promise<{ shareUrl: string }>;
    },
    onSuccess: (clonedMap) => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      toast({ title: "Map cloned", description: "It's now in your own maps, ready to edit.", variant: "success" });
      setLocation(`/map/${clonedMap.shareUrl}`);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't clone map",
        description: error.message || "Please try again",
        variant: "destructive",
        action: isUpgradeableError(error) ? upgradeToastAction() : undefined,
      });
    },
  });

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="h-96 bg-muted rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error || !mapCollection) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-border">
          <CardContent className="pt-8 pb-8 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Map not found</h2>
            <p className="text-muted-foreground mb-5">
              This map doesn't exist, or the link is no longer valid.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const contributorsCount = countDistinctContributors(mapCollection.pins);
  const isOwner = !!user && user.id === mapCollection.ownerId;
  const pendingCount = mapCollection.pins.filter((pin) => pin.approved === false).length;
  const pinCapReached = Number.isFinite(mapCollection.maxPins) && mapCollection.pinCount >= mapCollection.maxPins;
  const pinCapNear =
    !pinCapReached && Number.isFinite(mapCollection.maxPins) && mapCollection.pinCount / mapCollection.maxPins >= 0.8;

  const exportPins = () => {
    if (mapCollection.pins.length === 0) {
      toast({
        title: "Nothing to export",
        description: "This map doesn't have any pins yet.",
        variant: "destructive",
      });
      return;
    }

    downloadPinsCsv(mapCollection.pins, mapCollection.noteLabel || "Note");

    toast({
      title: "CSV exported",
      description: `${mapCollection.pins.length} pin${mapCollection.pins.length === 1 ? "" : "s"} exported.`,
      variant: "success",
    });
  };

  return (
    <>
      {/* Sub-header: navigation lives here, apart from the page's own actions below */}
      <div className="sticky top-16 z-30 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-3">
          <button
            onClick={() => setLocation("/")}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 hover:bg-accent transition-colors"
            aria-label="Back to home"
            data-testid="button-back-to-home"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                isOwner && pinCapReached && "text-destructive font-medium",
                isOwner && pinCapNear && "text-amber-600 font-medium",
              )}
            >
              <MapPin className="h-4 w-4" />
              {mapCollection.pinCount}
              {Number.isFinite(mapCollection.maxPins) && ` / ${mapCollection.maxPins}`}{" "}
              {!Number.isFinite(mapCollection.maxPins) && mapCollection.pinCount === 1 ? "pin" : "pins"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {contributorsCount} {contributorsCount === 1 ? "contributor" : "contributors"}
            </span>
            {isOwner && (pinCapReached || pinCapNear) && (
              <Link href="/pricing" className="font-medium text-primary hover:underline" data-testid="link-pin-cap-upgrade">
                {pinCapReached ? "Pin limit reached — upgrade →" : "Approaching pin limit — upgrade →"}
              </Link>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 animate-fade-in">
        {/* Anonymous User Notice */}
        {!user && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>
              Viewing as a guest — pins save anonymously.{" "}
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="font-medium underline hover:no-underline"
              >
                Sign in
              </button>{" "}
              to pin with your profile.
            </span>
          </div>
        )}

        {/* Map Header */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground break-words">{mapCollection.name}</h1>
                  {!!mapCollection.forkedFromMapId && <ForkedFromBadge forkedFrom={mapCollection.forkedFrom ?? null} />}
                  {isOwner && (
                    <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary">
                      <Crown className="h-3 w-3" />
                      Owner
                    </Badge>
                  )}
                  {mapCollection.curated && (
                    <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary" data-testid="badge-curated">
                      <Compass className="h-3 w-3" />
                      Curated{mapCollection.curatedCategory ? ` · ${CURATED_CATEGORY_LABELS[mapCollection.curatedCategory]}` : ""}
                    </Badge>
                  )}
                  {mapCollection.archived && (
                    <Badge variant="outline" className="gap-1 border-muted-foreground/30 bg-muted text-muted-foreground">
                      Archived
                    </Badge>
                  )}
                </div>
                {mapCollection.description && (
                  <p className="text-muted-foreground">{mapCollection.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                {isOwner && mapCollection.archived && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => restoreMapMutation.mutate(mapCollection.id)}
                    disabled={restoreMapMutation.isPending}
                    data-testid="button-restore-map"
                  >
                    {restoreMapMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                    )}
                    Restore
                  </Button>
                )}
                <div className="inline-flex items-stretch rounded-md border border-border divide-x divide-border overflow-hidden">
                  <LikeButton
                    mapId={mapCollection.id}
                    liked={mapCollection.likedByViewer}
                    likeCount={mapCollection.likeCount}
                    invalidateKeys={[`/api/maps/${params.shareUrl}`]}
                    className="h-9 px-3 hover:bg-accent"
                  />
                  <SharePopover
                    mapId={mapCollection.id}
                    shareUrl={mapCollection.shareUrl}
                    mapName={mapCollection.name}
                    ownerName={mapCollection.ownerName}
                    pinCount={mapCollection.pinCount}
                    isOwner={isOwner}
                    onInvite={() => setIsShareModalOpen(true)}
                    triggerClassName="h-9 rounded-none"
                  />
                  <MapActionsMenu
                    mapId={mapCollection.id}
                    isOwner={isOwner}
                    onEditMap={() => setLocation(`/map/${mapCollection.shareUrl}/edit`)}
                    onImportPins={() => setLocation(`/map/${mapCollection.shareUrl}/import`)}
                    onExportCsv={exportPins}
                    onClone={user ? () => cloneMapMutation.mutate() : undefined}
                    directusUrl={directusUrl}
                    triggerClassName="h-9 w-9 rounded-none border-0"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map View — only "location" collections have one; "link"/"recommendation" collections skip straight to the card list below. Every pin on a "location" collection has coordinates in practice; hasCoordinates just lets TS see that. */}
        {mapCollection.itemType === "location" && (
          <SimpleGoogleMap
            mapCollection={{ ...mapCollection, pins: mapCollection.pins.filter(hasCoordinates) }}
            focusRequest={focusRequest}
          />
        )}

        {/* Pins/items management */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
                {mapCollection.itemType === "location" ? "Pins" : "Items"}{" "}
                <span className="text-muted-foreground font-normal">({mapCollection.pinCount})</span>
                {isOwner && pendingCount > 0 && (
                  <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 font-normal text-xs">
                    <Clock className="h-3 w-3" />
                    {pendingCount} pending review
                  </Badge>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {mapCollection.itemType !== "location" && (
                  <Button size="sm" onClick={() => setIsAddItemModalOpen(true)} data-testid="button-add-item">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add {mapCollection.itemType === "link" ? "link" : "recommendation"}
                  </Button>
                )}
                <div ref={setPinHeaderSlot} className="flex items-center" />
              </div>
            </div>
            <PinTable
              pins={mapCollection.pins}
              mapOwnerId={mapCollection.ownerId}
              shareUrl={mapCollection.shareUrl}
              noteLabel={mapCollection.noteLabel}
              itemType={mapCollection.itemType}
              onPinSelect={mapCollection.itemType === "location" ? (pinId) => setFocusRequest({ pinId, nonce: Date.now() }) : undefined}
              headerActionsSlot={pinHeaderSlot}
              initialApprovalFilter={initialApprovalFilter}
            />
          </CardContent>
        </Card>

        {/* Invite dialog — copy-link/social sharing lives in the SharePopover above, so this opens straight to the invite section. */}
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          shareUrl={mapCollection.shareUrl}
          mapName={mapCollection.name}
          mapId={mapCollection.id}
          isOwner={isOwner}
          showLinkAndSocial={false}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          returnUrl={`/map/${params.shareUrl}`}
        />

        {mapCollection.itemType !== "location" && (
          <AddItemModal
            isOpen={isAddItemModalOpen}
            onClose={() => setIsAddItemModalOpen(false)}
            mapCollection={{
              shareUrl: mapCollection.shareUrl,
              noteLabel: mapCollection.noteLabel,
              notePrompt: mapCollection.notePrompt,
              itemType: mapCollection.itemType,
            }}
          />
        )}
      </main>
    </>
  );
}
