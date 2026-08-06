import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { isUpgradeableError, upgradeToastAction } from "@/lib/upgradeToast";
import { useUsage } from "@/hooks/useUsage";
import { UsageMeter } from "@/components/usage-meter";
import { searchVenues, buildGoogleMapsUrl, type VenueResult } from "@/lib/google-maps";
import { getPrimaryVenueType } from "@/lib/venue-type";
import { TIER_LIMITS } from "@shared/limits";
import type { ItemType, PinColor, PinIcon } from "@shared/enums";
import {
  ITEM_NOUN,
  looksLikeUrl,
  hostnameOf,
  parseFile,
  parseText,
  type ItemSeed,
} from "@/lib/item-parsing";
import {
  ImageDropzone,
  MAX_IMAGES,
  type ClipboardReadFailure,
  type ImageRejection,
} from "@/components/image-dropzone";
import { AddMethodPicker, methodTitle, parseMethodParam, type AddMethod } from "@/components/add-method-picker";
import { PlacesSearch } from "@/components/places-search";
import { SimpleGoogleMap } from "@/components/simple-google-map";
import { hasCoordinates } from "@shared/geo";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  ClipboardPaste,
  FileUp,
  ImageUp,
  Link2,
  Loader2,
  MapPin,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

interface AddItemsProps {
  params: {
    shareUrl: string;
  };
}

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

/** Just enough of the collection for the hub: how to parse/resolve, and enough to render the embedded drop-a-pin map. */
interface MapForAdding {
  id: string;
  name: string;
  shareUrl: string;
  itemType: ItemType;
  noteLabel?: string | null;
  notePrompt?: string | null;
  hasPinCustomization?: boolean;
  defaultPinColor?: PinColor | null;
  defaultPinIcon?: PinIcon | null;
  /** Existing pins, drawn on the embedded map for context so a dropped spot can be placed relative to them. */
  pins: Array<{
    id: string;
    title: string;
    latitude: string | null;
    longitude: string | null;
    address?: string;
    note?: string;
    googleMapsUrl?: string | null;
    photoUrl?: string | null;
    approved?: boolean;
    pinColor?: PinColor | null;
    pinIcon?: PinIcon | null;
    sequence?: number | null;
    createdAt: string;
  }>;
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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { usage } = useUsage();
  const aiLimitReached = usage ? usage.aiSuggestions.used >= usage.aiSuggestions.limit : false;
  const hasScreenshotImport = TIER_LIMITS[user?.userGroup ?? "freemium"].screenshotImport;

  // What this collection holds decides how pasted text is parsed, how each
  // item resolves, and what gets sent to the bulk endpoint.
  const { data: mapCollection } = useQuery<MapForAdding>({
    queryKey: [`/api/maps/${shareUrl}`],
  });
  const itemType: ItemType = mapCollection?.itemType ?? "location";
  const noun = ITEM_NOUN[itemType];
  const isLocation = itemType === "location";
  // The chosen method lives in the URL, not component state, so the browser's
  // own back button steps back to the picker and a deep link (from the map
  // page's empty state or toolbar) opens straight into a method.
  const method = parseMethodParam(searchParams.get("method"), itemType);

  const goToMethod = (next: AddMethod | undefined) => {
    const params = new URLSearchParams(search);
    if (next) params.set("method", next);
    else params.delete("method");
    const query = params.toString();
    setLocation(`/map/${shareUrl}/add${query ? `?${query}` : ""}`);
  };

