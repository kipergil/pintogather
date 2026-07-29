import { Link } from "wouter";
import { ClipboardPaste, FileUp, Sparkles, type LucideIcon } from "lucide-react";
import type { ItemType } from "@shared/enums";

interface AddMethodsEmptyStateProps {
  shareUrl: string;
  itemType: ItemType;
  /** Contributors who can't bulk-add (signed-out visitors) get the plain message instead of method cards that would dead-end at a sign-in wall. */
  canAdd: boolean;
}

interface Method {
  method: "paste" | "file" | "ai";
  icon: LucideIcon;
  title: string;
  description: string;
}

function methodsFor(itemType: ItemType): Method[] {
  const noun = itemType === "location" ? "places" : itemType === "link" ? "links" : "recommendations";
  return [
    {
      method: "paste",
      icon: ClipboardPaste,
      title: "Paste a list",
      description: `Drop in ${noun} one per line — we'll look each one up.`,
    },
    {
      method: "file",
      icon: FileUp,
      title: "Upload a file",
      description: "A .txt, .csv, or .xlsx export you already have.",
    },
    {
      method: "ai",
      icon: Sparkles,
      title: "Generate with AI",
      description: `Describe a theme, or hand us a screenshot, and get ${noun} back.`,
    },
  ];
}

/**
 * Shown in place of the empty pin table on a brand-new collection. The bulk
 * and AI importers are the app's main draw but used to sit behind an
 * unlabeled hamburger menu — an empty collection is exactly the moment to
 * put them in front of someone, one click from each method.
 */
export function AddMethodsEmptyState({ shareUrl, itemType, canAdd }: AddMethodsEmptyStateProps) {
  const label = itemType === "location" ? "pins" : "items";

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
      <div className="grid gap-3 sm:grid-cols-3 max-w-3xl mx-auto">
        {methodsFor(itemType).map(({ method, icon: Icon, title, description }) => (
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
        ))}
      </div>
    </div>
  );
}
