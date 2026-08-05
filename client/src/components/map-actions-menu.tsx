import { Settings, Upload, Share2, Download, Database, Trash2, Menu, FolderInput, Check, GitFork } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildDirectusAdminUrl } from "@/lib/directusAdmin";
import { buildFolderTree, flattenFolderTree } from "@/lib/folder-tree";
import type { Folder } from "@shared/schema";

export interface MapActionsMenuProps {
  /** Real DB id of the map, needed for the "Open in Directus" link. */
  mapId: string;
  isOwner: boolean;
  onAddItems: () => void;
  /** Omitted on surfaces that already show a standalone Share button (e.g. map-detail) — the item is hidden entirely rather than duplicating it. */
  onShare?: () => void;
  /** Available to any signed-in viewer, not just the owner — omit to hide the item. */
  onClone?: () => void;
  /** Owner-only actions — omit the corresponding item entirely when not provided. */
  onEditMap?: () => void;
  onExportCsv?: () => void;
  onDelete?: () => void;
  directusUrl?: string | null;
  /** Distinguishes data-testid values when several menus render in a list (e.g. one per map card). */
  testIdSuffix?: string;
  triggerClassName?: string;
  /** This account's folders, for the "Move to folder" submenu — omitted (or empty) hides that item entirely. */
  folders?: Folder[];
  currentFolderId?: string | null;
  onMoveToFolder?: (folderId: string | null) => void;
}

/**
 * The single "hamburger" actions menu for a map, shared between the map-card
 * grid (home dashboard) and the map-detail page header so both surfaces stay
 * in sync rather than drifting into two hand-maintained item lists.
 */
export function MapActionsMenu({
  mapId,
  isOwner,
  onAddItems,
  onShare,
  onClone,
  onEditMap,
  onExportCsv,
  onDelete,
  directusUrl,
  testIdSuffix,
  triggerClassName,
  folders,
  currentFolderId,
  onMoveToFolder,
}: MapActionsMenuProps) {
  const suffix = testIdSuffix ? `-${testIdSuffix}` : "";
  const flatFolders = folders && folders.length > 0 ? flattenFolderTree(buildFolderTree(folders)) : [];

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
            Edit collection
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onAddItems} data-testid={`menu-item-add-items${suffix}`}>
          <Upload className="h-4 w-4 mr-2" />
          Add items
        </DropdownMenuItem>
        {onShare && (
          <DropdownMenuItem onClick={onShare} data-testid={`menu-item-share-map${suffix}`}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </DropdownMenuItem>
        )}
        {onClone && (
          <DropdownMenuItem onClick={onClone} data-testid={`menu-item-clone-map${suffix}`}>
            <GitFork className="h-4 w-4 mr-2" />
            Clone
          </DropdownMenuItem>
        )}
        {isOwner && onExportCsv && (
          <DropdownMenuItem onClick={onExportCsv} data-testid={`menu-item-export-csv${suffix}`}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </DropdownMenuItem>
        )}
        {isOwner && onMoveToFolder && flatFolders.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid={`menu-item-move-to-folder${suffix}`}>
              <FolderInput className="h-4 w-4 mr-2" />
              Move to folder
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onMoveToFolder(null)} data-testid={`menu-item-move-to-unfiled${suffix}`}>
                {currentFolderId == null && <Check className="h-3.5 w-3.5 mr-2" />}
                <span className={currentFolderId == null ? "" : "ml-[22px]"}>Unfiled</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {flatFolders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => onMoveToFolder(folder.id)}
                  style={{ paddingLeft: `${12 + folder.depth * 14}px` }}
                  data-testid={`menu-item-move-to-folder-${folder.id}${suffix}`}
                >
                  {currentFolderId === folder.id && <Check className="h-3.5 w-3.5 mr-2" />}
                  <span className={currentFolderId === folder.id ? "" : "ml-[22px]"}>{folder.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
              Delete collection
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
