import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Compass, Lock, MapPin, X } from "lucide-react";
import { generateDiscoverCoverUrl } from "@/lib/discover-cover";
import { CURATED_CATEGORY_LABELS, CURATED_COUNTRY_LABELS, isCuratedCategory, isCuratedCountry } from "@/lib/curated-maps";
import type { CuratedCategory, CuratedCountry } from "@shared/enums";

interface DiscoverMap {
  id: string;
  name: string;
  shareUrl: string | null;
  /** True beyond the viewer's tier cap — no shareUrl is sent for these, so the card can't link anywhere but /pricing. */
  locked: boolean;
  curatedCategory: CuratedCategory | null;
  curatedCountry: CuratedCountry | null;
  curatedCity: string | null;
  curatedTagline: string | null;
  ownerName: string | null;
  pinCount: number;
  createdAt: string;
}

interface DiscoverResponse {
  maps: DiscoverMap[];
  totalCount: number;
  visibleCount: number;
  maxVisible: number | null;
  isLimited: boolean;
  filters: {
    categories: CuratedCategory[];
    countries: CuratedCountry[];
    citiesByCountry: Record<string, string[]>;
  };
}

const ALL = "all";

function DiscoverCard({ map }: { map: DiscoverMap }) {
  const coverUrl = useMemo(
    () => generateDiscoverCoverUrl({ mapId: map.id, mapName: map.name, category: map.curatedCategory }),
    [map.id, map.name, map.curatedCategory],
  );

  const cardBody = (
    <Card
      className={`border-border overflow-hidden h-full transition-all ${
        map.locked
          ? "cursor-pointer"
          : "hover:border-primary/40 hover:shadow-md cursor-pointer"
      }`}
    >
      <div className="relative">
        <img
          src={coverUrl}
          alt=""
          className={`w-full aspect-[8/5] object-cover ${map.locked ? "grayscale opacity-60" : ""}`}
        />
        {map.locked && (
          <>
            <div className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-background/90 flex items-center justify-center shadow-sm">
              <Lock className="h-4 w-4 text-foreground" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-foreground shadow">
                <Lock className="h-3.5 w-3.5" />
                Upgrade to see
              </span>
            </div>
          </>
        )}
      </div>
      <CardContent className={`p-4 space-y-2 ${map.locked ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {map.curatedCategory && (
            <Badge variant="secondary" className="text-xs font-medium">
              {CURATED_CATEGORY_LABELS[map.curatedCategory]}
            </Badge>
          )}
          {map.curatedCity && <span className="text-xs text-muted-foreground">{map.curatedCity}</span>}
        </div>
        <h3 className="font-semibold text-foreground leading-snug">{map.name}</h3>
        {map.curatedTagline && <p className="text-sm text-muted-foreground line-clamp-2">{map.curatedTagline}</p>}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
          </span>
          {map.ownerName && <span>Curated by {map.ownerName}</span>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Link
      href={map.locked || !map.shareUrl ? "/pricing" : `/map/${map.shareUrl}`}
      data-testid={`card-discover-map-${map.id}`}
      data-locked={map.locked}
    >
      {cardBody}
    </Link>
  );
}

export default function Discover() {
  const [, setLocation] = useLocation();
  const [category, setCategory] = useState<string>(ALL);
  const [country, setCountry] = useState<string>(ALL);
  const [city, setCity] = useState<string>(ALL);

  useEffect(() => {
    document.title = "Discover curated maps — PinTogather";
  }, []);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (category !== ALL) params.set("category", category);
    if (country !== ALL) params.set("country", country);
    if (city !== ALL) params.set("city", city);
    const qs = params.toString();
    return `/api/discover${qs ? `?${qs}` : ""}`;
  }, [category, country, city]);

  const { data, isLoading } = useQuery<DiscoverResponse>({ queryKey: [queryUrl] });

  // Reset city whenever the country changes and the current city no longer belongs to it.
  const citiesForCountry = useMemo(() => {
    if (!data) return [];
    if (country === ALL) return Object.values(data.filters.citiesByCountry).flat();
    return data.filters.citiesByCountry[country] ?? [];
  }, [data, country]);

  useEffect(() => {
    if (city !== ALL && !citiesForCountry.includes(city)) setCity(ALL);
  }, [citiesForCountry, city]);

  const hasActiveFilters = category !== ALL || country !== ALL || city !== ALL;
  const clearFilters = () => {
    setCategory(ALL);
    setCountry(ALL);
    setCity(ALL);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 text-primary">
          <Compass className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Discover</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Curated maps, ready to explore</h1>
        <p className="text-muted-foreground">
          Hand-picked collections from the PinTogather team and the community — real venues, organized by theme and city.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48" data-testid="select-discover-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {data?.filters.categories.map((c) => (
              <SelectItem key={c} value={c}>
                {isCuratedCategory(c) ? CURATED_CATEGORY_LABELS[c] : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-40" data-testid="select-discover-country">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All countries</SelectItem>
            {data?.filters.countries.map((c) => (
              <SelectItem key={c} value={c}>
                {isCuratedCountry(c) ? CURATED_COUNTRY_LABELS[c] : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={city} onValueChange={setCity} disabled={citiesForCountry.length === 0}>
          <SelectTrigger className="w-40" data-testid="select-discover-city">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All cities</SelectItem>
            {citiesForCountry.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-discover-filters">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[8/5] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : !data || data.maps.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-muted/30">
          <Compass className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">No curated maps match these filters yet</h3>
          <p className="text-sm text-muted-foreground">Try a different category or city, or check back soon.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.maps.map((map) => (
              <DiscoverCard key={map.id} map={map} />
            ))}
          </div>

          {data.isLimited && (
            <div
              className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4"
              data-testid="discover-upgrade-banner"
            >
              <div className="flex items-center gap-2.5 text-sm text-foreground">
                <Lock className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Showing {data.visibleCount} of {data.totalCount} curated maps — upgrade to Basic to see them all.
                </span>
              </div>
              <Button size="sm" onClick={() => setLocation("/pricing")} data-testid="button-discover-upgrade">
                View plans
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
