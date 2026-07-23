import { Link } from "wouter";
import { MapPin, Link2, Trash2, Crown, Users, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export interface MapCollectionSummary {
  id: string;
  name: string;
  description?: string;
  shareUrl: string;
  createdAt: string;
  pinCount: number;
  showOnProfile?: boolean;
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
  onCopyLink: (map: MapCollectionSummary) => void;
  onDelete?: (map: MapCollectionSummary) => void;
  onToggleProfileVisibility?: (map: MapCollectionSummary, showOnProfile: boolean) => void;
}

export function MapCard({ map, role, onCopyLink, onDelete, onToggleProfileVisibility }: MapCardProps) {
  return (
    <div
      className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
      data-testid={`card-map-${map.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-semibold text-foreground leading-snug line-clamp-1">{map.name}</h4>
        <Badge
          variant="outline"
          className={
            role === "owner"
              ? "shrink-0 gap-1 border-primary/30 bg-primary/5 text-primary"
              : "shrink-0 gap-1 border-secondary/30 bg-secondary/5 text-secondary"
          }
        >
          {role === "owner" ? <Crown className="h-3 w-3" /> : <Users className="h-3 w-3" />}
          {role === "owner" ? "Owner" : "Contributor"}
        </Badge>
      </div>

      {map.description ? (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{map.description}</p>
      ) : (
        <p className="text-sm text-muted-foreground/60 mb-3 italic">No description</p>
      )}

      {role === "owner" && onToggleProfileVisibility && (
        <div className="flex items-center justify-between gap-2 mb-3 py-2 px-3 rounded-lg bg-muted/40">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {map.showOnProfile ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {map.showOnProfile ? "Public on profile" : "Hidden from profile"}
          </span>
          <Switch
            checked={!!map.showOnProfile}
            onCheckedChange={(checked) => onToggleProfileVisibility(map, checked)}
            data-testid={`switch-profile-visibility-${map.id}`}
          />
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 mt-auto pt-1">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
        </span>
        <span aria-hidden>·</span>
        <span>{formatRelativeDate(map.createdAt)}</span>
      </div>

      <div className="flex gap-2">
        <Link href={`/map/${map.shareUrl}`} className="flex-1">
          <Button variant="default" size="sm" className="w-full" data-testid={`button-view-map-${map.id}`}>
            Open map
          </Button>
        </Link>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onCopyLink(map)}
          title="Copy share link"
          data-testid={`button-copy-map-${map.id}`}
        >
          <Link2 className="h-4 w-4" />
        </Button>
        {role === "owner" && onDelete && (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(map)}
            title="Delete map"
            data-testid={`button-delete-map-${map.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
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
