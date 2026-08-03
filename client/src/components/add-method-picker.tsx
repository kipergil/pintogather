import { Card, CardContent } from "@/components/ui/card";
import { ClipboardPaste, FileUp, ImageUp, MousePointerClick, Search, Sparkles, type LucideIcon } from "lucide-react";
import type { ItemType } from "@shared/enums";
import { ITEM_NOUN } from "@/lib/item-parsing";

/**
 * Ways items can enter a collection. Also the `?method=` values the add hub
 * accepts, so the map page's empty state and toolbar can deep-link straight
 * past this picker.
 */
export const ADD_METHODS = ["paste", "image", "file", "ai", "venue", "map"] as const;
export type AddMethod = (typeof ADD_METHODS)[number];

/** Venue search and drop-a-pin only mean anything on a map of locations. */
const LOCATION_ONLY = new Set<AddMethod>(["venue", "map"]);

interface MethodMeta {
  icon: LucideIcon;
  title: string;
  /** Takes the collection's own noun so a link collection never reads "pins". */
  describe: (noun: { one: string; many: string }, itemType: ItemType) => string;
}

const METHOD_META: Record<AddMethod, MethodMeta> = {
  paste: {
    icon: ClipboardPaste,
    title: "Paste a list",
    describe: (noun, itemType) =>
      itemType === "link"
        ? "One link per line — we'll fetch each page's title and image."
        : `One ${noun.one} per line.`,
  },
  image: {
    icon: ImageUp,
    title: "Screenshot or photo",
    describe: (noun) => `Upload or paste a picture and AI reads the ${noun.many} out of it.`,
  },
  file: {
    icon: FileUp,
    title: "Upload a file",
    describe: () => "A .txt, .csv, or .xlsx you already have.",
  },
  ai: {
    icon: Sparkles,
    title: "Generate with AI",
    describe: (noun) => `Describe a theme and get ${noun.many} back to review.`,
  },
  venue: {
    icon: Search,
    title: "Search a venue",
    describe: () => "Look a place up on Google Maps and add it.",
  },
  map: {
    icon: MousePointerClick,
    title: "Drop on the map",
    describe: () => "Click a spot to place a pin exactly where you want it.",
  },
};

export function methodsFor(itemType: ItemType): AddMethod[] {
  return ADD_METHODS.filter((m) => itemType === "location" || !LOCATION_ONLY.has(m));
}

/** Parses a `?method=` value, returning undefined when absent or not valid for this collection. */
export function parseMethodParam(value: string | null, itemType: ItemType): AddMethod | undefined {
  if (!value) return undefined;
  const method = ADD_METHODS.find((m) => m === value);
  if (!method) return undefined;
  return methodsFor(itemType).includes(method) ? method : undefined;
}

export function methodTitle(method: AddMethod): string {
  return METHOD_META[method].title;
}

/** Icon/title/description for a method, so other surfaces (the map page's empty state) describe it identically. */
export function methodMeta(method: AddMethod, itemType: ItemType) {
  const { icon, title, describe } = METHOD_META[method];
  return { icon, title, description: describe(ITEM_NOUN[itemType], itemType) };
}

interface AddMethodPickerProps {
  itemType: ItemType;
  onSelect: (method: AddMethod) => void;
}

/**
 * Step one of the add hub: pick how items are coming in. Cards rather than
 * tabs because there are up to five options — a five-across tab strip
 * collapses into unreadable overlapping labels on a phone — and because
 * this mirrors the template picker used when a collection is created, so
 * the two setup steps feel like one flow.
 */
export function AddMethodPicker({ itemType, onSelect }: AddMethodPickerProps) {
  const noun = ITEM_NOUN[itemType];

  return (
    <div className="space-y-4" data-testid="add-method-picker">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">How do you want to add {noun.many}?</h2>
        <p className="text-sm text-muted-foreground">
          Pick whichever suits what you've already got — you can mix and match before saving.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {methodsFor(itemType).map((method) => {
          const { icon: Icon, title, describe } = METHOD_META[method];
          return (
            <Card
              key={method}
              className="border-border cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
              onClick={() => onSelect(method)}
              data-testid={`card-method-${method}`}
            >
              <CardContent className="p-4 flex gap-3">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{title}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{describe(noun, itemType)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
