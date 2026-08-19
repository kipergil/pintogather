import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * A group of fields most people never need, folded away behind its own
 * heading.
 *
 * Both the collection form and the pin form had grown their own copy of
 * this markup — three in one file — and every new field group meant another
 * hand-rolled trigger with slightly different spacing. Sharing it also
 * means "advanced things start closed, unless they already hold something"
 * is one rule in one place rather than a `useState` initialiser repeated at
 * each call site.
 */
export function OptionalSection({
  title,
  icon,
  hint,
  /** Starts open when the section already holds values — nobody should have to hunt for a setting they can see the effects of. */
  defaultOpen = false,
  /** Short status shown on the closed row, e.g. "Waiting for review". Keep it to a couple of words. */
  badge,
  testId,
  children,
}: {
  title: string;
  icon?: ReactNode;
  hint?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  testId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
          data-testid={testId}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {icon}
            <span className="truncate">{title}</span>
            {badge ?? <span className="text-xs font-normal text-muted-foreground/70 shrink-0">optional</span>}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-3">
        {hint && <p className="text-xs text-muted-foreground -mt-1">{hint}</p>}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
