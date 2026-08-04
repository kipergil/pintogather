import { GitFork } from "lucide-react";
import { Link } from "wouter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ForkedFromBadgeProps {
  /** The live-resolved original map, or null if it's since been deleted. */
  forkedFrom: { name: string; shareUrl: string; ownerName: string | null } | null;
}

/**
 * Small "forked from" indicator meant to sit right after a map's title.
 * Click opens a popover with the credit details instead of spelling them out
 * inline next to the title, which got noisy once names/owner names got long.
 */
export function ForkedFromBadge({ forkedFrom }: ForkedFromBadgeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Copied from another collection"
          data-testid="button-forked-from"
        >
          <GitFork className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        {forkedFrom ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Forked from</p>
            <Link
              href={`/map/${forkedFrom.shareUrl}`}
              className="block font-medium text-primary hover:underline"
              data-testid="link-forked-from"
            >
              {forkedFrom.name}
            </Link>
            {forkedFrom.ownerName && <p className="text-xs text-muted-foreground">by {forkedFrom.ownerName}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Copied from a collection that's no longer available.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
