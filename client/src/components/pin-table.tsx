import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  MapPin,
  Trash2,
  Twitter,
  Instagram,
  Linkedin,
  Globe,
  Edit,
  ExternalLink,
  MoreVertical,
  Database,
  Check,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { useDirectusAdminUrl, buildDirectusAdminUrl } from "@/lib/directusAdmin";
import { buildSocialUrl } from "@/lib/social-links";
import { PinStyleSwatch } from "@/components/pin-style-picker";
import { formatVenueType, formatPriceLevel } from "@/lib/venue-type";
import type { PinColor, PinIcon } from "@shared/enums";

interface Pin {
  id: string;
  title: string;
  contributorName?: string | null;
  userId?: string;
  latitude: string;
  longitude: string;
  address?: string;
  city?: string;
  state?: string;
  town?: string;
  borough?: string;
  postcode?: string;
  country?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  note?: string;
  googleMapsUrl?: string | null;
  photoUrl?: string | null;
  venueType?: string | null;
  priceLevel?: number | null;
  website?: string | null;
  editorialSummary?: string | null;
  approved?: boolean;
  pinColor?: PinColor | null;
  pinIcon?: PinIcon | null;
  createdAt: string;
}

type ContributorFilter = "all" | "mine" | "others";
type ApprovalFilter = "all" | "pending" | "approved";

interface PinTableProps {
  pins: Pin[];
  mapOwnerId?: string;
  shareUrl?: string;
  /** Custom label for the note field configured on this map, e.g. "Favourite dish". Falls back to "Note". */
  noteLabel?: string | null;
  /** Public/embedded views: no edit/delete actions, regardless of who's viewing. */
  readOnly?: boolean;
  /** Called when a row is clicked, so the map can pan/zoom to that pin. */
  onPinSelect?: (pinId: string) => void;
  /** When set, the selected-pins bar (count + Clear/Delete) renders here instead of inline above the pin list — lets the parent place it next to the "Pins" title instead of pushing the list down. */
  headerActionsSlot?: HTMLElement | null;
  /** Seeds the approval-status filter on mount, e.g. from a `?pinFilter=pending` deep link. Owner-only filter, ignored otherwise. */
  initialApprovalFilter?: ApprovalFilter;
}

