import { Database } from "lucide-react";
import { useDirectusAdminUrl, buildDirectusAdminUrl } from "@/lib/directusAdmin";
import { useAuth } from "@/contexts/AuthContext";

interface OpenInDirectusButtonProps {
  /** Directus collection name, e.g. "pins", "map_collections", "directus_users". */
  collection: string;
  itemId: string;
  className?: string;
  /** Shows text next to the icon, for use among labeled buttons rather than an icon-only row. */
  label?: string;
}

/** Admin-only quick link to open this record's own edit page in the Directus admin panel. */
export function OpenInDirectusButton({ collection, itemId, className, label }: OpenInDirectusButtonProps) {
  const { user } = useAuth();
  const directusUrl = useDirectusAdminUrl();

  if (!user?.isAdmin || !directusUrl) return null;

  const defaultClassName = label
    ? "inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input text-sm text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
    : "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors";

  return (
    <a
      href={buildDirectusAdminUrl(directusUrl, collection, itemId)}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Directus"
      onClick={(e) => e.stopPropagation()}
      className={className ?? defaultClassName}
      data-testid={`link-open-in-directus-${itemId}`}
    >
      <Database className="h-4 w-4" />
      {label}
    </a>
  );
}
