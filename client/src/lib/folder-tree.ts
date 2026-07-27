import type { Folder } from "@shared/schema";

export interface FolderTreeNode extends Folder {
  depth: number;
  children: FolderTreeNode[];
}

/** Nests a flat folder list (as returned by GET /api/folders) into a tree, alphabetical within each level. */
export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const key = folder.parentFolderId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(folder);
  }
  for (const list of Array.from(byParent.values())) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const build = (parentId: string | null, depth: number): FolderTreeNode[] =>
    (byParent.get(parentId) ?? []).map((folder) => ({
      ...folder,
      depth,
      children: build(folder.id, depth + 1),
    }));

  return build(null, 0);
}

/** Flattens a tree into display order (each folder immediately followed by its own subfolders) — for indented list/dropdown rendering. */
export function flattenFolderTree(tree: FolderTreeNode[]): FolderTreeNode[] {
  const out: FolderTreeNode[] = [];
  const walk = (nodes: FolderTreeNode[]) => {
    for (const node of nodes) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(tree);
  return out;
}
