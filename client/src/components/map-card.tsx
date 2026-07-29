import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MapPin, Crown, Users, ArchiveRestore, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MapActionsMenu } from "@/components/map-actions-menu";
import { ShareModal } from "@/components/share-modal";
import { useDirectusAdminUrl } from "@/lib/directusAdmin";
import type { Folder } from "@shared/schema";
import type { ItemType } from "@shared/enums";

export interface MapCollectionSummary {
  id: string;
  name: string;
  description?: string;
  shareUrl: string;
  createdAt: string;
  pinCount: number;
  /** Owner-only: pins waiting for approval on this map. Always 0 for contributor-role cards. */
  pendingPinCount?: number;
  showOnProfile?: boolean;
  /** Private, owner-only organization folder — never shown to anyone but the owner. Null/undefined means unfiled. */
  folderId?: string | null;
  /** What kind of thing this collection holds — governs the "pin(s)"/"item(s)" count label below. Defaults to "location" when omitted (pre-item-type API responses). */
  itemType?: ItemType;
}

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays <= 0) return "Today";
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays}d ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
  return `${Math.floor(diffInDays / 30)}mo ago`;
}

interface MapCardProps {
  map: MapCollectionSummary;
  role: "owner" | "contributor";
  onDelete?: (map: MapCollectionSummary) => void;
  onExportCsv?: (map: MapCollectionSummary) => void;
  /** Archived-list mode: shows a "Restore" action instead of the normal actions menu. */
  archived?: boolean;
  onRestore?: (map: MapCollectionSummary) => void;
  isRestoring?: boolean;
  /** Bulk-select mode (for archiving or restoring several at once) — shows a checkbox overlay. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: (map: MapCollectionSummary) => void;
  /** This account's folders, for the "Move to folder" menu — omitted (or empty) hides that action entirely. */
  folders?: Folder[];
  onMoveToFolder?: (map: MapCollectionSummary, folderId: string | null) => void;
}

export function MapCard({
  map,
  role,
  onDelete,
  onExportCsv,
  archived = false,
  onRestore,
  isRestoring = false,
  selectable = false,
  selected = false,
  onToggleSelected,
  folders,
  onMoveToFolder,
}: MapCardProps) {
  const [, setLocation] = useLocation();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const directusUrl = useDirectusAdminUrl();
  const isOwner = role === "owner";

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${selectable ? "pl-11" : ""}`}
      data-testid={`card-map-${map.id}`}
    >
      {selectable && (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelected?.(map)}
          aria-label={`Select ${map.name}`}
          className="absolute left-4 top-5"
          data-testid={`checkbox-select-map-${map.id}`}
        />
      )}

      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-semibold text-foreground leading-snug line-clamp-1">{map.name}</h4>
        <div className="flex shrink-0 items-center gap-1.5">
          {archived && (
            <Badge variant="outline" className="gap-1 border-muted-foreground/30 bg-muted text-muted-foreground">
              Archived
            </Badge>
          )}
          {!archived && isOwner && !!map.pendingPinCount && (
            <Link href={`/map/${map.shareUrl}?pinFilter=pending`}>
              <Badge
                variant="outline"
                className="gap-1 border-amber-300 bg-amber-50 text-amber-700 cursor-pointer hover:bg-amber-100 transition-colors"
                data-testid={`badge-pending-${map.id}`}
              >
                <Clock className="h-3 w-3" />
                {map.pendingPinCount} pending
              </Badge>
            </Link>
          )}
          <Badge
            variant="outline"
            className={
              role === "owner"
                ? "gap-1 border-primary/30 bg-primary/5 text-primary"
                : "gap-1 border-secondary/30 bg-secondary/5 text-secondary"
            }
          >
            {role === "owner" ? <Crown className="h-3 w-3" /> : <Users className="h-3 w-3" />}
            {role === "owner" ? "Owner" : "Contributor"}
          </Badge>
        </div>
      </div>

      {map.description ? (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{map.description}</p>
      ) : (
        <p className="text-sm text-muted-foreground/60 mb-3 italic">No description</p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 mt-auto pt-1">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {map.pinCount} {(map.itemType ?? "location") === "location" ? (map.pinCount === 1 ? "pin" : "pins") : map.pinCount === 1 ? "item" : "items"}
        </span>
        <span aria-hidden>·</span>
        <span>{formatRelativeDate(map.createdAt)}</span>
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/map/${map.shareUrl}`}>
          <Button variant="default" size="sm" data-testid={`button-view-map-${map.id}`}>
            Open map
          </Button>
        </Link>
        {archived ? (
          <Button
            variant="default"
            size="sm"
            className="ml-auto"
            onClick={() => onRestore?.(map)}
            disabled={isRestoring}
            data-testid={`button-restore-map-${map.id}`}
          >
            {isRestoring ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
            )}
            Restore
          </Button>
        ) : (
          <MapActionsMenu
            mapId={map.id}
            isOwner={isOwner}
            onEditMap={() => setLocation(`/map/${map.shareUrl}/edit`)}
            onImportPins={() => setLocation(`/map/${map.shareUrl}/import`)}
            onShare={() => setIsShareModalOpen(true)}
            onExportCsv={onExportCsv ? () => onExportCsv(map) : undefined}
            onDelete={onDelete ? () => onDelete(map) : undefined}
            directusUrl={directusUrl}
            testIdSuffix={map.id}
            triggerClassName="h-8 w-8 shrink-0 ml-auto"
            folders={folders}
            currentFolderId={map.folderId}
            onMoveToFolder={onMoveToFolder ? (folderId) => onMoveToFolder(map, folderId) : undefined}
          />
        )}
      </div>

      {!archived && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          shareUrl={map.shareUrl}
          mapName={map.name}
          mapId={map.id}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}

export function MapCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
      <div className="h-4 bg-muted rounded mb-3 w-2/3" />
      <div className="h-3 bg-muted rounded mb-2 w-full" />
      <div className="h-3 bg-muted rounded mb-4 w-1/2" />
      <div className="flex gap-2">
        <div className="h-9 bg-muted rounded flex-1" />
        <div className="h-9 w-9 bg-muted rounded" />
      </div>
    </div>
  );
}
