import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapCard, MapCardSkeleton, type MapCollectionSummary } from "@/components/map-card";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import {
  Share2,
  LogIn,
  MapPin,
  Plus,
  Users,
  Compass,
  Sparkles,
  Building2,
  Globe2,
  HeartHandshake,
  PartyPopper,
  Landmark,
  Check,
  UserCircle,
  Archive,
  ArchiveRestore,
  ListChecks,
  Loader2,
  X,
  LayoutGrid,
  FolderTree,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { DeleteMapModal } from "@/components/delete-map-modal";
import { useState } from "react";
import { downloadPinsCsv } from "@/lib/csv-export";
import { useUsage } from "@/hooks/useUsage";
import type { UsageSummary } from "@/hooks/useUsage";
import { UsageMeter } from "@/components/usage-meter";
import { TIER_LIMITS } from "@shared/limits";
import { isUpgradeableError, upgradeToastAction } from "@/lib/upgradeToast";
import { useCreateFolder, useDeleteFolder, useFolders, useUpdateFolder } from "@/hooks/useFolders";
import { FolderBrowser } from "@/components/folder-browser";
import type { Folder } from "@shared/schema";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [deleteMapModal, setDeleteMapModal] = useState<{ isOpen: boolean; map: MapCollectionSummary | null }>({
    isOpen: false,
    map: null,
  });
  const hasMapArchiving = TIER_LIMITS[user?.userGroup ?? "freemium"].mapArchiving;

  const { data: ownedMaps = [], isLoading: isLoadingOwned } = useQuery<MapCollectionSummary[]>({
    queryKey: ["/api/maps", user?.id, "owned"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maps?ownedOnly=true");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !authLoading && !!user?.id,
  });

  const { data: contributedMaps = [], isLoading: isLoadingContributed } = useQuery<MapCollectionSummary[]>({
    queryKey: ["/api/maps", user?.id, "contributed"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maps?contributedOnly=true");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !authLoading && !!user?.id,
  });

  const { data: archivedMaps = [], isLoading: isLoadingArchived } = useQuery<MapCollectionSummary[]>({
    queryKey: ["/api/maps", user?.id, "archived"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maps?archivedOnly=true");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !authLoading && !!user?.id && hasMapArchiving,
  });

  const archiveMapsMutation = useMutation({
    mutationFn: async (mapIds: string[]) => {
      const response = await apiRequest("POST", "/api/maps/archive", { mapIds });
      return response.json() as Promise<{ archivedCount: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      toast({
        title: result.archivedCount === 1 ? "Map archived" : `${result.archivedCount} maps archived`,
        description: "Find them anytime in the Archived maps tab.",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't archive maps",
        description: error.message || "Please try again",
        variant: "destructive",
        action: isUpgradeableError(error) ? upgradeToastAction() : undefined,
      });
    },
  });

  const restoreMapsMutation = useMutation({
    mutationFn: async (mapIds: string[]) => {
      const response = await apiRequest("POST", "/api/maps/unarchive", { mapIds });
      return response.json() as Promise<{ restoredCount: number; skippedDueToLimit: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      const parts: string[] = [];
      if (result.restoredCount > 0) parts.push(`${result.restoredCount} map${result.restoredCount === 1 ? "" : "s"} restored`);
      if (result.skippedDueToLimit > 0) parts.push(`${result.skippedDueToLimit} skipped — map limit reached`);
      toast({
        title: result.restoredCount > 0 ? "Restored" : "Couldn't restore",
        description: parts.length > 0 ? `${parts.join(", ")}.` : "No maps were restored.",
        variant: result.restoredCount > 0 ? "success" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't restore maps",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleExportCsv = async (map: MapCollectionSummary) => {
    try {
      const response = await apiRequest("GET", `/api/maps/${map.shareUrl}`);
      const data = await response.json();
      const pins = data.pins || [];
      if (pins.length === 0) {
        toast({
          title: "Nothing to export",
          description: "This map doesn't have any pins yet.",
          variant: "destructive",
        });
        return;
      }
      downloadPinsCsv(pins, data.noteLabel || "Note", data.itemType);
      toast({
        title: "CSV exported",
        description: `${pins.length} pin${pins.length === 1 ? "" : "s"} exported.`,
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Couldn't export",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const totalPins = ownedMaps.reduce((sum, map) => sum + (map.pinCount || 0), 0);
  const firstName = user?.firstName || user?.fullName?.split(" ")[0];
  const { usage } = useUsage();

  const { data: folders = [] } = useFolders();
  const createFolderMutation = useCreateFolder();
  const updateFolderMutation = useUpdateFolder();
  const deleteFolderMutation = useDeleteFolder();

  const moveToFolderMutation = useMutation({
    mutationFn: async ({ mapId, folderId }: { mapId: string; folderId: string | null }) => {
      const response = await apiRequest("PUT", `/api/maps/${mapId}/details`, { folderId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't move map",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleDeleteFolder = (folder: Folder) => {
    if (
      !window.confirm(
        `Delete "${folder.name}"? Maps and subfolders inside it move back to the root level — nothing is deleted.`,
      )
    ) {
      return;
    }
    deleteFolderMutation.mutate(folder.id);
  };

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {user ? (
          <SignedInDashboard
            firstName={firstName}
            userGroup={user.userGroup}
            usage={usage}
            ownedMaps={ownedMaps}
            contributedMaps={contributedMaps}
            archivedMaps={archivedMaps}
            isLoadingOwned={isLoadingOwned}
            isLoadingContributed={isLoadingContributed}
            isLoadingArchived={isLoadingArchived}
            hasMapArchiving={hasMapArchiving}
            totalPins={totalPins}
            onCreateClick={() => setLocation("/map/new")}
            onDeleteMap={(map) => setDeleteMapModal({ isOpen: true, map })}
            onExportCsv={handleExportCsv}
            onArchiveMaps={(mapIds) => archiveMapsMutation.mutate(mapIds)}
            onRestoreMaps={(mapIds) => restoreMapsMutation.mutate(mapIds)}
            isArchiving={archiveMapsMutation.isPending}
            isRestoring={restoreMapsMutation.isPending}
            restoringIds={restoreMapsMutation.isPending ? restoreMapsMutation.variables ?? [] : []}
            folders={folders}
            onCreateFolder={(name, parentFolderId) => createFolderMutation.mutate({ name, parentFolderId })}
            onRenameFolder={(folderId, name) => updateFolderMutation.mutate({ folderId, data: { name } })}
            onDeleteFolder={handleDeleteFolder}
            onMoveToFolder={(map, folderId) => moveToFolderMutation.mutate({ mapId: map.id, folderId })}
          />
        ) : (
          <AnonymousLanding />
        )}

        <UseCasesSection showCta={!user} />
      </main>

      {/* Delete Map Modal */}
      {deleteMapModal.map && (
        <DeleteMapModal
          isOpen={deleteMapModal.isOpen}
          onClose={() => setDeleteMapModal({ isOpen: false, map: null })}
          mapCollection={deleteMapModal.map}
          canArchive={hasMapArchiving}
          onArchive={(mapId) => archiveMapsMutation.mutate([mapId])}
          isArchiving={archiveMapsMutation.isPending}
        />
      )}
    </>
  );
}

interface SignedInDashboardProps {
  firstName?: string;
  userGroup: string;
  usage?: UsageSummary;
  ownedMaps: MapCollectionSummary[];
  contributedMaps: MapCollectionSummary[];
  archivedMaps: MapCollectionSummary[];
  isLoadingOwned: boolean;
  isLoadingContributed: boolean;
  isLoadingArchived: boolean;
  hasMapArchiving: boolean;
  totalPins: number;
  onCreateClick: () => void;
  onDeleteMap: (map: MapCollectionSummary) => void;
  onExportCsv: (map: MapCollectionSummary) => void;
  onArchiveMaps: (mapIds: string[]) => void;
  onRestoreMaps: (mapIds: string[]) => void;
  isArchiving: boolean;
  isRestoring: boolean;
  restoringIds: string[];
  folders: Folder[];
  onCreateFolder: (name: string, parentFolderId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folder: Folder) => void;
  onMoveToFolder: (map: MapCollectionSummary, folderId: string | null) => void;
}

function SignedInDashboard({
  firstName,
  userGroup,
  usage,
  ownedMaps,
  contributedMaps,
  archivedMaps,
  isLoadingOwned,
  isLoadingContributed,
  isLoadingArchived,
  hasMapArchiving,
  totalPins,
  onCreateClick,
  onDeleteMap,
  onExportCsv,
  onArchiveMaps,
  onRestoreMaps,
  isArchiving,
  isRestoring,
  restoringIds,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder,
}: SignedInDashboardProps) {
  const [ownedSelectMode, setOwnedSelectMode] = useState(false);
  const [selectedOwnedIds, setSelectedOwnedIds] = useState<Set<string>>(new Set());
  const [archivedSelectMode, setArchivedSelectMode] = useState(false);
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<Set<string>>(new Set());
  const [ownedViewMode, setOwnedViewMode] = useState<"flat" | "folder">("flat");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [mapSortBy, setMapSortBy] = useState<"created" | "pins" | "alpha">("created");

  const visibleOwnedMaps = ownedMaps
    .filter((map) => map.name.toLowerCase().includes(mapSearchQuery.trim().toLowerCase()))
    .sort((a, b) => {
      if (mapSortBy === "alpha") return a.name.localeCompare(b.name);
      if (mapSortBy === "pins") return b.pinCount - a.pinCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const renderOwnedMapGrid = (maps: MapCollectionSummary[]) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {maps.map((map) => (
        <MapCard
          key={map.id}
          map={map}
          role="owner"
          onDelete={onDeleteMap}
          onExportCsv={onExportCsv}
          selectable={ownedSelectMode}
          selected={selectedOwnedIds.has(map.id)}
          onToggleSelected={toggleOwnedSelected}
          folders={folders}
          onMoveToFolder={onMoveToFolder}
        />
      ))}
    </div>
  );

  const toggleOwnedSelected = (map: MapCollectionSummary) => {
    setSelectedOwnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(map.id)) next.delete(map.id);
      else next.add(map.id);
      return next;
    });
  };

  const toggleArchivedSelected = (map: MapCollectionSummary) => {
    setSelectedArchivedIds((prev) => {
      const next = new Set(prev);
      if (next.has(map.id)) next.delete(map.id);
      else next.add(map.id);
      return next;
    });
  };

  const handleArchiveSelected = () => {
    if (selectedOwnedIds.size === 0) return;
    onArchiveMaps(Array.from(selectedOwnedIds));
    setSelectedOwnedIds(new Set());
    setOwnedSelectMode(false);
  };

  const handleRestoreSelected = () => {
    if (selectedArchivedIds.size === 0) return;
    onRestoreMaps(Array.from(selectedArchivedIds));
    setSelectedArchivedIds(new Set());
    setArchivedSelectMode(false);
  };
  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="text-muted-foreground mt-1">Manage your maps and see where your community is gathering.</p>
        </div>
        <Button onClick={onCreateClick} size="lg" className="sm:w-auto w-full" data-testid="button-create-map">
          <Plus className="h-4 w-4 mr-2" />
          Create new map
        </Button>
      </div>

      <PlanSummaryCard userGroup={userGroup} usage={usage} />
      <PendingApprovalsBanner maps={ownedMaps} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-10">
        <StatTile label="Maps created" value={ownedMaps.length} icon={<MapPin className="h-4 w-4" />} />
        <StatTile label="Total pins" value={totalPins} icon={<Sparkles className="h-4 w-4" />} />
        <StatTile
          label="Contributing to"
          value={contributedMaps.length}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Maps management */}
      <Tabs defaultValue="owned" className="w-full">
        <TabsList>
          <TabsTrigger value="owned" data-testid="tab-my-maps">
            My maps {ownedMaps.length > 0 && `(${ownedMaps.length})`}
          </TabsTrigger>
          <TabsTrigger value="contributed" data-testid="tab-contributed-maps">
            Contributed {contributedMaps.length > 0 && `(${contributedMaps.length})`}
          </TabsTrigger>
          {hasMapArchiving && (
            <TabsTrigger value="archived" data-testid="tab-archived-maps">
              Archived {archivedMaps.length > 0 && `(${archivedMaps.length})`}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="owned" className="mt-6">
          {isLoadingOwned ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <MapCardSkeleton key={i} />
              ))}
            </div>
          ) : ownedMaps.length === 0 ? (
            <EmptyState
              icon={<MapPin className="h-8 w-8" />}
              title="No maps yet"
              description="Create your first map to start collecting pins from your community."
              action={
                <Button onClick={onCreateClick} data-testid="button-create-first-map">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first map
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={mapSearchQuery}
                      onChange={(e) => setMapSearchQuery(e.target.value)}
                      placeholder="Search your maps…"
                      className="pl-9 pr-8 h-9 w-full"
                      data-testid="input-search-maps"
                    />
                    {mapSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMapSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Clear search"
                        data-testid="button-clear-map-search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <Select value={mapSortBy} onValueChange={(v) => setMapSortBy(v as typeof mapSortBy)}>
                    <SelectTrigger className="h-9 w-36 sm:w-40 shrink-0" data-testid="select-map-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created">Recently created</SelectItem>
                      <SelectItem value="alpha">Alphabetical</SelectItem>
                      <SelectItem value="pins">Most pins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <ToggleGroup
                    type="single"
                    value={ownedViewMode}
                    onValueChange={(value) => value && setOwnedViewMode(value as "flat" | "folder")}
                    className="bg-muted rounded-lg p-1 justify-start shrink-0"
                  >
                    <ToggleGroupItem
                      value="flat"
                      size="sm"
                      className="data-[state=on]:bg-card data-[state=on]:shadow-sm rounded-md px-3"
                      data-testid="button-view-mode-flat"
                    >
                      <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                      Flat
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="folder"
                      size="sm"
                      className="data-[state=on]:bg-card data-[state=on]:shadow-sm rounded-md px-3"
                      data-testid="button-view-mode-folder"
                    >
                      <FolderTree className="h-3.5 w-3.5 mr-1.5" />
                      Folders
                    </ToggleGroupItem>
                  </ToggleGroup>

                  {hasMapArchiving && (
                    <div className="flex items-center gap-2 shrink-0">
                      {ownedSelectMode && selectedOwnedIds.size > 0 && (
                        <>
                          <span className="text-sm font-medium text-foreground whitespace-nowrap">
                            {selectedOwnedIds.size} selected
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleArchiveSelected}
                            disabled={isArchiving}
                            data-testid="button-archive-selected"
                          >
                            {isArchiving ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Archive className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Archive selected
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOwnedSelectMode((prev) => !prev);
                          setSelectedOwnedIds(new Set());
                        }}
                        data-testid="button-toggle-owned-select-mode"
                      >
                        {ownedSelectMode ? (
                          <>
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                            Select
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {visibleOwnedMaps.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-8 w-8" />}
                  title="No maps match your search"
                  description={`Nothing in "My maps" matches "${mapSearchQuery}".`}
                  action={
                    <Button variant="outline" onClick={() => setMapSearchQuery("")} data-testid="button-clear-map-search-empty">
                      Clear search
                    </Button>
                  }
                />
              ) : ownedViewMode === "flat" ? (
                renderOwnedMapGrid(visibleOwnedMaps)
              ) : (
                <FolderBrowser
                  folders={folders}
                  maps={visibleOwnedMaps}
                  onCreate={onCreateFolder}
                  onRename={onRenameFolder}
                  onDelete={onDeleteFolder}
                  renderMaps={renderOwnedMapGrid}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="contributed" className="mt-6">
          {isLoadingContributed ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <MapCardSkeleton key={i} />
              ))}
            </div>
          ) : contributedMaps.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No contributions yet"
              description="Once you add a pin to someone else's shared map, it'll show up here."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {contributedMaps.map((map) => (
                <MapCard key={map.id} map={map} role="contributor" />
              ))}
            </div>
          )}
        </TabsContent>

        {hasMapArchiving && (
          <TabsContent value="archived" className="mt-6">
            {isLoadingArchived ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <MapCardSkeleton key={i} />
                ))}
              </div>
            ) : archivedMaps.length === 0 ? (
              <EmptyState
                icon={<Archive className="h-8 w-8" />}
                title="No archived maps"
                description="Archived maps are hidden from your home page and public profile, but never deleted — restore one anytime."
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 mb-4">
                  {archivedSelectMode && selectedArchivedIds.size > 0 ? (
                    <span className="text-sm font-medium text-foreground">
                      {selectedArchivedIds.size} selected
                    </span>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    {archivedSelectMode && selectedArchivedIds.size > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRestoreSelected}
                        disabled={isRestoring}
                        data-testid="button-restore-selected"
                      >
                        {isRestoring ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Restore selected
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setArchivedSelectMode((prev) => !prev);
                        setSelectedArchivedIds(new Set());
                      }}
                      data-testid="button-toggle-archived-select-mode"
                    >
                      {archivedSelectMode ? (
                        <>
                          <X className="h-3.5 w-3.5 mr-1.5" />
                          Cancel
                        </>
                      ) : (
                        <>
                          <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                          Select
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {archivedMaps.map((map) => (
                    <MapCard
                      key={map.id}
                      map={map}
                      role="owner"
                      archived
                      onRestore={(m) => onRestoreMaps([m.id])}
                      isRestoring={restoringIds.includes(map.id)}
                      selectable={archivedSelectMode}
                      selected={selectedArchivedIds.has(map.id)}
                      onToggleSelected={toggleArchivedSelected}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

const TIER_LABELS: Record<string, string> = { freemium: "Free", basic: "Basic", premium: "Premium" };

/** Ambient plan/usage nudge — the dashboard is the highest-traffic page for a signed-in user, and the only place today that had zero awareness of the account's tier or how close it is to a limit. Renders nothing for premium (unlimited on both fronts, nothing to nudge). */
function PlanSummaryCard({ userGroup, usage }: { userGroup: string; usage?: UsageSummary }) {
  if (userGroup === "premium") return null;

  return (
    <Card className="mb-8" data-testid="card-plan-summary">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <Badge variant="secondary" data-testid="badge-current-tier">
            {TIER_LABELS[userGroup] ?? userGroup} plan
          </Badge>
          <Link href="/pricing" className="text-sm font-medium text-primary hover:underline" data-testid="link-dashboard-upgrade">
            Upgrade →
          </Link>
        </div>
        {usage && (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <UsageMeter label="Maps" used={usage.maps.used} limit={usage.maps.limit} />
            <UsageMeter label="AI suggestions today" used={usage.aiSuggestions.used} limit={usage.aiSuggestions.limit} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Surfaces owned maps with pins awaiting approval — otherwise invisible until the owner opens each map individually. Renders nothing when there's nothing pending. */
function PendingApprovalsBanner({ maps }: { maps: MapCollectionSummary[] }) {
  const [expanded, setExpanded] = useState(false);
  const mapsWithPending = maps.filter((map) => (map.pendingPinCount ?? 0) > 0);
  const totalPending = mapsWithPending.reduce((sum, map) => sum + (map.pendingPinCount ?? 0), 0);

  if (totalPending === 0) return null;

  return (
    <Card className="mb-8 border-amber-300 bg-amber-50/60" data-testid="card-pending-approvals">
      <CardContent className="p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 text-left"
          data-testid="button-toggle-pending-approvals"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-amber-900">
            <Clock className="h-4 w-4 shrink-0" />
            {totalPending} pin{totalPending === 1 ? "" : "s"} waiting for approval across {mapsWithPending.length}{" "}
            {mapsWithPending.length === 1 ? "map" : "maps"}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-amber-700 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-amber-700 shrink-0" />
          )}
        </button>
        {expanded && (
          <div className="mt-3 space-y-1 border-t border-amber-200 pt-3 max-h-56 overflow-y-auto">
            {mapsWithPending.map((map) => (
              <Link
                key={map.id}
                href={`/map/${map.shareUrl}?pinFilter=pending`}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-amber-100 transition-colors"
                data-testid={`link-pending-map-${map.id}`}
              >
                <span className="truncate text-foreground">{map.name}</span>
                <span className="shrink-0 text-amber-700">
                  {map.pendingPinCount} pending →
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl border border-dashed border-border bg-muted/30">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-5">{description}</p>
      {action}
    </div>
  );
}

function AnonymousLanding() {
  return (
    <div className="animate-fade-in">
      <div className="text-center py-10 sm:py-16">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Collaborative maps, made simple
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-5 max-w-3xl mx-auto">
          Gather what matters, one pin at a time.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Create a shared map and invite your community. Each person can mark where they are, or search Google Maps
          to drop a pin on a specific venue — then everyone sees it all in one place.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/auth">
            <Button size="lg" className="px-8" data-testid="button-get-started">
              <LogIn className="h-4 w-4 mr-2" />
              Get started — it's free
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto mb-4">
        <HowItWorksStep
          step={1}
          icon={<Plus className="h-5 w-5" />}
          title="Create a map"
          description="Name it, describe it, done. No setup, no credit card."
        />
        <HowItWorksStep
          step={2}
          icon={<Share2 className="h-5 w-5" />}
          title="Everyone adds a pin"
          description="Contributors mark their own location, or search for a specific venue — restaurant, cafe, landmark, anywhere."
        />
        <HowItWorksStep
          step={3}
          icon={<Check className="h-5 w-5" />}
          title="Approve what's public"
          description="Review pins from your community and approve the ones you want to keep."
        />
        <HowItWorksStep
          step={4}
          icon={<UserCircle className="h-5 w-5" />}
          title="Curate your profile"
          description="Pick which maps show up on your own public profile page."
        />
      </div>
    </div>
  );
}

function HowItWorksStep({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
          <span className="text-xs font-semibold text-muted-foreground">STEP {step}</span>
        </div>
        <h3 className="font-semibold text-foreground mb-1.5">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

const USE_CASES = [
  {
    icon: Building2,
    title: "Distributed teams",
    description: "Map where colleagues are based and build stronger connections across offices and time zones.",
  },
  {
    icon: Globe2,
    title: "Digital nomads",
    description: "Share coworking spaces, cafes, and meetup spots with a globally scattered community.",
  },
  {
    icon: HeartHandshake,
    title: "Families & friends",
    description: "Keep everyone connected across cities — homes, hangouts, and the places that matter.",
  },
  {
    icon: Compass,
    title: "Clubs & communities",
    description: "Map club venues, event spaces, and member meetup spots around shared interests.",
  },
  {
    icon: Landmark,
    title: "Brand locations",
    description: "Showcase franchise or store locations and let customers share their favourites.",
  },
  {
    icon: PartyPopper,
    title: "Event planning",
    description: "Coordinate venues, accommodation, and local tips for weddings, reunions, and conferences.",
  },
];

function UseCasesSection({ showCta }: { showCta: boolean }) {
  return (
    <div className="mt-16 mb-8">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
          Built for every kind of community
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Some communities map where people are. Others map the places they love. Many do both.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
        {USE_CASES.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="border-border hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showCta && (
        <div className="text-center mt-12">
          <Link href="/auth">
            <Button size="lg" className="px-8" data-testid="button-get-started-footer">
              <LogIn className="h-4 w-4 mr-2" />
              Get started free
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
