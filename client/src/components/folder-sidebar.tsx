import { useState } from "react";
import { Folder as FolderIcon, FolderPlus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildFolderTree, type FolderTreeNode } from "@/lib/folder-tree";
import type { Folder } from "@shared/schema";

interface FolderDialogState {
  mode: "create" | "rename";
  parentFolderId: string | null;
  folderId?: string;
  initialName: string;
}

interface FolderSidebarProps {
  folders: Folder[];
  /** undefined = "All maps" (no filter), null = "Unfiled", a string = that specific folder. */
  selectedFolderId: string | null | undefined;
  onSelect: (folderId: string | null | undefined) => void;
  countFor: (folderId: string | null | undefined) => number;
  onCreate: (name: string, parentFolderId: string | null) => void;
  onRename: (folderId: string, name: string) => void;
  onDelete: (folder: Folder) => void;
}

/**
 * Private, owner-only folder tree for organizing "My maps" — filtering and
 * management both live here. Always fully expanded (no collapse state):
 * kept simple since folder counts for personal map organization are small.
 */
export function FolderSidebar({ folders, selectedFolderId, onSelect, countFor, onCreate, onRename, onDelete }: FolderSidebarProps) {
  const [dialog, setDialog] = useState<FolderDialogState | null>(null);
  const [nameInput, setNameInput] = useState("");
  const tree = buildFolderTree(folders);

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

  const renderRow = (opts: {
    key: string;
    label: string;
    depth?: number;
    isSelected: boolean;
    count: number;
    onClick: () => void;
    testId: string;
    menu?: React.ReactNode;
  }) => (
    <div
      key={opts.key}
      className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer ${
        opts.isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
      }`}
      style={opts.depth ? { paddingLeft: `${8 + opts.depth * 16}px` } : undefined}
      onClick={opts.onClick}
      data-testid={opts.testId}
    >
      {opts.depth !== undefined && <FolderIcon className="h-3.5 w-3.5 shrink-0" />}
      <span className="flex-1 truncate">{opts.label}</span>
      <span className="text-xs text-muted-foreground">{opts.count}</span>
      {opts.menu}
    </div>
  );

  const renderNode = (node: FolderTreeNode): React.ReactNode => (
    <div key={node.id}>
      {renderRow({
        key: node.id,
        label: node.name,
        depth: node.depth,
        isSelected: selectedFolderId === node.id,
        count: countFor(node.id),
        onClick: () => onSelect(node.id),
        testId: `button-folder-${node.id}`,
        menu: (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-folder-menu-${node.id}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => openCreate(node.id)} data-testid={`menu-item-new-subfolder-${node.id}`}>
                <FolderPlus className="h-3.5 w-3.5 mr-2" />
                New subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openRename(node)} data-testid={`menu-item-rename-folder-${node.id}`}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(node)}
                className="text-destructive focus:text-destructive"
                data-testid={`menu-item-delete-folder-${node.id}`}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      })}
      {node.children.map(renderNode)}
    </div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-3 mb-4">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folders</span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openCreate(null)} data-testid="button-new-folder">
          <FolderPlus className="h-3.5 w-3.5 mr-1" />
          New
        </Button>
      </div>

      {renderRow({
        key: "all",
        label: "All maps",
        isSelected: selectedFolderId === undefined,
        count: countFor(undefined),
        onClick: () => onSelect(undefined),
        testId: "button-folder-all",
      })}
      {renderRow({
        key: "unfiled",
        label: "Unfiled",
        isSelected: selectedFolderId === null,
        count: countFor(null),
        onClick: () => onSelect(null),
        testId: "button-folder-unfiled",
      })}

      {tree.map(renderNode)}

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
