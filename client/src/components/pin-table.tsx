import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Edit,
  ChevronDown,
  MessageSquareText,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import { getInitials } from "@/lib/map-utils";
import { OpenInDirectusButton } from "@/components/open-in-directus-button";
import { buildSocialUrl } from "@/lib/social-links";

interface Pin {
  id: string;
  userName: string;
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
  createdAt: string;
}

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
}

function GoogleMapsLink({ url }: { url?: string | null }) {
  if (!url) return <span className="text-sm text-muted-foreground/60">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      data-testid="link-google-maps"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      View
    </a>
  );
}

const AVATAR_PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarClasses(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function SocialLinks({ pin }: { pin: Pin }) {
  if (!pin.twitterHandle && !pin.instagramHandle && !pin.linkedinHandle) {
    return <span className="text-sm text-muted-foreground/60">—</span>;
  }
  return (
    <div className="flex items-center gap-2.5">
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

function NoteToggle({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      data-testid="button-toggle-note"
    >
      <MessageSquareText className="h-3.5 w-3.5" />
      {expanded ? "Hide note" : "Show note"}
      <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
  );
}

function NoteContent({ label, note }: { label: string; note: string }) {
  return (
    <div className="mt-2 rounded-lg bg-muted/50 border border-border p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{note}</p>
    </div>
  );
}

export function PinTable({ pins, mapOwnerId, shareUrl, noteLabel, readOnly = false, onPinSelect }: PinTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const resolvedNoteLabel = noteLabel || "Note";

  const canDeletePin = (pin: Pin) => {
    if (readOnly || !user) return false;
    return user.id === mapOwnerId || user.id === pin.userId;
  };

  const canEditPin = (pin: Pin) => {
    if (readOnly || !user) return false;
    return user.id === pin.userId;
  };

  const handleEditPin = (pin: Pin) => {
    if (shareUrl) {
      setLocation(`/map/${shareUrl}/edit-pin/${pin.id}`);
    }
  };

  const toggleNote = (pinId: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(pinId)) next.delete(pinId);
      else next.add(pinId);
      return next;
    });
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

  const handleDeletePin = (pinId: string) => {
    if (window.confirm("Are you sure you want to delete this pin?")) {
      deletePinMutation.mutate(pinId);
    }
  };

  const filteredPins = pins.filter(pin =>
    pin.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.note?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinIdsWithNotes = filteredPins.filter((pin) => pin.note).map((pin) => pin.id);
  const allNotesExpanded =
    pinIdsWithNotes.length > 0 && pinIdsWithNotes.every((id) => expandedNoteIds.has(id));

  const toggleAllNotes = () => {
    setExpandedNoteIds((prev) => {
      if (allNotesExpanded) {
        const next = new Set(prev);
        pinIdsWithNotes.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      pinIdsWithNotes.forEach((id) => next.add(id));
      return next;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 sm:flex-none">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search pins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full sm:w-64"
            data-testid="input-search-pins"
          />
        </div>
        <div className="flex items-center gap-2">
          {pinIdsWithNotes.length > 0 && (
            <Button variant="outline" size="sm" onClick={toggleAllNotes} data-testid="button-toggle-all-notes">
              {allNotesExpanded ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide all notes
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show all notes
                </>
              )}
            </Button>
          )}
        </div>
      </div>

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
        <>
          {/* Mobile Card Layout */}
          <div className="block lg:hidden space-y-3">
            {filteredPins.map((pin) => (
              <Card
                key={pin.id}
                className={`border-border ${onPinSelect ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
                onClick={() => onPinSelect?.(pin.id)}
                data-testid={`row-pin-${pin.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${avatarClasses(pin.userName)}`}>
                        <span className="text-sm font-semibold">{getInitials(pin.userName)}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-foreground text-sm truncate">{pin.userName}</h4>
                        <p className="text-xs text-muted-foreground">{formatDate(pin.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                            View
                          </a>
                        </Button>
                      )}
                      {canEditPin(pin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditPin(pin)}
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeletePin(pin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePin(pin.id)}
                          disabled={deletePinMutation.isPending}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <OpenInDirectusButton collection="pins" itemId={pin.id} />
                    </div>
                  </div>

                  {(pin.city || pin.town || pin.country || pin.postcode) && (
                    <div className="flex items-start gap-2 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        {[pin.city, pin.town, pin.country, pin.postcode].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}

                  {pin.note && (
                    <div className="mb-3">
                      <NoteToggle expanded={expandedNoteIds.has(pin.id)} onClick={() => toggleNote(pin.id)} />
                      {expandedNoteIds.has(pin.id) && <NoteContent label={resolvedNoteLabel} note={pin.note} />}
                    </div>
                  )}

                  {(pin.twitterHandle || pin.instagramHandle || pin.linkedinHandle) && <SocialLinks pin={pin} />}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contributor</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Map</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{resolvedNoteLabel}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Added</th>
                  {!readOnly && (
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredPins.map((pin) => {
                  const expanded = expandedNoteIds.has(pin.id);
                  return (
                    <Fragment key={pin.id}>
                      <tr
                        className={`transition-colors ${expanded ? "" : "border-b border-border last:border-b-0"} ${onPinSelect ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/30"}`}
                        onClick={() => onPinSelect?.(pin.id)}
                        data-testid={`row-pin-${pin.id}`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${avatarClasses(pin.userName)}`}>
                              <span className="text-xs font-semibold">{getInitials(pin.userName)}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground text-sm truncate">{pin.userName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-foreground">
                          {[pin.city, pin.town].filter(Boolean).join(', ') || pin.country || '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <GoogleMapsLink url={pin.googleMapsUrl} />
                        </td>
                        <td className="py-3.5 px-4">
                          {pin.note ? (
                            <NoteToggle expanded={expanded} onClick={() => toggleNote(pin.id)} />
                          ) : (
                            <span className="text-sm text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <SocialLinks pin={pin} />
                        </td>
                        <td className="py-3.5 px-4 text-sm text-muted-foreground">
                          {formatDate(pin.createdAt)}
                        </td>
                        {!readOnly && (
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {canEditPin(pin) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditPin(pin)}
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {canDeletePin(pin) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeletePin(pin.id)}
                                  disabled={deletePinMutation.isPending}
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              <OpenInDirectusButton collection="pins" itemId={pin.id} />
                            </div>
                          </td>
                        )}
                      </tr>
                      {expanded && pin.note && (
                        <tr className="border-b border-border last:border-b-0">
                          <td colSpan={readOnly ? 6 : 7} className="px-4 pb-3.5 -mt-1">
                            <NoteContent label={resolvedNoteLabel} note={pin.note} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
