import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export interface PlaceSearchResult {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
}

/** Debounced venue-name search against GET /api/places/search (see server/routes.ts for why this proxies OpenStreetMap Nominatim rather than a native Google Places SDK). */
export function usePlacesSearch(query: string) {
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);
    const timeout = setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/places/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await res.json()) as { results: PlaceSearchResult[] };
        setResults(data.results);
      } catch (err: any) {
        setError(err?.message ?? "Couldn't search places.");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [query]);

  return { results, isSearching, error };
}
