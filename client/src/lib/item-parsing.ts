import type { ItemType } from "@shared/enums";

/** The minimal shape every add-item source produces, matching what the AI extraction endpoint returns. */
export interface ItemSeed {
  name: string;
  url?: string;
  note?: string;
}

export const ITEM_NOUN: Record<ItemType, { one: string; many: string }> = {
  location: { one: "pin", many: "pins" },
  link: { one: "link", many: "links" },
  recommendation: { one: "recommendation", many: "recommendations" },
};

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

export function looksLikeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Display name for a URL when no better title is available yet. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Names, one per line, first CSV column only. */
export function parseNameLines(text: string): ItemSeed[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter((line) => line.length > 0)
    .map((name) => ({ name }));
}

/**
 * URLs, one per line. Tolerates surrounding text ("Great read: https://…")
 * since pasted link lists are rarely clean, and keeps the leftover text as
 * the working title until the preview fetch replaces it.
 */
export function parseUrlLines(text: string): ItemSeed[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(URL_PATTERN);
      if (!match) return { name: line };
      const url = match[0];
      const leftover = line.replace(url, "").replace(/^[\s\-–—:|,]+|[\s\-–—:|,]+$/g, "");
      return { name: leftover, url };
    });
}

export function parseText(text: string, itemType: ItemType): ItemSeed[] {
  return itemType === "link" ? parseUrlLines(text) : parseNameLines(text);
}

export async function parseFile(file: File, itemType: ItemType): Promise<ItemSeed[]> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    const cells = rows
      .map((row) => row[0])
      .filter((cell): cell is string => typeof cell === "string" && cell.trim().length > 0)
      .map((cell) => cell.trim());
    return parseText(cells.join("\n"), itemType);
  }
  return parseText(await file.text(), itemType);
}
