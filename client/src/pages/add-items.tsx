import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { isUpgradeableError, upgradeToastAction } from "@/lib/upgradeToast";
import { useUsage } from "@/hooks/useUsage";
import { UsageMeter } from "@/components/usage-meter";
import { searchVenues, buildGoogleMapsUrl, type VenueResult } from "@/lib/google-maps";
import { getPrimaryVenueType } from "@/lib/venue-type";
import { TIER_LIMITS } from "@shared/limits";
import type { ItemType } from "@shared/enums";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  ClipboardPaste,
  FileUp,
  ImageIcon,
  Link2,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

const ALLOWED_SCREENSHOT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

interface AddItemsProps {
  params: {
    shareUrl: string;
  };
}

/** Tab ids for the add-method picker, also accepted as ?method= for deep links from the map page's empty state. */
const ADD_METHODS = ["file", "paste", "ai"] as const;
type AddMethod = (typeof ADD_METHODS)[number];

function parseMethod(value: string | null): AddMethod {
  return ADD_METHODS.includes(value as AddMethod) ? (value as AddMethod) : "file";
}

const ITEM_NOUN: Record<ItemType, { one: string; many: string }> = {
  location: { one: "pin", many: "pins" },
  link: { one: "link", many: "links" },
  recommendation: { one: "recommendation", many: "recommendations" },
};

/**
 * A candidate before it lands in the collection. Every input method (paste,
 * file, image, AI, and later venue search) produces these, and every item
 * type consumes the same shape — only `resolveItem` and the bulk payload
 * differ per type, which is what keeps adding a new input method cheap.
 */
type StageStatus = "idle" | "resolving" | "resolved" | "unresolved" | "error";

interface StagedItem {
  id: string;
  name: string;
  url: string;
  note: string;
  photoUrl: string | null;
  status: StageStatus;
  /** Location items only — candidate venues from Google Places, picked between when there's more than one. */
  matches: VenueResult[];
  selectedIndex: number;
  /** A link whose preview fetch failed. Still importable — the URL is fine, we just couldn't read the page. */
  previewFailed?: boolean;
}

/** The minimal shape every source produces, matching what the AI extraction endpoint returns. */
interface ItemSeed {
  name: string;
  url?: string;
  note?: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

function looksLikeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Names, one per line, first CSV column only. */
function parseNameLines(text: string): ItemSeed[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter((line) => line.length > 0)
    .map((name) => ({ name }));
}

/**
 * URLs, one per line. Tolerates surrounding text ("Great read: https://…")
 * since pasted link lists are rarely clean, and keeps the leftover text as
 * the working title until the preview fetch replaces it.
 */
function parseUrlLines(text: string): ItemSeed[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(URL_PATTERN);
      if (!match) return { name: line };
      const url = match[0];
      const leftover = line.replace(url, "").replace(/^[\s\-–—:|,]+|[\s\-–—:|,]+$/g, "");
      return { name: leftover, url };
    });
}

function parseText(text: string, itemType: ItemType): ItemSeed[] {
  return itemType === "link" ? parseUrlLines(text) : parseNameLines(text);
}

async function parseFile(file: File, itemType: ItemType): Promise<ItemSeed[]> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    const cells = rows
      .map((row) => row[0])
      .filter((cell): cell is string => typeof cell === "string" && cell.trim().length > 0)
      .map((cell) => cell.trim());
    return parseText(cells.join("\n"), itemType);
  }
  return parseText(await file.text(), itemType);
}

