import { useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { DeleteMapModal } from "@/components/delete-map-modal";
import { useState } from "react";
import { downloadPinsCsv } from "@/lib/csv-export";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteMapModal, setDeleteMapModal] = useState<{ isOpen: boolean; map: MapCollectionSummary | null }>({
    isOpen: false,
    map: null,
  });

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

  const handleCopyMapUrl = async (map: MapCollectionSummary) => {
    try {
      const url = `${window.location.origin}/map/${map.shareUrl}`;
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: `Share link for "${map.name}" copied to clipboard`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Couldn't copy link",
        description: "Please copy the URL manually from the map page",
        variant: "destructive",
      });
    }
  };

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
      downloadPinsCsv(pins, data.noteLabel || "Note");
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

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {user ? (
          <SignedInDashboard
            firstName={firstName}
            ownedMaps={ownedMaps}
            contributedMaps={contributedMaps}
            isLoadingOwned={isLoadingOwned}
            isLoadingContributed={isLoadingContributed}
            totalPins={totalPins}
            onCreateClick={() => setLocation("/map/new")}
            onCopyLink={handleCopyMapUrl}
            onDeleteMap={(map) => setDeleteMapModal({ isOpen: true, map })}
            onExportCsv={handleExportCsv}
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
        />
      )}
    </>
  );
}

interface SignedInDashboardProps {
  firstName?: string;
  ownedMaps: MapCollectionSummary[];
  contributedMaps: MapCollectionSummary[];
  isLoadingOwned: boolean;
  isLoadingContributed: boolean;
  totalPins: number;
  onCreateClick: () => void;
  onCopyLink: (map: MapCollectionSummary) => void;
  onDeleteMap: (map: MapCollectionSummary) => void;
  onExportCsv: (map: MapCollectionSummary) => void;
}

function SignedInDashboard({
  firstName,
  ownedMaps,
  contributedMaps,
  isLoadingOwned,
  isLoadingContributed,
  totalPins,
  onCreateClick,
  onCopyLink,
  onDeleteMap,
  onExportCsv,
}: SignedInDashboardProps) {
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ownedMaps.map((map) => (
                <MapCard
                  key={map.id}
                  map={map}
                  role="owner"
                  onCopyLink={onCopyLink}
                  onDelete={onDeleteMap}
                  onExportCsv={onExportCsv}
                />
              ))}
            </div>
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
                <MapCard key={map.id} map={map} role="contributor" onCopyLink={onCopyLink} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
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
          Pin your world, together
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Create a shared map in seconds. Send the link and let people drop pins by clicking the map or searching
          for a venue, approve what you want to keep, and showcase your favourite maps on your own public profile.
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
          title="Share the link"
          description="Anyone can add a pin by clicking the map or searching for a venue."
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
          However your group comes together, PinTogather gives it a shared home on the map.
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
