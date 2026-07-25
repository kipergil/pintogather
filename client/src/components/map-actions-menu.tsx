import { Settings, Upload, Share2, Download, Database, Trash2, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildDirectusAdminUrl } from "@/lib/directusAdmin";

export interface MapActionsMenuProps {
  /** Real DB id of the map, needed for the "Open in Directus" link. */
  mapId: string;
  isOwner: boolean;
  onImportPins: () => void;
  /** Omitted on surfaces that already show a standalone Share button (e.g. map-detail) — the item is hidden entirely rather than duplicating it. */
  onShare?: () => void;
  /** Owner-only actions — omit the corresponding item entirely when not provided. */
  onEditMap?: () => void;
  onExportCsv?: () => void;
  onDelete?: () => void;
  directusUrl?: string | null;
  /** Distinguishes data-testid values when several menus render in a list (e.g. one per map card). */
  testIdSuffix?: string;
  triggerClassName?: string;
}

/**
 * The single "hamburger" actions menu for a map, shared between the map-card
 * grid (home dashboard) and the map-detail page header so both surfaces stay
 * in sync rather than drifting into two hand-maintained item lists.
 */
export function MapActionsMenu({
  mapId,
  isOwner,
  onImportPins,
  onShare,
  onEditMap,
  onExportCsv,
  onDelete,
  directusUrl,
  testIdSuffix,
  triggerClassName,
}: MapActionsMenuProps) {
  const suffix = testIdSuffix ? `-${testIdSuffix}` : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={triggerClassName} data-testid={`button-map-menu${suffix}`}>
          <Menu className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isOwner && onEditMap && (
          <DropdownMenuItem onClick={onEditMap} data-testid={`menu-item-edit-map${suffix}`}>
            <Settings className="h-4 w-4 mr-2" />
            Edit map
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onImportPins} data-testid={`menu-item-import-pins${suffix}`}>
          <Upload className="h-4 w-4 mr-2" />
          Import pins
        </DropdownMenuItem>
        {onShare && (
          <DropdownMenuItem onClick={onShare} data-testid={`menu-item-share-map${suffix}`}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </DropdownMenuItem>
        )}
        {isOwner && onExportCsv && (
          <DropdownMenuItem onClick={onExportCsv} data-testid={`menu-item-export-csv${suffix}`}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </DropdownMenuItem>
        )}
        {isOwner && directusUrl && (
          <DropdownMenuItem asChild data-testid={`menu-item-open-directus${suffix}`}>
            <a
              href={buildDirectusAdminUrl(directusUrl, "map_collections", mapId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Database className="h-4 w-4 mr-2" />
              Open in Directus
            </a>
          </DropdownMenuItem>
        )}
        {isOwner && onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
              data-testid={`menu-item-delete-map${suffix}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete map
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