  const [items, setItems] = useState<StagedItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isResolvingAll, setIsResolvingAll] = useState(false);
  const [resolveProgress, setResolveProgress] = useState(0);
  const [pasteText, setPasteText] = useState("");
  /** The "add one at a time" form — cleared after each one so the next can be typed straight in. */
  const [oneName, setOneName] = useState("");
  const [oneUrl, setOneUrl] = useState("");
  const [oneNote, setOneNote] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [images, setImages] = useState<File[]>([]);
  /** Optional context sent alongside the images — kept apart from `aiPrompt` so switching methods doesn't carry one into the other. */
  const [imagePrompt, setImagePrompt] = useState("");

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
    // Appended, not replaced: the method tabs stay open, so a paste can be
    // topped up with a venue search or a dropped pin before saving.
    setItems((prev) => [...prev, ...staged]);
    resolveAll(staged);
  };

  /**
   * Venue search and map-drop already know exactly which place they mean, so
   * they enter the list resolved rather than going back out to Places.
   */
  const stageResolvedVenue = (match: VenueResult, title?: string) => {
    setItems((prev) => [
      ...prev,
      {
        id: nanoid(),
        name: title ?? match.name,
        url: "",
        note: "",
        photoUrl: null,
        status: "resolved" as const,
        matches: [match],
        selectedIndex: 0,
      },
    ]);
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

  const extractFromImagesMutation = useMutation({
    mutationFn: async ({ files, prompt }: { files: File[]; prompt: string }) => {
      const response = await apiUpload(
        `/api/maps/${shareUrl}/extract-items`,
        files,
        prompt ? { prompt } : undefined,
      );
      return response.json() as Promise<ExtractResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/usage"], (old: any) => (old ? { ...old, aiSuggestions: data.usage } : old));
      setImages([]);
      setImagePrompt("");
      startStaging(seedsFromResponse(data));
    },
    onError: onGenerateError,
  });

  /** Explains anything the dropzone refused, rather than letting it vanish silently. */
  const reportRejections = (rejections: ImageRejection[]) => {
    const first = rejections[0];
    const description =
      first.reason === "type"
        ? "Only PNG, JPEG, WebP, and GIF images can be read."
        : first.reason === "size"
          ? "Images need to be under 4MB each."
          : "You can attach up to 4 images at a time.";
    toast({
      title: rejections.length === 1 ? `Skipped ${first.name}` : `Skipped ${rejections.length} files`,
      description,
      variant: "destructive",
    });
  };

  /** Explains why the Paste button came back with nothing, rather than looking broken. */
  const reportClipboardFailure = (reason: ClipboardReadFailure) => {
    toast({
      title: reason === "empty" ? "No image on the clipboard" : "Couldn't read the clipboard",
      description:
        reason === "empty"
          ? "Copy a screenshot or photo first, then try again."
          : reason === "denied"
            ? "Your browser blocked clipboard access — allow it, or use the upload button instead."
            : "This browser won't let us read the clipboard. Use the upload button instead.",
      variant: "destructive",
    });
  };

  const handleGenerateSuggestions = () => {
    if (!aiPrompt.trim()) return;
    generateSuggestionsMutation.mutate(aiPrompt.trim());
  };

  /**
   * Stages one hand-typed item. Goes through startStaging like every other
   * method, so a link still gets its title and image fetched, and the entry
   * lands in the same review list rather than saving straight away.
   */
  const addOne = () => {
    const name = oneName.trim();
    const url = oneUrl.trim();
    if (!name && !url) return;
    startStaging([{ name, url, note: oneNote.trim() }]);
    setOneName("");
    setOneUrl("");
    setOneNote("");
  };

  const handleExtractFromImages = () => {
    if (images.length === 0) return;
    extractFromImagesMutation.mutate({ files: images, prompt: imagePrompt.trim() });
  };

  const isGenerating = generateSuggestionsMutation.isPending || extractFromImagesMutation.isPending;

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
                Back to collection
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
      <div className="space-y-3">
        {/* Above the title rather than beside it: at phone width a
            right-aligned button sat mid-paragraph and collided with the
            wrapped description. */}
        <Link href={`/map/${shareUrl}`}>
          <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {isFirstRun ? "Skip for now" : "Back to collection"}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isFirstRun ? `Add your first ${noun.many}` : "Add items"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLocation
              ? "Paste a list, hand us a screenshot, upload a file, or let AI suggest places — we'll look each one up on Google Maps."
              : itemType === "link"
                ? "Paste links, hand us a screenshot, upload a file, or let AI suggest pages — we'll fetch a title and image for each."
                : "Paste a list, hand us a screenshot, upload a file, or let AI suggest things to recommend."}
          </p>
        </div>
      </div>

      {method === undefined ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="p-5 sm:p-8">
            <AddMethodPicker itemType={itemType} onSelect={goToMethod} />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="p-5 sm:p-8">
            <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground truncate">{methodTitle(method)}</h2>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={() => goToMethod(undefined)}
                data-testid="button-change-method"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Another way
              </Button>
            </div>

            {method === "file" && (
              <div className="text-center">
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

                {/* Pictures have their own method now — pointing at it beats a
                    second, differently-shaped uploader bolted on down here. */}
                <p className="text-xs text-muted-foreground mt-5">
                  Got a picture instead?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => goToMethod("image")}
                    data-testid="link-to-image-method"
                  >
                    Add from a screenshot or photo
                  </button>
                  .
                </p>
              </div>
            )}

            {method === "one" && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <PenLine className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">Add one at a time</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  {itemType === "link"
                    ? "Paste a URL and we'll fetch the title, description, and image. Each one joins the list below — keep going, then save them together."
                    : "Type it in yourself. Each one joins the list below — keep going, then save them together."}
                </p>
                <div className="max-w-sm mx-auto text-left space-y-2">
                  {itemType === "link" && (
                    <Input
                      value={oneUrl}
                      onChange={(e) => setOneUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addOne()}
                      placeholder="https://…"
                      className="text-sm"
                      data-testid="input-one-url"
                    />
                  )}
                  <Input
                    value={oneName}
                    onChange={(e) => setOneName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addOne()}
                    placeholder={itemType === "link" ? "Title (optional — we'll fetch it)" : `Name of the ${noun.one}`}
                    className="text-sm"
                    data-testid="input-one-name"
                  />
                  <Textarea
                    value={oneNote}
                    onChange={(e) => setOneNote(e.target.value)}
                    placeholder={mapCollection?.notePrompt || "Note (optional)"}
                    rows={2}
                    className="text-sm"
                    data-testid="input-one-note"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={addOne}
                    disabled={!oneName.trim() && !oneUrl.trim()}
                    data-testid="button-add-one"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add to the list
                  </Button>
                </div>
              </div>
            )}

            {method === "paste" && (
              <div className="text-center">
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

                  <p className="text-xs text-muted-foreground pt-1">
                    Copied a screenshot rather than text?{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => goToMethod("image")}
                      data-testid="link-to-image-method-from-paste"
                    >
                      Paste it as an image
                    </button>
                    .
                  </p>
                </div>
              </div>
            )}

            {method === "ai" && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">Generate suggestions with AI</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  Describe a theme and we'll suggest up to 15 {noun.many} for you to review before adding.
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
                        placeholder={aiPlaceholder}
                        rows={3}
                        className="text-sm"
                        data-testid="input-ai-prompt"
                      />

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleGenerateSuggestions}
                        disabled={!aiPrompt.trim() || isGenerating}
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
              </div>
            )}

            {method === "image" && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <ImageUp className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">Add from a screenshot or photo</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  Upload or paste up to {MAX_IMAGES} pictures — a chat, a post, a photo of a menu — and AI reads the{" "}
                  {noun.many} out of them for you to review before adding.
                </p>
                <div className="max-w-sm mx-auto text-left space-y-3">
                  {usage && (
                    <UsageMeter
                      label="AI generations today"
                      used={usage.aiSuggestions.used}
                      limit={usage.aiSuggestions.limit}
                    />
                  )}
                  {!hasScreenshotImport ? (
                    <div
                      className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground"
                      data-testid="screenshot-locked-notice"
                    >
                      <ImageUp className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">Reading pictures isn't available on your plan.</span>
                      <Link href="/pricing" className="font-medium text-primary hover:underline shrink-0">
                        Upgrade
                      </Link>
                    </div>
                  ) : aiLimitReached ? (
                    <div
                      className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground"
                      data-testid="image-limit-locked-notice"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">
                        You've used today's AI generations on the {usage?.userGroup ?? "current"} plan.
                      </span>
                      <Link href="/pricing" className="font-medium text-primary hover:underline shrink-0">
                        Upgrade
                      </Link>
                    </div>
                  ) : (
                    <>
                      <ImageDropzone
                        images={images}
                        onChange={setImages}
                        onRejected={reportRejections}
                        onClipboardError={reportClipboardFailure}
                        disabled={isGenerating}
                        testId="image-dropzone"
                      />

                      <Textarea
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        placeholder={
                          isLocation
                            ? "Optional — anything that helps, e.g. \"these are all in Lisbon\""
                            : "Optional — anything that helps us read the picture"
                        }
                        rows={2}
                        className="text-sm"
                        data-testid="input-image-prompt"
                      />

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleExtractFromImages}
                        disabled={images.length === 0 || isGenerating}
                        data-testid="button-extract-from-images"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Reading {images.length === 1 ? "image" : "images"}...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {images.length > 0
                              ? `Read ${images.length} image${images.length === 1 ? "" : "s"} with AI`
                              : "Read with AI"}
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {method === "venue" && (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">Search for a venue</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  Look one up and it joins the list below — keep going to add as many as you like, then save
                  them together.
                </p>
                <div className="max-w-sm mx-auto text-left">
                  <PlacesSearch
                    placeholder="Search for a place…"
                    onPlaceSelect={(place) =>
                      stageResolvedVenue({
                        id: place.placeId,
                        name: place.name,
                        address: place.address,
                        lat: place.lat,
                        lng: place.lng,
                        types: place.venueType ? [place.venueType] : [],
                        priceLevel: place.priceLevel ?? undefined,
                      })
                    }
                  />
                </div>
                  </div>
            )}

            {method === "map" && (
              <div>
                <div className="text-center mb-4">
                  <h3 className="text-base font-semibold text-foreground mb-1.5">Drop a pin on the map</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Turn on &ldquo;Add pin&rdquo;, click a spot, and confirm it. Each one joins the list below
                    instead of saving straight away, so you can name them before they land.
                  </p>
                </div>
                {mapCollection && (
                  <SimpleGoogleMap
                    mapCollection={{
                      ...mapCollection,
                      pins: mapCollection.pins.filter(hasCoordinates),
                    }}
                    onStageLocation={({ lat, lng, address }) =>
                      stageResolvedVenue(
                        { id: "", name: address ?? "Dropped pin", address: address ?? "", lat, lng, types: [] },
                        "",
                      )
                    }
                  />
                    )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
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
