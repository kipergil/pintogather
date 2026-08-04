import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Compass, ExternalLink, Loader2, Save, Shield } from "lucide-react";
import {
  CURATED_CATEGORY,
  CURATED_CITY_BY_COUNTRY,
  CURATED_COUNTRY,
  type CuratedCategory,
  type CuratedCountry,
} from "@shared/enums";
import { CURATED_CATEGORY_LABELS, CURATED_COUNTRY_LABELS } from "@/lib/curated-maps";

interface AdminCurateMapProps {
  params: { mapId: string };
}

interface AdminMapDetail {
  id: string;
  name: string;
  shareUrl: string;
  ownerId: string | null;
  ownerName: string | null;
  curated: boolean;
  curatedCategory: CuratedCategory | null;
  curatedCountry: CuratedCountry | null;
  curatedCity: string | null;
  curatedOrder: number | null;
  curatedTagline: string | null;
}

const NONE = "__none__";

export default function AdminCurateMap({ params }: AdminCurateMapProps) {
  const { mapId } = params;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const isAdmin = !!user?.isAdmin;
  useEffect(() => {
    if (user && !isAdmin) setLocation("/");
  }, [user, isAdmin, setLocation]);

  const { data: map, isLoading } = useQuery<AdminMapDetail>({
    queryKey: [`/api/admin/maps/${mapId}`],
    enabled: !!user && isAdmin,
  });

  const [curated, setCurated] = useState(false);
  const [category, setCategory] = useState<string>(NONE);
  const [country, setCountry] = useState<string>(NONE);
  const [city, setCity] = useState<string>(NONE);
  const [order, setOrder] = useState<string>("");
  const [tagline, setTagline] = useState("");

  useEffect(() => {
    if (!map) return;
    setCurated(map.curated);
    setCategory(map.curatedCategory ?? NONE);
    setCountry(map.curatedCountry ?? NONE);
    setCity(map.curatedCity ?? NONE);
    setOrder(map.curatedOrder != null ? String(map.curatedOrder) : "");
    setTagline(map.curatedTagline ?? "");
  }, [map]);

  const citiesForCountry = useMemo(() => {
    if (country === NONE) return [];
    return CURATED_CITY_BY_COUNTRY[country as CuratedCountry] ?? [];
  }, [country]);

  useEffect(() => {
    if (city !== NONE && !citiesForCountry.includes(city)) setCity(NONE);
  }, [citiesForCountry, city]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", `/api/admin/maps/${mapId}/curate`, {
        curated,
        curatedCategory: category === NONE ? null : category,
        curatedCountry: country === NONE ? null : country,
        curatedCity: city === NONE ? null : city,
        curatedOrder: order.trim() ? Number(order) : null,
        curatedTagline: tagline.trim() || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "maps"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/maps/${mapId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/discover"] });
      toast({
        title: curated ? "Map curated" : "Map updated",
        description: curated ? "It's now visible on /discover." : "Curation changes saved.",
        variant: "success",
      });
      setLocation("/admin");
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save curation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (curated && (category === NONE || country === NONE || city === NONE)) {
      toast({
        title: "Category, country, and city are required",
        description: "Fill in all three to curate this map, or turn curation off.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  if (authLoading || (isLoading && isAdmin)) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!map) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-lg font-semibold mb-2">Map not found</h2>
            <Link href="/admin">
              <Button className="w-full">Back to admin panel</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Compass className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Curate map</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")} data-testid="button-back-to-admin">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to admin
        </Button>
      </div>

      <Card className="border-border">
        <CardContent className="p-6 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-foreground">{map.name}</h2>
            {map.curated && (
              <Badge className="bg-primary/10 text-primary border-primary/30 gap-1">
                <Compass className="h-3 w-3" />
                Currently curated
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Owner: {map.ownerName || "(no owner)"} — stays unchanged</p>
          <a
            href={`/map/${map.shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View map
          </a>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3.5">
              <div className="space-y-0.5">
                <Label htmlFor="curated">Show on /discover</Label>
                <p className="text-xs text-muted-foreground">
                  Featured maps stay real, live maps — visitors are taken to the normal map page.
                </p>
              </div>
              <Switch id="curated" checked={curated} onCheckedChange={setCurated} data-testid="switch-curated" />
            </div>

            <div className="space-y-2">
              <Label>Category {curated && "*"}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-curate-category">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {CURATED_CATEGORY.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURATED_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Country {curated && "*"}</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger data-testid="select-curate-country">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {CURATED_COUNTRY.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CURATED_COUNTRY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>City {curated && "*"}</Label>
                <Select value={city} onValueChange={setCity} disabled={citiesForCountry.length === 0}>
                  <SelectTrigger data-testid="select-curate-city">
                    <SelectValue placeholder="City" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {citiesForCountry.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="curatedOrder">Display order</Label>
              <Input
                id="curatedOrder"
                type="number"
                placeholder="Lower shows first — also determines the freemium teaser"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                data-testid="input-curate-order"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="curatedTagline">Tagline</Label>
              <Textarea
                id="curatedTagline"
                placeholder="A short editorial blurb for the Discover card"
                value={tagline}
                onChange={(e) => setTagline(e.target.value.slice(0, 200))}
                rows={2}
                maxLength={200}
                data-testid="input-curate-tagline"
              />
              <p className="text-xs text-muted-foreground text-right">{tagline.length}/200</p>
            </div>

            <Button type="submit" className="w-full" disabled={saveMutation.isPending} data-testid="button-save-curation">
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
