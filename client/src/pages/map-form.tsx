import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreateMapForm } from "@/components/create-map-form";
import { useAuth } from "@/contexts/AuthContext";

interface MapFormProps {
  params?: {
    shareUrl?: string;
  };
}

interface MapCollection {
  id: string;
  name: string;
  description?: string;
  shareUrl: string;
  ownerId?: string;
  noteLabel?: string | null;
  notePrompt?: string | null;
  brandingLogoUrl?: string | null;
  showOnProfile?: boolean;
}

export default function MapForm({ params }: MapFormProps) {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const shareUrl = params?.shareUrl;
  const isEditing = !!shareUrl;

  const { data: mapCollection, isLoading, error } = useQuery<MapCollection>({
    queryKey: [`/api/maps/${shareUrl}`],
    enabled: isEditing,
  });

  if (authLoading || (isEditing && isLoading)) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!isEditing && !user) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-border">
          <CardContent className="pt-8 pb-8 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Sign in to create a map</h2>
            <p className="text-muted-foreground mb-5">
              You'll need an account so this map — and its shareable link — belongs to you.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (isEditing && (error || !mapCollection)) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-border">
          <CardContent className="pt-8 pb-8 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Map not found</h2>
            <p className="text-muted-foreground mb-5">
              This map doesn't exist, or the link is no longer valid.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isOwner = !isEditing || (!!user && user.id === mapCollection?.ownerId);

  if (isEditing && !isOwner) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-border">
          <CardContent className="pt-8 pb-8 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Only the owner can edit this map</h2>
            <p className="text-muted-foreground mb-5">
              You don't have permission to change this map's settings.
            </p>
            <Link href={`/map/${mapCollection!.shareUrl}`}>
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to map
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const backHref = isEditing ? `/map/${mapCollection!.shareUrl}` : "/";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <Settings className="h-5 w-5 text-primary" />
          ) : (
            <Plus className="h-5 w-5 text-primary" />
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isEditing ? "Edit map" : "Create a new map"}
          </h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(backHref)}
          data-testid="button-back-from-map-form"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isEditing ? "Back to map" : "Back to home"}
        </Button>
      </div>

      <Card className="border-border">
        <CardContent className="p-6">
          <CreateMapForm
            mapId={mapCollection?.id}
            initialValues={
              isEditing && mapCollection
                ? {
                    name: mapCollection.name,
                    description: mapCollection.description ?? "",
                    noteLabel: mapCollection.noteLabel ?? "",
                    notePrompt: mapCollection.notePrompt ?? "",
                    brandingLogoUrl: mapCollection.brandingLogoUrl ?? "",
                    showOnProfile: mapCollection.showOnProfile ?? false,
                    shareUrl: mapCollection.shareUrl,
                  }
                : undefined
            }
            onCreated={() => {
              if (isEditing) setLocation(backHref);
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
