import { Link } from "wouter";
import { ITEM_NOUN } from "@shared/vocabulary";
import type { ItemType } from "@shared/enums";
// Descriptions come from the picker so the two surfaces can't drift apart.
import { methodMeta, type AddMethod } from "@/components/add-method-picker";

interface AddMethodsEmptyStateProps {
  shareUrl: string;
  itemType: ItemType;
  /** Contributors who can't bulk-add (signed-out visitors) get the plain message instead of method cards that would dead-end at a sign-in wall. */
  canAdd: boolean;
}

/**
 * Four of each type's methods, in the order that suits it. A location
 * collection's single-item paths (venue search, dropping a pin) live on the
 * map above, so it leads with the bulk ones; the others lead with typing one
 * in, which is the most likely first move on an empty collection.
 */
const EMPTY_STATE_METHODS: Record<ItemType, AddMethod[]> = {
  location: ["paste", "image", "file", "ai"],
  link: ["one", "paste", "image", "ai"],
  recommendation: ["one", "paste", "image", "ai"],
};

/**
 * Shown in place of the empty item table on a brand-new collection. The bulk
 * and AI importers are the app's main draw but used to sit behind an
 * unlabeled hamburger menu — an empty collection is exactly the moment to
 * put them in front of someone, one click from each method.
 */
export function AddMethodsEmptyState({ shareUrl, itemType, canAdd }: AddMethodsEmptyStateProps) {
  const label = ITEM_NOUN[itemType].many;

  if (!canAdd) {
    return (
      <div className="py-12 text-center" data-testid="empty-state-signed-out">
        <p className="text-sm text-muted-foreground">No {label} yet.</p>
      </div>
    );
  }

  return (
    <div className="py-6" data-testid="empty-state-add-methods">
      <div className="text-center mb-6">
        <h3 className="text-base font-semibold text-foreground">Nothing here yet — add your first {label}</h3>
        <p className="text-sm text-muted-foreground mt-1">Pick whichever way suits what you've already got.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
        {EMPTY_STATE_METHODS[itemType].map((method) => {
          const { icon: Icon, title, description } = methodMeta(method, itemType);
            return (
            <Link key={method} href={`/map/${shareUrl}/add?method=${method}`}>
              <button
                type="button"
                className="h-full w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                data-testid={`button-empty-method-${method}`}
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="font-medium text-sm text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
