import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search as SearchIcon, MapPin, Users, MapPinned, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { getInitials } from "@/lib/map-utils";

interface SearchMapResult {
  id: string;
  name: string;
  description: string | null;
  shareUrl: string;
  isPublic: boolean;
  ownerName: string | null;
}

interface SearchPinResult {
  id: string;
  title: string;
  note: string | null;
  address: string | null;
  city: string | null;
  mapShareUrl: string;
  mapName: string;
}

interface SearchUserResult {
  id: string;
  username: string;
  fullName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
}

interface SearchResponse {
  maps: SearchMapResult[];
  pins: SearchPinResult[];
  users: SearchUserResult[];
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data, isFetching } = useQuery<SearchResponse>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const hasQuery = debouncedQuery.length >= 2;
  const hasResults = !!data && (data.maps.length > 0 || data.pins.length > 0 || data.users.length > 0);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Search</h1>
        <p className="text-muted-foreground">Find maps, pins, and people across PinGather.</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search maps, pins, or people..."
          className="pl-10 h-11"
          autoFocus
          data-testid="input-search-query"
        />
      </div>

      {!hasQuery && (
        <p className="text-center text-sm text-muted-foreground">Type at least 2 characters to search.</p>
      )}

      {hasQuery && isFetching && !data && (
        <p className="text-center text-sm text-muted-foreground">Searching...</p>
      )}

      {hasQuery && data && !hasResults && (
        <p className="text-center text-sm text-muted-foreground" data-testid="text-no-results">
          No results for "{debouncedQuery}".
        </p>
      )}

      {data && data.users.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            People
          </h2>
          <div className="space-y-2">
            {data.users.map((u) => (
              <Link key={u.id} href={`/u/${u.username}`} data-testid={`link-search-user-${u.id}`}>
                <Card className="border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.profileImageUrl ?? undefined} alt={u.username} />
                      <AvatarFallback>{getInitials(u.fullName || u.username)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate">{u.fullName || `@${u.username}`}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        @{u.username}
                        {u.bio && <span> · {u.bio}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data && data.maps.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <MapPinned className="h-3.5 w-3.5" />
            Maps
          </h2>
          <div className="space-y-2">
            {data.maps.map((map) => (
              <Link key={map.id} href={`/map/${map.shareUrl}`} data-testid={`link-search-map-${map.id}`}>
                <Card className="border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{map.name}</span>
                      {!map.isPublic && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    </div>
                    {map.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{map.description}</p>
                    )}
                    {map.ownerName && <p className="text-xs text-muted-foreground mt-1">by {map.ownerName}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data && data.pins.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Pins
          </h2>
          <div className="space-y-2">
            {data.pins.map((pin) => (
              <Link
                key={pin.id}
                href={`/map/${pin.mapShareUrl}?pin=${pin.id}`}
                data-testid={`link-search-pin-${pin.id}`}
              >
                <Card className="border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="font-medium text-foreground truncate">{pin.title}</div>
                    {(pin.note || pin.address || pin.city) && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                        {pin.note || [pin.address, pin.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">in {pin.mapName}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
