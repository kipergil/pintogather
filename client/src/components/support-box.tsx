import { Coffee, ExternalLink, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME, SUPPORT_URL } from "@/lib/branding";

/**
 * The ask for support, as a panel rather than a footer link.
 *
 * A link among the legal pages gets the click rate it deserves, which is
 * roughly none. This is deliberately a card with its own colour, an icon
 * and a button — placed where someone has just finished reading or using
 * something, not in the middle of a task.
 *
 * Amber rather than the app's own primary, for two reasons: it reads as
 * coffee, and it stands apart from a page where everything else is blue.
 * It also has to be a palette colour. The theme tokens are declared as
 * complete colours (`--primary: hsl(221, 83%, 53%)`), not the bare channels
 * Tailwind needs to compose an alpha, so `bg-primary/10` and friends
 * compile to nothing at all — worth knowing before reaching for a tint
 * here. `dark:` variants are spelled out for the same reason: an amber
 * tint has no token to follow when the .dark block takes over.
 *
 * Renders nothing when SUPPORT_URL is empty, so a fork or a self-hosted
 * copy can switch the whole thing off with one env var.
 */
export function SupportBox({
  title = "Support the tools I build",
  description = `${APP_NAME} is built and run by one person. If it's earning its place in your week, a coffee keeps it going — and pays for the next feature.`,
  className = "",
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  if (!SUPPORT_URL) return null;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-6 sm:p-8 dark:border-amber-500/40 dark:from-amber-950/40 dark:to-transparent ${className}`}
      data-testid="support-box"
    >
      {/* Decorative, and behind the content: aria-hidden so a screen reader
          hears the ask rather than a heart. */}
      <Heart
        className="pointer-events-none absolute -right-5 -top-6 h-24 w-24 text-amber-200/70 dark:text-amber-800/30"
        fill="currentColor"
        strokeWidth={0}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
          <Coffee className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm leading-relaxed text-amber-950/75 dark:text-amber-100/80">{description}</p>
        </div>

        <div className="shrink-0 space-y-1.5 text-center">
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" data-testid="link-support-kofi">
              <Coffee className="mr-2 h-4 w-4" />
              Buy me a coffee
              <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
            </a>
          </Button>
          <p className="text-xs text-amber-900/60 dark:text-amber-100/60">One-off or monthly, via Ko-fi</p>
        </div>
      </div>
    </section>
  );
}

/** The quiet version, for the footer — the box carries the actual ask. */
export function SupportLink() {
  if (!SUPPORT_URL) return null;

  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      data-testid="link-footer-support"
    >
      <Coffee className="h-3.5 w-3.5" />
      Support this project
    </a>
  );
}