function SocialLinks({ pin }: { pin: Pin }) {
  if (!pin.website && !pin.twitterHandle && !pin.instagramHandle && !pin.linkedinHandle) {
    return null;
  }
  return (
    <div className="flex items-center gap-2.5">
      {pin.website && (
        <a
          href={pin.website}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Website"
          data-testid={`link-website-${pin.id}`}
        >
          <Globe className="h-4 w-4" />
        </a>
      )}
      {pin.twitterHandle && (
        <a
          href={buildSocialUrl("twitter", pin.twitterHandle)!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Twitter className="h-4 w-4" />
        </a>
      )}
      {pin.instagramHandle && (
        <a
          href={buildSocialUrl("instagram", pin.instagramHandle)!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Instagram className="h-4 w-4" />
        </a>
      )}
      {pin.linkedinHandle && (
        <a
          href={buildSocialUrl("linkedin", pin.linkedinHandle)!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Linkedin className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

function NoteContent({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-lg bg-muted/50 border border-border p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{note}</p>
    </div>
  );
}

export function PinTable({
  pins,
  mapOwnerId,
  shareUrl,
  noteLabel,
  readOnly = false,
  onPinSelect,
  headerActionsSlot,
  initialApprovalFilter,
}: PinTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [contributorFilter, setContributorFilter] = useState<ContributorFilter>("all");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>(initialApprovalFilter ?? "all");
  const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const directusUrl = useDirectusAdminUrl();

  const resolvedNoteLabel = noteLabel || "Note";
  const isOwner = !readOnly && !!user && user.id === mapOwnerId;

  const canDeletePin = (pin: Pin) => {
    if (readOnly || !user) return false;
    return user.id === mapOwnerId || user.id === pin.userId;
  };

  const canEditPin = (pin: Pin) => {
    if (readOnly || !user) return false;
    return user.id === pin.userId;
  };

  const canApprovePin = (pin: Pin) => isOwner && pin.approved === false;

  const handleEditPin = (pin: Pin) => {
    if (shareUrl) {
      setLocation(`/map/${shareUrl}/edit-pin/${pin.id}`);
    }
  };

  const deletePinMutation = useMutation({
    mutationFn: async (pinId: string) => {
      await apiRequest("DELETE", `/api/pins/${pinId}`);
    },
    onSuccess: () => {
      toast({
        title: "Pin deleted",
        description: "The pin has been removed from this map.",
        variant: "success",
      });
      if (shareUrl) {
        queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete pin",
        variant: "destructive",
      });
    },
  });

  const handleDeletePin = (pin: Pin) => {
    const message = pin.approved === false
      ? "Discard this pending pin? It will be permanently removed."
      : "Are you sure you want to delete this pin?";
    if (window.confirm(message)) {
      deletePinMutation.mutate(pin.id);
    }
  };

  const bulkDeletePinsMutation = useMutation({
    mutationFn: async (pinIds: string[]) => {
      const response = await apiRequest("POST", "/api/pins/bulk-delete", { pinIds });
      return response.json() as Promise<{ deletedCount: number; skippedCount: number }>;
    },
    onSuccess: (result) => {
      setSelectedPinIds(new Set());
      toast({
        title: result.deletedCount === 1 ? "Pin deleted" : `${result.deletedCount} pins deleted`,
        description:
          result.skippedCount > 0
            ? `${result.skippedCount} pin${result.skippedCount === 1 ? "" : "s"} couldn't be removed — you don't have permission.`
            : "The selected pins have been removed from this map.",
        variant: result.deletedCount > 0 ? "success" : "destructive",
      });
      if (shareUrl) {
        queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete pins",
        variant: "destructive",
      });
    },
  });

  // Patches approved pins directly into this map's cached query data. A
  // plain invalidateQueries() here doesn't reliably trigger a visible
  // refetch of the currently-mounted map-detail query (observed empirically:
  // the invalidated query's refetch never resolves when called from inside
  // a mutation's onSuccess), so we update the cache with the known-correct
  // result instead of waiting on a refetch that may never land.
  const markPinsApproved = (approvedShareUrl: string | undefined, approvedPinIds: string[]) => {
    if (!approvedShareUrl) return;
    const idSet = new Set(approvedPinIds);
    queryClient.setQueryData([`/api/maps/${approvedShareUrl}`], (old: unknown) => {
      if (!old || typeof old !== "object" || !("pins" in old)) return old;
      const typed = old as { pins: Pin[] };
      return { ...typed, pins: typed.pins.map((p) => (idSet.has(p.id) ? { ...p, approved: true } : p)) };
    });
  };

  const bulkApprovePinsMutation = useMutation({
    mutationFn: async (pinIds: string[]) => {
      const response = await apiRequest("POST", "/api/pins/bulk-approve", { pinIds });
      return response.json() as Promise<{ approvedCount: number; skippedCount: number }>;
    },
    onSuccess: (result, pinIds) => {
      setSelectedPinIds(new Set());
      toast({
        title: result.approvedCount === 1 ? "Pin approved" : `${result.approvedCount} pins approved`,
        description:
          result.skippedCount > 0
            ? `${result.skippedCount} pin${result.skippedCount === 1 ? "" : "s"} couldn't be approved.`
            : "They're now visible to everyone on this map.",
        variant: result.approvedCount > 0 ? "success" : "destructive",
      });
      markPinsApproved(shareUrl, pinIds);
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve pins",
        variant: "destructive",
      });
    },
  });

  const togglePinSelected = (pinId: string) => {
    setSelectedPinIds((prev) => {
      const next = new Set(prev);
      if (next.has(pinId)) next.delete(pinId);
      else next.add(pinId);
      return next;
    });
  };

  const handleBulkDelete = () => {
    const count = selectedPinIds.size;
    if (count === 0) return;
    if (window.confirm(`Delete ${count} selected pin${count === 1 ? "" : "s"}? This can't be undone.`)) {
      bulkDeletePinsMutation.mutate(Array.from(selectedPinIds));
    }
  };

  const handleBulkApprove = (pendingIds: string[]) => {
    if (pendingIds.length === 0) return;
    bulkApprovePinsMutation.mutate(pendingIds);
  };

  const approvePinMutation = useMutation({
    mutationFn: async (pinId: string) => {
      await apiRequest("PUT", `/api/pins/${pinId}/approve`);
    },
    onSuccess: (_data, pinId) => {
      toast({
        title: "Pin approved",
        description: "It's now visible to everyone on this map.",
        variant: "success",
      });
      markPinsApproved(shareUrl, [pinId]);
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve pin",
        variant: "destructive",
      });
    },
  });

  const hasPendingPins = isOwner && pins.some((pin) => pin.approved === false);

  const approvalFilteredPins = pins.filter((pin) => {
    if (!isOwner) return true;
    if (approvalFilter === "pending") return pin.approved === false;
    if (approvalFilter === "approved") return pin.approved !== false;
    return true;
  });

  const contributorFilteredPins = approvalFilteredPins.filter((pin) => {
    if (contributorFilter === "mine") return !!user && pin.userId === user.id;
    if (contributorFilter === "others") return !user || pin.userId !== user.id;
    return true;
  });

  const filteredPins = contributorFilteredPins.filter(pin =>
    pin.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.note?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Only pins the viewer can actually delete are selectable — a bulk action
  // that silently no-ops on some selections would be confusing.
  const selectablePinIds = filteredPins.filter(canDeletePin).map((pin) => pin.id);
  const allSelected = selectablePinIds.length > 0 && selectablePinIds.every((id) => selectedPinIds.has(id));
  const selectedPendingIds = isOwner
    ? pins.filter((pin) => selectedPinIds.has(pin.id) && pin.approved === false).map((pin) => pin.id)
    : [];

  const toggleSelectAll = () => {
    setSelectedPinIds((prev) => {
      if (allSelected) return new Set();
      return new Set(selectablePinIds);
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {hasPendingPins && (
            <Select value={approvalFilter} onValueChange={(v) => setApprovalFilter(v as ApprovalFilter)}>
              <SelectTrigger className="h-9 w-36" data-testid="select-approval-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending only</SelectItem>
                <SelectItem value="approved">Approved only</SelectItem>
              </SelectContent>
            </Select>
          )}

          {!readOnly && user && (
            <Select value={contributorFilter} onValueChange={(v) => setContributorFilter(v as ContributorFilter)}>
              <SelectTrigger className="h-9 w-40" data-testid="select-contributor-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pins</SelectItem>
                <SelectItem value="mine">My pins only</SelectItem>
                <SelectItem value="others">Added by others</SelectItem>
              </SelectContent>
            </Select>
          )}

          {searchOpen ? (
            <div className="relative w-full max-w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search pins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  if (!searchQuery) setSearchOpen(false);
                }}
                className="pl-9 pr-8 w-full"
                data-testid="input-search-pins"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                  data-testid="button-clear-search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => {
                setSearchOpen(true);
                requestAnimationFrame(() => searchInputRef.current?.focus());
              }}
              aria-label="Search pins"
              data-testid="button-open-search"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!readOnly && selectablePinIds.length > 0 && (
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none shrink-0">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all pins"
              data-testid="checkbox-select-all-pins"
            />
            Select all
          </label>
        )}
      </div>

      {selectedPinIds.size > 0 &&
        (() => {
          const bar = (
            <div
              className={
                headerActionsSlot
                  ? "flex items-center gap-2"
                  : "flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5"
              }
              data-testid="pin-bulk-actions-bar"
            >
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                {selectedPinIds.size} pin{selectedPinIds.size === 1 ? "" : "s"} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 min-h-0 px-2.5 text-xs"
                  onClick={() => setSelectedPinIds(new Set())}
                  data-testid="button-clear-pin-selection"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
                {selectedPendingIds.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 min-h-0 px-2.5 text-xs border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => handleBulkApprove(selectedPendingIds)}
                    disabled={bulkApprovePinsMutation.isPending}
                    data-testid="button-bulk-approve-pins"
                  >
                    {bulkApprovePinsMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-1" />
                    )}
                    Approve selected{selectedPendingIds.length < selectedPinIds.size ? ` (${selectedPendingIds.length})` : ""}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 min-h-0 px-2.5 text-xs"
                  onClick={handleBulkDelete}
                  disabled={bulkDeletePinsMutation.isPending}
                  data-testid="button-bulk-delete-pins"
                >
                  {bulkDeletePinsMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Delete selected
                </Button>
              </div>
            </div>
          );
          return headerActionsSlot ? createPortal(bar, headerActionsSlot) : bar;
        })()}

      {filteredPins.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-muted/30">
          <MapPin className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">
            {pins.length === 0 ? "No pins yet" : "No pins match your search"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {pins.length === 0
              ? readOnly
                ? "This map doesn't have any pins yet."
                : "Click on the map to add the first pin to this collection."
              : "Try adjusting your search terms."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPins.map((pin) => {
            const hasSocials = !!(pin.website || pin.twitterHandle || pin.instagramHandle || pin.linkedinHandle);
            const hasFooter = hasSocials || canApprovePin(pin) || !!pin.googleMapsUrl;
            return (
            <Card
              key={pin.id}
              className={`border-border overflow-hidden ${onPinSelect ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
              onClick={() => onPinSelect?.(pin.id)}
              data-testid={`row-pin-${pin.id}`}
            >
              {pin.photoUrl && (
                <a
                  href={pin.photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="block"
                >
                  <img
                    src={pin.photoUrl}
                    alt={`Photo for ${pin.title}`}
                    className="w-full h-40 object-cover"
                    data-testid={`img-pin-photo-${pin.id}`}
                  />
                </a>
              )}
              <CardContent className="p-4 space-y-3">
                {/* Head: title/meta on the left, venue type + actions menu stacked in the corner */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {canDeletePin(pin) && (
                      <Checkbox
                        checked={selectedPinIds.has(pin.id)}
                        onCheckedChange={() => togglePinSelected(pin.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${pin.title}`}
                        className="mt-1 shrink-0"
                        data-testid={`checkbox-pin-${pin.id}`}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-medium text-foreground text-sm break-words">{pin.title}</h4>
                        <PinStyleSwatch color={pin.pinColor} icon={pin.pinIcon} />
                        {pin.approved === false && (
                          <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 shrink-0">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pin.priceLevel != null && `${formatPriceLevel(pin.priceLevel)} · `}
                        {formatDate(pin.createdAt)}
                        {pin.contributorName && ` · Added by ${pin.contributorName}`}
                      </p>
                      {(pin.city || pin.town || pin.country || pin.postcode) && (
                        <div className="flex items-start gap-1.5 mt-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground break-words">
                            {[pin.city, pin.town, pin.country, pin.postcode].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {pin.venueType && (
                      <Badge variant="secondary" className="font-normal">
                        {formatVenueType(pin.venueType)}
                      </Badge>
                    )}
                    {(canEditPin(pin) || canDeletePin(pin) || directusUrl) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            data-testid={`button-pin-actions-${pin.id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditPin(pin) && (
                            <DropdownMenuItem onClick={() => handleEditPin(pin)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canDeletePin(pin) && (
                            <DropdownMenuItem
                              onClick={() => handleDeletePin(pin)}
                              disabled={deletePinMutation.isPending}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {pin.approved === false ? "Discard" : "Delete"}
                            </DropdownMenuItem>
                          )}
                          {directusUrl && (
                            <DropdownMenuItem asChild>
                              <a
                                href={buildDirectusAdminUrl(directusUrl, "pins", pin.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Database className="h-4 w-4 mr-2" />
                                Open in Directus
                              </a>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Editorial summary + note */}
                {(pin.editorialSummary || pin.note) && (
                  <div className="space-y-2">
                    {pin.editorialSummary && (
                      <p className="text-xs text-muted-foreground italic">{pin.editorialSummary}</p>
                    )}
                    {pin.note && <NoteContent label={resolvedNoteLabel} note={pin.note} />}
                  </div>
                )}

                {/* Social links + Approve/View in Maps */}
                {hasFooter && (
                  <div
                    className="flex items-center justify-between gap-2 pt-3 border-t border-border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SocialLinks pin={pin} />
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {canApprovePin(pin) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          onClick={() => approvePinMutation.mutate(pin.id)}
                          disabled={approvePinMutation.isPending}
                          data-testid={`button-approve-pin-${pin.id}`}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                      )}
                      {pin.googleMapsUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          asChild
                        >
                          <a
                            href={pin.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="link-google-maps"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            View in Maps
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
