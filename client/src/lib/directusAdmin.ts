import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * The Directus base URL, fetched only for admins (see GET
 * /api/admin/directus-url) so quick-edit links can be built client-side.
 * Getting there still requires the admin's own separate Directus login —
 * this just saves them from having to hunt down the record manually.
 */
export function useDirectusAdminUrl(): string | null {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const { data } = useQuery<{ url: string | null }>({
    queryKey: ["/api/admin/directus-url"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/directus-url");
      return response.json();
    },
    enabled: isAdmin,
    staleTime: Infinity,
  });

  return data?.url ?? null;
}

/**
 * Directus's admin panel uses a dedicated module (not the generic Content
 * one) for a handful of system collections — directus_users has its own
 * "Users" screen, for example. Fall back to /admin/content/:collection for
 * everything else (our own app collections: map_collections, pins, ...).
 */
export function buildDirectusAdminUrl(directusUrl: string, collection: string, itemId: string): string {
  const base = directusUrl.replace(/\/$/, "");
  if (collection === "directus_users") return `${base}/admin/users/${itemId}`;
  if (collection === "directus_files") return `${base}/admin/files/${itemId}`;
  return `${base}/admin/content/${collection}/${itemId}`;
}
