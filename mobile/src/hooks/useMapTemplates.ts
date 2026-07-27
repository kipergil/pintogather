import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/api";
import type { MapTemplate } from "../../../shared/schema";

/** Starter presets for the create-map picker, authored in Directus (see GET /api/map-templates). Public — no auth required. */
export function useMapTemplates() {
  return useQuery<MapTemplate[]>({
    queryKey: ["/api/map-templates"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}
