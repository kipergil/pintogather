import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/api";
import type { Page } from "../../../shared/schema";

/** Published CMS pages, sorted by navOrder — powers the About list in the Profile tab. */
export function usePages() {
  return useQuery<Page[]>({
    queryKey: ["/api/pages"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
}

/** A single published CMS page by slug. */
export function usePage(slug: string | undefined) {
  return useQuery<Page>({
    queryKey: [`/api/pages/${slug}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!slug,
  });
}
