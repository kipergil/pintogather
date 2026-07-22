import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { searchVenues, buildGoogleMapsUrl, type VenueResult } from "@/lib/google-maps";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  ClipboardPaste,
  FileUp,
  Loader2,
  MapPin,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

interface ImportPinsProps {
  params: {
    shareUrl: string;
  };
}

interface ImportItem {
  id: string;
  name: string;
  status: "idle" | "searching" | "found" | "not_found" | "error";
  matches: VenueResult[];
  selectedIndex: number;
}

function parseTextLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter((line) => line.length > 0);
}

async function parseFile(file: File): Promise<string[]> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows
      .map((row) => row[0])
      .filter((cell): cell is string => typeof cell === "string" && cell.trim().length > 0)
      .map((cell) => cell.trim());
  }

  return parseTextLines(await file.text());
}

// Runs `fn` over `items` with limited concurrency, calling `onItem` as each finishes.
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

export default function ImportPins({ params }: ImportPinsProps) {
  const { shareUrl } = params;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<ImportItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSearchingAll, setIsSearchingAll] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [pasteText, setPasteText] = useState("");

  const updateItem = useCallback((id: string, patch: Partial<ImportItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const searchItem = useCallback(async (id: string, query: string) => {
    updateItem(id, { status: "searching" });
    try {
      const matches = await searchVenues(query);
      if (matches.length === 0) {
        updateItem(id, { status: "not_found", matches: [] });
        return;
      }
      updateItem(id, {
        status: "found",
        matches: matches.slice(0, 5),
        selectedIndex: 0,
        name: matches[0].name || query,
      });
    } catch (error: any) {
      const isZeroResults = typeof error?.message === "string" && error.message.includes("ZERO_RESULTS");
      updateItem(id, { status: isZeroResults ? "not_found" : "error", matches: [] });
    }
  }, [updateItem]);

  const startImportFromNames = (names: string[]) => {
    if (names.length === 0) {
      toast({
        title: "No venue names found",
        description: "Didn't find any readable rows to import.",
        variant: "destructive",
      });
      return;
    }
    const newItems: ImportItem[] = names.map((name) => ({
      id: nanoid(),
      name,
      status: "idle",
      matches: [],
      selectedIndex: 0,
    }));
    setItems(newItems);
    searchAll(newItems);
  };

  const handleFile = async (file: File) => {
    setIsParsing(true);
    try {
      startImportFromNames(await parseFile(file));
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

  const handlePasteImport = () => {
    startImportFromNames(parseTextLines(pasteText));
  };

  const searchAll = async (list: ImportItem[]) => {
    setIsSearchingAll(true);
    setSearchProgress(0);
    let done = 0;
    await runWithConcurrency(list, 3, async (item) => {
      await searchItem(item.id, item.name);
      done += 1;
      setSearchProgress(done);
    });
    setIsSearchingAll(false);
  };

  const retryFailed = () => {
    const failed = items.filter((item) => item.status === "not_found" || item.status === "error");
    searchAll(failed);
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

  const importMutation = useMutation({
    mutationFn: async () => {
      const pins = items
        .filter((item) => item.status === "found" && item.matches.length > 0)
        .map((item) => {
          const match = item.matches[item.selectedIndex] ?? item.matches[0];
          return {
            userName: item.name.trim() || match.name,
            latitude: String(match.lat),
            longitude: String(match.lng),
            address: match.address || null,
            googleMapsUrl: buildGoogleMapsUrl({ lat: match.lat, lng: match.lng, name: match.name, address: match.address, placeId: match.id }),
          };
        });
      const response = await apiRequest("POST", `/api/maps/${shareUrl}/pins/bulk`, { pins });
      return response.json();
    },
    onSuccess: (created) => {
      toast({
        title: "Import complete",
        description: `${created.length} pin${created.length === 1 ? "" : "s"} added to the map.`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      setLocation(`/map/${shareUrl}`);
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import pins",
        variant: "destructive",
      });
    },
  });

  const foundCount = items.filter((item) => item.status === "found").length;
  const notFoundCount = items.filter((item) => item.status === "not_found" || item.status === "error").length;
  const canImport = foundCount > 0 && !isSearchingAll && !importMutation.isPending;

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
            <h2 className="text-lg font-semibold text-foreground mb-2">Sign in to import pins</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Bulk-importing a list of venues requires an account so the pins are attributed to you.
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

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Import pins from a list</h1>
          <p className="text-muted-foreground mt-1">
            Upload venue names and we'll look each one up on Google Maps.
          </p>
        </div>
        <Link href={`/map/${shareUrl}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to map
          </Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <FileUp className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1.5">Upload a list of venue names</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
              A .txt or .csv file with one venue name per line, or an .xlsx spreadsheet with names in the first
              column.
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

            <div className="flex items-center gap-3 max-w-sm mx-auto my-6">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or paste a list</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="max-w-sm mx-auto text-left space-y-2">
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Paste venue names, one per line —\nEiffel Tower\nBritish Museum\nColosseum"}
                rows={5}
                className="text-sm"
                data-testid="input-paste-venues"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={handlePasteImport}
                disabled={!pasteText.trim()}
                data-testid="button-import-pasted"
              >
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Import pasted list
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">
              {isSearchingAll ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up venues... ({searchProgress}/{items.length})
                </span>
              ) : (
                <span>
                  <span className="font-medium text-foreground">{items.length}</span> venues ·{" "}
                  <span className="font-medium text-emerald-600">{foundCount} matched</span>
                  {notFoundCount > 0 && (
                    <>
                      {" "}
                      · <span className="font-medium text-destructive">{notFoundCount} not found</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notFoundCount > 0 && !isSearchingAll && (
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

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(item.id, { name: e.target.value })}
                          className="h-9"
                          data-testid={`input-item-name-${item.id}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => searchItem(item.id, item.name)}
                          disabled={item.status === "searching" || !item.name.trim()}
                          title="Search again"
                          data-testid={`button-search-item-${item.id}`}
                        >
                          {item.status === "searching" ? (
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

                      {item.status === "found" && (
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          {item.matches.length > 1 ? (
                            <Select
                              value={String(item.selectedIndex)}
                              onValueChange={(value) => {
                                const idx = Number(value);
                                updateItem(item.id, { selectedIndex: idx, name: item.matches[idx].name });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs flex-1" data-testid={`select-match-${item.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {item.matches.map((match, idx) => (
                                  <SelectItem key={match.id || idx} value={String(idx)}>
                                    {match.name} — {match.address}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">{item.matches[0]?.address}</span>
                          )}
                        </div>
                      )}

                      {item.status === "not_found" && (
                        <div className="flex items-center gap-2 text-xs text-destructive">
                          <MapPin className="h-3.5 w-3.5" />
                          No match found — try editing the name and searching again
                        </div>
                      )}

                      {item.status === "error" && (
                        <div className="flex items-center gap-2 text-xs text-destructive">
                          <MapPin className="h-3.5 w-3.5" />
                          Search failed — try again
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
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {foundCount} pin{foundCount === 1 ? "" : "s"}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