// Runs `fn` over `items` with limited concurrency.
async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export default function AddItems({ params }: AddItemsProps) {
  const { shareUrl } = params;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  // ?new=1 comes from the just-created-a-collection redirect, so the page can
  // introduce itself as the next step rather than reading like a detour.
  const isFirstRun = searchParams.get("new") === "1";
  const initialMethod = parseMethod(searchParams.get("method"));
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const { usage } = useUsage();
  const aiLimitReached = usage ? usage.aiSuggestions.used >= usage.aiSuggestions.limit : false;
  const hasScreenshotImport = TIER_LIMITS[user?.userGroup ?? "freemium"].screenshotImport;

  // What this collection holds decides how pasted text is parsed, how each
  // item resolves, and what gets sent to the bulk endpoint.
  const { data: mapCollection } = useQuery<{ itemType: ItemType; name: string }>({
    queryKey: [`/api/maps/${shareUrl}`],
  });
  const itemType: ItemType = mapCollection?.itemType ?? "location";
  const noun = ITEM_NOUN[itemType];
  const isLocation = itemType === "location";

  const [items, setItems] = useState<StagedItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isResolvingAll, setIsResolvingAll] = useState(false);
  const [resolveProgress, setResolveProgress] = useState(0);
  const [pasteText, setPasteText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const updateItem = useCallback((id: string, patch: Partial<StagedItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const resolveLocation = useCallback(
    async (id: string, query: string): Promise<StageStatus> => {
      try {
        const matches = await searchVenues(query);
        if (matches.length === 0) {
          updateItem(id, { status: "unresolved", matches: [] });
          return "unresolved";
        }
        updateItem(id, {
          status: "resolved",
          matches: matches.slice(0, 8),
          selectedIndex: 0,
          name: matches[0].name || query,
        });
        return "resolved";
      } catch (error: any) {
        const isZeroResults = typeof error?.message === "string" && error.message.includes("ZERO_RESULTS");
        updateItem(id, { status: isZeroResults ? "unresolved" : "error", matches: [] });
        return isZeroResults ? "unresolved" : "error";
      }
    },
    [updateItem],
  );

  const resolveLink = useCallback(
    async (id: string, seed: { name: string; url: string; note: string }): Promise<StageStatus> => {
      // A bare URL pasted into the name column is still a URL.
      const url = seed.url.trim() || (looksLikeUrl(seed.name.trim()) ? seed.name.trim() : "");
      if (!url) {
        updateItem(id, { status: "unresolved" });
        return "unresolved";
      }
      try {
        const response = await apiRequest("POST", "/api/link-preview", { url });
        const preview = (await response.json()) as {
          title: string | null;
          description: string | null;
          imageUrl: string | null;
        };
        const currentName = seed.name.trim();
        updateItem(id, {
          status: "resolved",
          url,
          name: currentName || preview.title || hostnameOf(url),
          note: seed.note.trim() || preview.description || "",
          photoUrl: preview.imageUrl,
          previewFailed: false,
        });
        return "resolved";
      } catch {
        // The page may block scraping or simply be down — the link itself is
        // still perfectly importable, so this is a note, not a failure.
        updateItem(id, {
          status: "resolved",
          url,
          name: seed.name.trim() || hostnameOf(url),
          previewFailed: true,
        });
        return "resolved";
      }
    },
    [updateItem],
  );

  const resolveItem = useCallback(
    async (item: StagedItem): Promise<StageStatus> => {
      updateItem(item.id, { status: "resolving" });
      if (itemType === "location") return resolveLocation(item.id, item.name);
      if (itemType === "link") {
        return resolveLink(item.id, { name: item.name, url: item.url, note: item.note });
      }
      // Recommendations carry no external reference to look up — a name is
      // the whole requirement.
      const status: StageStatus = item.name.trim() ? "resolved" : "unresolved";
      updateItem(item.id, { status });
      return status;
    },
    [itemType, resolveLink, resolveLocation, updateItem],
  );

  const resolveAll = async (list: StagedItem[]) => {
    setIsResolvingAll(true);
    setResolveProgress(0);
    let done = 0;
    const droppedIds = new Set<string>();
    await runWithConcurrency(list, 3, async (item) => {
      const status = await resolveItem(item);
      if (status === "unresolved") droppedIds.add(item.id);
      done += 1;
      setResolveProgress(done);
    });
    setIsResolvingAll(false);

    if (droppedIds.size > 0) {
      setItems((prev) => prev.filter((item) => !droppedIds.has(item.id)));
      toast({
        title: `${droppedIds.size} ${droppedIds.size === 1 ? noun.one : noun.many} skipped`,
        description: isLocation
          ? "No matching location was found on Google Maps, so it was left out."
          : itemType === "link"
            ? "No usable link was found on those lines, so they were left out."
            : "Those rows had no title, so they were left out.",
      });
    }
  };

  const startStaging = (seeds: ItemSeed[]) => {
    if (seeds.length === 0) {
      toast({
        title: `No ${noun.many} found`,
        description: "Didn't find any readable rows to add.",
        variant: "destructive",
      });
      return;
    }
    const staged: StagedItem[] = seeds.map((seed) => ({
      id: nanoid(),
      name: seed.name ?? "",
      url: seed.url ?? "",
      note: seed.note ?? "",
      photoUrl: null,
      status: "idle",
      matches: [],
      selectedIndex: 0,
    }));
    setItems(staged);
    resolveAll(staged);
  };

  const handleFile = async (file: File) => {
    setIsParsing(true);
    try {
      startStaging(await parseFile(file, itemType));
    } catch (error: any) {
      toast({
        title: "Couldn't read file",
        description: error?.message || "Make sure it's a .txt, .csv, or .xlsx file.",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  type ExtractResponse = {
    items?: ItemSeed[];
    suggestions?: string[];
    usage: { used: number; limit: number };
  };

  /** Both AI routes return the same shape; `suggestions` is the older name-only fallback. */
  const seedsFromResponse = (data: ExtractResponse): ItemSeed[] =>
    data.items?.length ? data.items : (data.suggestions ?? []).map((name) => ({ name }));

  const onGenerateError = (error: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/usage"] });
    toast({
      title: "Couldn't generate suggestions",
      description: error.message || "Please try again",
      variant: "destructive",
      action: isUpgradeableError(error) ? upgradeToastAction() : undefined,
    });
  };

  const generateSuggestionsMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest("POST", `/api/maps/${shareUrl}/venue-suggestions`, { prompt });
      return response.json() as Promise<ExtractResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/usage"], (old: any) => (old ? { ...old, aiSuggestions: data.usage } : old));
      startStaging(seedsFromResponse(data));
    },
    onError: onGenerateError,
  });

  const generateFromScreenshotMutation = useMutation({
    mutationFn: async ({ file, prompt }: { file: File; prompt: string }) => {
      const response = await apiUpload(
        `/api/maps/${shareUrl}/extract-items`,
        file,
        prompt ? { prompt } : undefined,
      );
      return response.json() as Promise<ExtractResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/usage"], (old: any) => (old ? { ...old, aiSuggestions: data.usage } : old));
      setScreenshot(null);
      startStaging(seedsFromResponse(data));
    },
    onError: onGenerateError,
  });

  const handleGenerateSuggestions = () => {
    if (screenshot) {
      generateFromScreenshotMutation.mutate({ file: screenshot, prompt: aiPrompt.trim() });
      return;
    }
    if (!aiPrompt.trim()) return;
    generateSuggestionsMutation.mutate(aiPrompt.trim());
  };

  const handleScreenshotInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_SCREENSHOT_TYPES.has(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PNG, JPEG, WebP, or GIF image.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Please upload an image under 4MB.",
        variant: "destructive",
      });
      return;
    }
    setScreenshot(file);
  };

  const isGenerating = generateSuggestionsMutation.isPending || generateFromScreenshotMutation.isPending;

  const retryFailed = () => {
    resolveAll(items.filter((item) => item.status === "unresolved" || item.status === "error"));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const moveItem = (id: string, direction: "up" | "down") => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      const swapWith = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  /** Turns a resolved staged item into the bulk-endpoint payload for this collection's type. */
  const toPinPayload = (item: StagedItem) => {
    if (itemType === "location") {
      const match = item.matches[item.selectedIndex] ?? item.matches[0];
      return {
        title: item.name.trim() || match.name,
        latitude: String(match.lat),
        longitude: String(match.lng),
        address: match.address || null,
        googleMapsUrl: buildGoogleMapsUrl({
          lat: match.lat,
          lng: match.lng,
          name: match.name,
          address: match.address,
          placeId: match.id,
        }),
        venueType: getPrimaryVenueType(match.types),
        priceLevel: match.priceLevel ?? null,
      };
    }
    return {
      title: item.name.trim(),
      url: item.url.trim() || null,
      note: item.note.trim() || undefined,
      photoUrl: item.photoUrl,
    };
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const pins = items
        .filter((item) => item.status === "resolved" && (!isLocation || item.matches.length > 0))
        .map(toPinPayload);
      const response = await apiRequest("POST", `/api/maps/${shareUrl}/pins/bulk`, { pins });
      return response.json();
    },
    onSuccess: (result: { created: unknown[]; updated: unknown[]; skippedDueToLimit?: number }) => {
      const createdCount = result.created.length;
      const updatedCount = result.updated.length;
      const skippedCount = result.skippedDueToLimit ?? 0;
      const parts = [];
      if (createdCount > 0) parts.push(`${createdCount} ${createdCount === 1 ? noun.one : noun.many} added`);
      if (updatedCount > 0) {
        parts.push(`${updatedCount} existing ${updatedCount === 1 ? noun.one : noun.many} updated`);
      }
      if (skippedCount > 0) parts.push(`${skippedCount} skipped — collection limit reached`);

      toast({
        title: "All done",
        description: parts.length > 0 ? `${parts.join(", ")}.` : `No ${noun.many} to add.`,
        variant: skippedCount > 0 && createdCount === 0 && updatedCount === 0 ? "destructive" : "success",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      setLocation(`/map/${shareUrl}`);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't add these",
        description: error.message || `Failed to add ${noun.many}`,
        variant: "destructive",
      });
    },
  });

  const readyCount = items.filter((item) => item.status === "resolved").length;
  const failedCount = items.filter((item) => item.status === "unresolved" || item.status === "error").length;
  const canImport = readyCount > 0 && !isResolvingAll && !importMutation.isPending;

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8 text-center">
            <h2 className="text-lg font-semibold text-foreground mb-2">Sign in to add items in bulk</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Pasting a list, uploading a file or screenshot, and AI suggestions all need an account so the items
              are attributed to you.
            </p>
            <Link href={`/map/${shareUrl}`}>
              <Button className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to map
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const pastePlaceholder = isLocation
    ? "Paste venue names, one per line —\nEiffel Tower\nBritish Museum\nColosseum"
    : itemType === "link"
      ? "Paste links, one per line —\nhttps://example.com/article\nhttps://another.site/post"
      : "Paste one per line —\nDune (the novel)\nThe Bear, season 2\nOxo Tower at sunset";

  const aiPlaceholder = isLocation
    ? "Describe what you're looking for —\nBest ramen spots in Tokyo"
    : itemType === "link"
      ? "Describe what you're looking for —\nEssential essays on typography"
      : "Describe what you're looking for —\nCosy films for a rainy Sunday";

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isFirstRun ? `Add your first ${noun.many}` : "Add items"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLocation
              ? "Paste a list, upload a file or screenshot, or let AI suggest places — we'll look each one up on Google Maps."
              : itemType === "link"
                ? "Paste links, upload a file or screenshot, or let AI suggest pages — we'll fetch a title and image for each."
                : "Paste a list, upload a file or screenshot, or let AI suggest things to recommend."}
          </p>
        </div>
        <Link href={`/map/${shareUrl}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isFirstRun ? "Skip for now" : "Back to collection"}
          </Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="p-6 sm:p-10">
            <Tabs defaultValue={initialMethod} className="w-full">
              <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-8">
                <TabsTrigger value="file" data-testid="tab-file">
                  <FileUp className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  Upload file
                </TabsTrigger>
                <TabsTrigger value="paste" data-testid="tab-paste">
                  <ClipboardPaste className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  Paste list
                </TabsTrigger>
                <TabsTrigger value="ai" data-testid="tab-ai">
                  <Sparkles className="h-4 w-4 mr-1.5 hidden sm:inline" />
                  Generate with AI
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <FileUp className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">
                  Upload a list of {noun.many}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  A .txt or .csv file with one {isLocation ? "venue name" : itemType === "link" ? "link" : "entry"} per
                  line, or an .xlsx spreadsheet with them in the first column.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.xlsx"
                  className="hidden"
                  onChange={handleFileInputChange}
                  data-testid="input-import-file"
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={isParsing} data-testid="button-choose-file">
                  {isParsing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Reading file...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose file
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="paste" className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <ClipboardPaste className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">Paste a list of {noun.many}</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  One per line.{" "}
                  {isLocation
                    ? "We'll look each one up on Google Maps."
                    : itemType === "link"
                      ? "We'll fetch each page's title, description, and image."
                      : "Anything you'd recommend to someone."}
                </p>
                <div className="max-w-sm mx-auto text-left space-y-2">
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={pastePlaceholder}
                    rows={5}
                    className="text-sm"
                    data-testid="input-paste-venues"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => startStaging(parseText(pasteText, itemType))}
                    disabled={!pasteText.trim()}
                    data-testid="button-import-pasted"
                  >
                    <ClipboardPaste className="h-4 w-4 mr-2" />
                    Add pasted list
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">Generate suggestions with AI</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  Describe a theme, or attach a screenshot, and we'll suggest up to 15 {noun.many} for you to review
                  before adding.
                </p>
                <div className="max-w-sm mx-auto text-left space-y-3">
                  {usage && (
                    <UsageMeter
                      label="AI generations today"
                      used={usage.aiSuggestions.used}
                      limit={usage.aiSuggestions.limit}
                    />
                  )}
                  {aiLimitReached ? (
                    <div
                      className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground"
                      data-testid="ai-limit-locked-notice"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">You've used today's AI generations on the {usage?.userGroup ?? "current"} plan.</span>
                      <Link href="/pricing" className="font-medium text-primary hover:underline shrink-0">
                        Upgrade
                      </Link>
                    </div>
                  ) : (
                    <>
                      <Textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder={screenshot ? "Optional — add context for the screenshot" : aiPlaceholder}
                        rows={3}
                        className="text-sm"
                        data-testid="input-ai-prompt"
                      />

                      {hasScreenshotImport && (
                        <>
                          <input
                            ref={screenshotInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="hidden"
                            onChange={handleScreenshotInputChange}
                            data-testid="input-ai-screenshot"
                          />
                          {screenshot ? (
                            <div
                              className="flex items-center gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
                              data-testid="ai-screenshot-chip"
                            >
                              <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="flex-1 truncate text-foreground">{screenshot.name}</span>
                              <button
                                type="button"
                                onClick={() => setScreenshot(null)}
                                className="text-muted-foreground hover:text-destructive shrink-0"
                                data-testid="button-remove-screenshot"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full text-muted-foreground"
                              onClick={() => screenshotInputRef.current?.click()}
                              data-testid="button-attach-screenshot"
                            >
                              <ImageIcon className="h-4 w-4 mr-2" />
                              Attach a screenshot instead
                            </Button>
                          )}
                        </>
                      )}

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleGenerateSuggestions}
                        disabled={(!aiPrompt.trim() && !screenshot) || isGenerating}
                        data-testid="button-generate-suggestions"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate with AI
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">
              {isResolvingAll ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isLocation ? "Looking up venues" : itemType === "link" ? "Fetching previews" : "Preparing"}... (
                  {resolveProgress}/{items.length})
                </span>
              ) : (
                <span>
                  <span className="font-medium text-foreground">{items.length}</span> {noun.many} ·{" "}
                  <span className="font-medium text-emerald-600">{readyCount} ready</span>
                  {failedCount > 0 && (
                    <>
                      {" "}
                      · <span className="font-medium text-destructive">{failedCount} need attention</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {failedCount > 0 && !isResolvingAll && (
                <Button variant="outline" size="sm" onClick={retryFailed} data-testid="button-retry-failed">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry failed
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setItems([])} data-testid="button-start-over">
                Start over
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item, index) => (
              <Card key={item.id} className="border-border">
                <CardContent className="p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-0.5 pt-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveItem(item.id, "up")}
                        disabled={index === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                        data-testid={`button-move-up-${item.id}`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(item.id, "down")}
                        disabled={index === items.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                        data-testid={`button-move-down-${item.id}`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {item.photoUrl && (
                      <img
                        src={item.photoUrl}
                        alt=""
                        className="h-12 w-12 rounded-md object-cover shrink-0"
                        data-testid={`img-item-preview-${item.id}`}
                      />
                    )}

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(item.id, { name: e.target.value })}
                          placeholder={isLocation ? "Venue name" : "Title"}
                          className="h-9"
                          data-testid={`input-item-name-${item.id}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => resolveItem(item)}
                          disabled={item.status === "resolving" || (!item.name.trim() && !item.url.trim())}
                          title={isLocation ? "Search again" : "Fetch again"}
                          data-testid={`button-search-item-${item.id}`}
                        >
                          {item.status === "resolving" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                          data-testid={`button-remove-item-${item.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {!isLocation && (
                        <Input
                          value={item.url}
                          onChange={(e) => updateItem(item.id, { url: e.target.value })}
                          placeholder={itemType === "link" ? "https://..." : "Link (optional)"}
                          className="h-8 text-xs"
                          data-testid={`input-item-url-${item.id}`}
                        />
                      )}

                      {isLocation && item.status === "resolved" && (
                        <div className="space-y-1.5">
                          {item.matches.length > 1 && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              {item.matches.length} places match this name — confirm which one you mean
                            </div>
                          )}
                          <div className="flex items-start gap-2">
                            {item.matches.length === 1 && (
                              <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                            )}
                            {item.matches.length > 1 ? (
                              <Select
                                value={String(item.selectedIndex)}
                                onValueChange={(value) => {
                                  const idx = Number(value);
                                  updateItem(item.id, { selectedIndex: idx, name: item.matches[idx].name });
                                }}
                              >
                                <SelectTrigger
                                  className="h-9 text-sm flex-1 border-amber-300 focus:ring-amber-400"
                                  data-testid={`select-match-${item.id}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {item.matches.map((match, idx) => (
                                    <SelectItem key={match.id || idx} value={String(idx)} className="whitespace-normal">
                                      <span className="font-medium">{match.name}</span>
                                      <span className="text-muted-foreground"> — {match.address}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="min-w-0">
                                <span className="text-xs text-muted-foreground">{item.matches[0]?.address}</span>
                                <div className="text-xs text-muted-foreground/70">
                                  Wrong place? Add a city or address to the name above and search again.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!isLocation && item.note && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.note}</p>
                      )}

                      {!isLocation && item.previewFailed && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600">
                          <Link2 className="h-3.5 w-3.5 shrink-0" />
                          Couldn't read that page — the link still works, edit the title above if you like
                        </div>
                      )}

                      {item.status === "unresolved" && (
                        <div className="flex items-center gap-2 text-xs text-destructive">
                          <MapPin className="h-3.5 w-3.5" />
                          {isLocation
                            ? "No match found — try editing the name and searching again"
                            : itemType === "link"
                              ? "No usable link — paste a full https:// URL above"
                              : "Needs a title before it can be added"}
                        </div>
                      )}

                      {item.status === "error" && (
                        <div className="flex items-center gap-2 text-xs text-destructive">
                          <MapPin className="h-3.5 w-3.5" />
                          Lookup failed — try again
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="sticky bottom-4 flex justify-end">
            <Button
              size="lg"
              className="shadow-lg"
              disabled={!canImport}
              onClick={() => importMutation.mutate()}
              data-testid="button-import-pins"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Add {readyCount} {readyCount === 1 ? noun.one : noun.many}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
