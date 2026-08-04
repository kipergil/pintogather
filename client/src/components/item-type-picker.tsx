import { Link2, MapPinned, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ItemType } from "@shared/enums";

interface ItemTypePickerProps {
  onSelect: (itemType: ItemType) => void;
}

const OPTIONS: { itemType: ItemType; icon: typeof MapPinned; label: string; tagline: string }[] = [
  {
    itemType: "location",
    icon: MapPinned,
    label: "Places",
    tagline: "Pins on a real map, with addresses, photos, and notes.",
  },
  {
    itemType: "link",
    icon: Link2,
    label: "Links",
    tagline: "A shared reading or watch list — paste a URL and it fills itself in.",
  },
  {
    itemType: "recommendation",
    icon: Sparkles,
    label: "Recommendations",
    tagline: "Anything worth recommending — books, films, tools, dishes.",
  },
];

/**
 * First step of creating a collection: what kind of thing it holds. Set
 * once here and never editable afterward (see shared/schema.ts's
 * MapCollection.itemType) — every downstream add-item form and detail-page
 * view depends on this choice never changing mid-life. "Locations" is the
 * only choice that leads into the (location-only) TemplatePicker step next.
 */
export function ItemTypePicker({ onSelect }: ItemTypePickerProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">What are you collecting?</h2>
        <p className="text-sm text-muted-foreground">This can't be changed later, so pick the one that fits.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {OPTIONS.map(({ itemType, icon: Icon, label, tagline }) => (
          <Card
            key={itemType}
            className="border-border cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
            onClick={() => onSelect(itemType)}
            data-testid={`card-item-type-${itemType}`}
          >
            <CardContent className="p-4 flex gap-3 items-center">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-foreground">{label}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{tagline}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
