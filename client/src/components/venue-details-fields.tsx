import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OptionalSection } from "@/components/optional-section";
import { Building2, Store } from "lucide-react";
import { VENUE_TYPE, VENUE_TYPE_LABELS } from "@shared/enums";
import type { VenueType } from "@shared/enums";

/** Select can't hold an empty string as a value, so "not set" needs a sentinel of its own. */
const NONE = "__none__";

/** Google's price levels are 0–4; currency symbols are how every venue page in the world writes them. */
const PRICE_LEVEL_LABELS: Record<number, string> = {
  0: "Free",
  1: "£",
  2: "££",
  3: "£££",
  4: "££££",
};

/** The address parts, in the order they'd be written on an envelope. */
const ADDRESS_FIELDS = [
  { key: "town", label: "Town" },
  { key: "borough", label: "Borough / district" },
  { key: "city", label: "City" },
  { key: "state", label: "State / region" },
  { key: "postcode", label: "Postcode" },
  { key: "country", label: "Country" },
] as const;

export interface VenueDetails {
  website: string;
  venueType: VenueType | null;
  priceLevel: number | null;
  editorialSummary: string;
  city: string;
  state: string;
  town: string;
  borough: string;
  postcode: string;
  country: string;
}

/**
 * The facts about a place, as opposed to what the contributor thought of it.
 *
 * Every one of these is filled in from Google Places at import time and,
 * until now, was invisible afterwards: a venue that had moved, a price level
 * Google had wrong, or a missing website could only be fixed by deleting the
 * pin and adding it again. They stay folded away by default, because on a
 * pin that Google got right there is nothing here to do.
 */
export function VenueDetailsFields({
  value,
  onChange,
  /** The collection's own word for the contributor's note, so the description hint can point at the right field. */
  noteLabel = "note",
}: {
  value: VenueDetails;
  onChange: (next: VenueDetails) => void;
  noteLabel?: string;
}) {
  const set = <K extends keyof VenueDetails>(key: K, next: VenueDetails[K]) => onChange({ ...value, [key]: next });

  return (
    <>
      <OptionalSection
        title="Website, type & price"
        icon={<Store className="h-3.5 w-3.5" />}
        defaultOpen={!!(value.website || value.venueType || value.priceLevel != null || value.editorialSummary)}
        testId="button-toggle-venue-details"
      >
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            placeholder="https://…"
            value={value.website}
            onChange={(e) => set("website", e.target.value)}
            data-testid="input-website"
          />
          <p className="text-xs text-muted-foreground">Also where the social handles above are looked up from.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="venueType">Type</Label>
            <Select
              value={value.venueType ?? NONE}
              onValueChange={(next) => set("venueType", next === NONE ? null : (next as VenueType))}
            >
              <SelectTrigger id="venueType" data-testid="select-venue-type">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {VENUE_TYPE.map((type) => (
                  <SelectItem key={type} value={type}>
                    {VENUE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priceLevel">Price</Label>
            <Select
              value={value.priceLevel == null ? NONE : String(value.priceLevel)}
              onValueChange={(next) => set("priceLevel", next === NONE ? null : Number(next))}
            >
              <SelectTrigger id="priceLevel" data-testid="select-price-level">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {Object.entries(PRICE_LEVEL_LABELS).map(([level, label]) => (
                  <SelectItem key={level} value={level}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="editorialSummary">Description</Label>
          <Textarea
            id="editorialSummary"
            placeholder="A line about this place…"
            value={value.editorialSummary}
            onChange={(e) => set("editorialSummary", e.target.value)}
            rows={2}
            maxLength={1000}
            data-testid="input-editorial-summary"
          />
          <p className="text-xs text-muted-foreground">
            A description of the place itself — your own take belongs in {noteLabel.toLowerCase()} above.
          </p>
        </div>
      </OptionalSection>

      <OptionalSection
        title="Address"
        icon={<Building2 className="h-3.5 w-3.5" />}
        hint="Only worth touching when an import got the location wrong — these change nothing but the address shown on the pin."
        testId="button-toggle-address"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ADDRESS_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="text"
                value={value[key]}
                onChange={(e) => set(key, e.target.value)}
                data-testid={`input-${key}`}
              />
            </div>
          ))}
        </div>
      </OptionalSection>
    </>
  );
}
