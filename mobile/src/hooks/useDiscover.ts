import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/api";
import type {
  CuratedCategory,
  CuratedCountry,
  ItemType,
} from "../../../shared/enums";

interface DiscoverMap {
  id: string;
  name: string;
  shareUrl: string | null;
  locked: boolean;
  curatedCategory: CuratedCategory | null;
  curatedCountry: CuratedCountry | null;
  curatedCity: string | null;
  curatedTagline: string | null;
  ownerName: string | null;
  pinCount: number;
  itemType: ItemType;
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

export function useDiscover(
  category: string | null,
  country: string | null,
  city: string | null,
) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (country) params.set("country", country);
  if (city) params.set("city", city);
  const qs = params.toString();
  const url = `/api/discover${qs ? `?${qs}` : ""}`;

  return useQuery<DiscoverResponse>({
    queryKey: [url],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}
