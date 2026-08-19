import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AtSign, Check, Link2, Loader2, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import type { SocialPlatform } from "@/lib/social-links";

export interface SocialHandles {
  twitterHandle: string;
  instagramHandle: string;
  linkedinHandle: string;
}

const FIELDS: { platform: SocialPlatform; key: keyof SocialHandles; label: string; icon: typeof AtSign }[] = [
  { platform: "twitter", key: "twitterHandle", label: "X (Twitter)", icon: AtSign },
  { platform: "instagram", key: "instagramHandle", label: "Instagram", icon: AtSign },
  { platform: "linkedin", key: "linkedinHandle", label: "LinkedIn", icon: Link2 },
];

type Suggestions = Partial<Record<SocialPlatform, string>>;

interface SocialLinksFieldsProps {
  value: SocialHandles;
  onChange: (next: SocialHandles) => void;
  /**
   * The venue's own website. When present, its accounts are looked up in the
   * background and offered — this is the thing a pin's social links should
   * actually be about.
   */
  website?: string | null;
}

/**
 * Social handles for a pin, with two ways to fill them in — neither of which
 * happens on its own.
 *
 * This used to prefill the signed-in person's own handles automatically, so
 * a pin for a restaurant would silently carry the contributor's personal
 * Instagram. That's almost never what the pin is about, and worse, it was
 * invisible: you had to notice the fields were populated to know it had
 * happened. Now nothing is written without a click.
 */
export function SocialLinksFields({ value, onChange, website }: SocialLinksFieldsProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestions>({});
  const [dismissed, setDismissed] = useState(false);
  const requestedFor = useRef<string | null>(null);

  const myHandles: SocialHandles = {
    twitterHandle: user?.twitterHandle || "",
    instagramHandle: user?.instagramHandle || "",
    linkedinHandle: user?.linkedinHandle || "",
  };
  const hasMyHandles = Object.values(myHandles).some(Boolean);

  const discover = useMutation({
    mutationFn: async (site: string) => {
      const response = await apiRequest("POST", "/api/social-suggestions", { website: site });
      return (await response.json()) as { suggestions: Suggestions };
    },
    onSuccess: (data) => setSuggestions(data.suggestions ?? {}),
    // A venue with a dead website means "no suggestions", not an error on a
    // form nobody asked to interact with.
    onError: () => setSuggestions({}),
  });

  const runDiscovery = discover.mutate;
  useEffect(() => {
    const site = website?.trim();
    if (!site || requestedFor.current === site) return;
    requestedFor.current = site;
    runDiscovery(site);
  }, [website, runDiscovery]);

  /** Only offer a handle that differs from what's already in the field. */
  const offered = FIELDS.filter(({ platform, key }) => {
    const found = suggestions[platform];
    return !!found && found !== value[key].trim();
  });
  const showSuggestions = !dismissed && offered.length > 0;

  const applyAll = () => {
    const next = { ...value };
    for (const { platform, key } of offered) next[key] = suggestions[platform]!;
    onChange(next);
    setDismissed(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-sm text-muted-foreground">Social links</Label>
        {hasMyHandles && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => onChange({ ...value, ...myHandles })}
            data-testid="button-use-my-socials"
          >
            <UserRound className="h-3.5 w-3.5 mr-1.5" />
            Use mine
          </Button>
        )}
      </div>

      {discover.isPending && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="social-discovery-pending">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking the venue's website…
        </p>
      )}

      {showSuggestions && (
        <div
          className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2"
          data-testid="social-suggestions"
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Found on the venue's website
          </p>
          <div className="flex flex-wrap gap-1.5">
            {offered.map(({ platform, key, label }) => (
              <button
                key={platform}
                type="button"
                onClick={() => onChange({ ...value, [key]: suggestions[platform]! })}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:border-primary/50 hover:bg-accent"
                data-testid={`button-accept-${platform}`}
              >
                <Check className="h-3 w-3 text-primary" />
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">{suggestions[platform]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            {offered.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={applyAll}
                data-testid="button-accept-all-socials"
              >
                Use all {offered.length}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setDismissed(true)}
              data-testid="button-dismiss-socials"
            >
              No thanks
            </Button>
          </div>
        </div>
      )}

      {FIELDS.map(({ key, label, icon: Icon }) => (
        <div className="relative" key={key}>
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${label} handle or URL`}
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            className="pl-9"
            data-testid={`input-${key.replace("Handle", "")}`}
          />
        </div>
      ))}
    </div>
  );
}
