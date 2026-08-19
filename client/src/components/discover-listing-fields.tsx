import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURATED_CATEGORY, CURATED_CITY_BY_COUNTRY, CURATED_COUNTRY } from "@shared/enums";
import type { CuratedCategory, CuratedCountry, DiscoverStatus } from "@shared/enums";
import { CURATED_CATEGORY_LABELS, CURATED_COUNTRY_LABELS } from "@/lib/curated-maps";
import { isDiscoverSubmittable } from "@shared/schema";

/** Select can't hold an empty string as a value, so "not set" needs a sentinel of its own. */
const NONE = "__none__";

export interface DiscoverListingValue {
  curatedCategory: CuratedCategory | null;
  curatedCountry: CuratedCountry | null;
  curatedCity: string | null;
  /** What the owner is asking for. "approved"/"rejected" are the admin's answers and read-only here. */
  discoverStatus: DiscoverStatus;
}

/**
 * Where a collection sits on the public Discover page — category, country,
 * city, and whether its owner has asked to be listed.
 *
 * These three fields used to be admin-only, set by hand in Directus, which
 * meant the only way onto Discover was for someone at this end to notice
 * your collection. Owners file their own now; being *listed* is still an
 * admin decision, so the page stays curated rather than becoming a
 * free-for-all. Filling the fields in on their own publishes nothing.
 */
export function DiscoverListingFields({
  value,
  onChange,
}: {
  value: DiscoverListingValue;
  onChange: (next: DiscoverListingValue) => void;
}) {
  // What the collection's status was before this form was opened. Toggling
  // an already-live collection off and back on again means "leave it as it
  // was", not "resubmit something that's already approved".
  const originalStatus = useRef(value.discoverStatus).current;
  const cities = value.curatedCountry ? CURATED_CITY_BY_COUNTRY[value.curatedCountry] : [];
  const ready = isDiscoverSubmittable(value);
  const wantsListing = value.discoverStatus === "pending" || value.discoverStatus === "approved";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="discoverCategory">Category</Label>
        <Select
          value={value.curatedCategory ?? NONE}
          onValueChange={(next) =>
            onChange({ ...value, curatedCategory: next === NONE ? null : (next as CuratedCategory) })
          }
        >
          <SelectTrigger id="discoverCategory" data-testid="select-discover-category">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not set</SelectItem>
            {CURATED_CATEGORY.map((c) => (
              <SelectItem key={c} value={c}>
                {CURATED_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="discoverCountry">Country</Label>
          <Select
            value={value.curatedCountry ?? NONE}
            onValueChange={(next) =>
              onChange({
                ...value,
                curatedCountry: next === NONE ? null : (next as CuratedCountry),
                // The city list is per-country, so a city chosen under the
                // old country would silently become invalid.
                curatedCity: null,
              })
            }
          >
            <SelectTrigger id="discoverCountry" data-testid="select-discover-country">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {CURATED_COUNTRY.map((c) => (
                <SelectItem key={c} value={c}>
                  {CURATED_COUNTRY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="discoverCity">City</Label>
          <Select
            value={value.curatedCity ?? NONE}
            onValueChange={(next) => onChange({ ...value, curatedCity: next === NONE ? null : next })}
            disabled={cities.length === 0}
          >
            <SelectTrigger id="discoverCity" data-testid="select-discover-city">
              <SelectValue placeholder={cities.length === 0 ? "Pick a country first" : "City"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-muted/30 px-3 py-2.5">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="discoverSubmit" className="text-sm">
            Ask to be featured on Discover
          </Label>
          <p className="text-xs text-muted-foreground" data-testid="text-discover-status">
            {value.discoverStatus === "approved"
              ? "Live on Discover. Turn this off to take it down."
              : value.discoverStatus === "pending"
                ? "Waiting for review — it isn't on Discover yet."
                : value.discoverStatus === "rejected"
                  ? "Not accepted last time. You can adjust it and ask again."
                  : ready
                    ? "We'll take a look before it appears on Discover."
                    : "Choose a category, country, and city first."}
          </p>
        </div>
        <Switch
          id="discoverSubmit"
          checked={wantsListing}
          // Nothing to review without the three filters — the server refuses
          // the submission anyway, so don't let it be pressed.
          disabled={!ready && !wantsListing}
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              discoverStatus: checked ? (originalStatus === "approved" ? "approved" : "pending") : "none",
            })
          }
          data-testid="switch-discover-submit"
        />
      </div>
    </div>
  );
}
