import { useState } from "react";
import { ChevronRight, Folder as FolderIcon, FolderPlus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Folder } from "@shared/schema";

interface FolderDialogState {
  mode: "create" | "rename";
  parentFolderId: string | null;
  folderId?: string;
  initialName: string;
}

interface FolderBrowserProps<TMap extends { folderId?: string | null }> {
  folders: Folder[];
  maps: TMap[];
  onCreate: (name: string, parentFolderId: string | null) => void;
  onRename: (folderId: string, name: string) => void;
  onDelete: (folder: Folder) => void;
  /** Renders the map cards for whatever's directly inside the folder currently being viewed. */
  renderMaps: (maps: TMap[]) => React.ReactNode;
}

/**
 * Drive-style drill-down browser for "My maps" in folder view mode: folder
 * tiles (with their own new-subfolder/rename/delete menu) for whatever's
 * nested inside the folder currently being viewed, then the maps filed
 * directly there. Root (no folder open) shows top-level folders plus
 * unfiled maps, so there's no separate "Unfiled" affordance to maintain —
 * it's just what root looks like. Contrast with FolderSidebar, the flat
 * always-visible filter list this replaces in folder mode.
 */
export function FolderBrowser<TMap extends { folderId?: string | null }>({
  folders,
  maps,
  onCreate,
  onRename,
  onDelete,
  renderMaps,
}: FolderBrowserProps<TMap>) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<FolderDialogState | null>(null);
  const [nameInput, setNameInput] = useState("");

  const byId = new Map(folders.map((f) => [f.id, f]));
  const childrenOf = (parentId: string | null) =>
    folders.filter((f) => f.parentFolderId === parentId).sort((a, b) => a.name.localeCompare(b.name));

  const countUnder = (folderId: string): number => {
    let count = maps.filter((m) => (m.folderId ?? null) === folderId).length;
    for (const child of childrenOf(folderId)) count += countUnder(child.id);
    return count;
  };

  const path: Folder[] = [];
  for (let cur = currentFolderId; cur; ) {
    const folder = byId.get(cur);
    if (!folder) break;
    path.unshift(folder);
    cur = folder.parentFolderId;
  }

  const openCreate = (parentFolderId: string | null) => {
    setNameInput("");
    setDialog({ mode: "create", parentFolderId, initialName: "" });
  };
  const openRename = (folder: Folder) => {
    setNameInput(folder.name);
    setDialog({ mode: "rename", parentFolderId: folder.parentFolderId, folderId: folder.id, initialName: folder.name });
  };

  const submitDialog = () => {
    const name = nameInput.trim();
    if (!name || !dialog) return;
    if (dialog.mode === "create") {
      onCreate(name, dialog.parentFolderId);
    } else if (dialog.folderId) {
      onRename(dialog.folderId, name);
    }
    setDialog(null);
  };

  const childFolders = childrenOf(currentFolderId);
  const mapsHere = maps.filter((m) => (m.folderId ?? null) === currentFolderId);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center flex-wrap gap-1 text-sm text-muted-foreground min-w-0" data-testid="folder-breadcrumbs">
          <button
            className={`rounded px-1.5 py-0.5 hover:bg-muted ${currentFolderId === null ? "font-semibold text-foreground" : ""}`}
            onClick={() => setCurrentFolderId(null)}
            data-testid="button-breadcrumb-root"
          >
            My maps
          </button>
          {path.map((folder, i) => (
            <span key={folder.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
              {i === path.length - 1 ? (
                <span className="font-semibold text-foreground truncate">{folder.name}</span>
              ) : (
                <button
                  className="rounded px-1.5 py-0.5 hover:bg-muted truncate"
                  onClick={() => setCurrentFolderId(folder.id)}
                  data-testid={`button-breadcrumb-${folder.id}`}
                >
                  {folder.name}
                </button>
              )}
            </span>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => openCreate(currentFolderId)}
          data-testid="button-new-folder-toolbar"
        >
          <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
          New folder
        </Button>
      </div>

      {childFolders.length > 0 && (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mb-5">
        {childFolders.map((folder) => (
            <div
              key={folder.id}
              className="group relative flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-3 py-2.5 cursor-pointer hover:border-secondary hover:bg-secondary/10"
              onClick={() => setCurrentFolderId(folder.id)}
              data-testid={`tile-folder-${folder.id}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <FolderIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{folder.name}</div>
                <div className="text-xs text-muted-foreground">
                  {countUnder(folder.id)} {countUnder(folder.id) === 1 ? "map" : "maps"}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`button-folder-tile-menu-${folder.id}`}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => openCreate(folder.id)} data-testid={`menu-item-new-subfolder-${folder.id}`}>
                    <FolderPlus className="h-3.5 w-3.5 mr-2" />
                    New subfolder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openRename(folder)} data-testid={`menu-item-rename-folder-${folder.id}`}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(folder)}
                    className="text-destructive focus:text-destructive"
                    data-testid={`menu-item-delete-folder-${folder.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
      </div>
      )}

      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
        {currentFolderId === null ? "Unfiled maps" : "Maps in this folder"}
      </div>
      {mapsHere.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-xl px-4 py-3 mb-2">
          No maps directly {currentFolderId === null ? "unfiled" : "in this folder"}. Move one here from its actions
          menu, or open a folder above.
        </p>
      ) : (
        renderMaps(mapsHere)
      )}

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "rename" ? "Rename folder" : "New folder"}</DialogTitle>
          </DialogHeader>
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Folder name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submitDialog()}
            data-testid="input-folder-name"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitDialog} disabled={!nameInput.trim()} data-testid="button-save-folder">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
