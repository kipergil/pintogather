import { useEffect } from "react";
import { ITEM_NOUN, pluralize } from "@shared/vocabulary";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LikeButton } from "@/components/like-button";
import { getInitials } from "@/lib/map-utils";
import { APP_NAME } from "@/lib/branding";
import { Compass, MapPin, Rss } from "lucide-react";
import type { FeedMapItem } from "@shared/schema";

interface FeedResponse {
  items: FeedMapItem[];
  followingCount: number;
}

const FEED_QUERY_KEY = "/api/feed";

function FeedCard({ map }: { map: FeedMapItem }) {
  return (
    <Card className="border-border overflow-hidden h-full transition-all hover:border-primary/40 hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        {map.ownerUsername && (
          <Link
            href={`/u/${map.ownerUsername}`}
            className="inline-flex items-center gap-2 group"
            onClick={(e) => e.stopPropagation()}
            data-testid={`link-feed-owner-${map.id}`}
          >
            <Avatar className="h-6 w-6 border border-border">
              {map.ownerAvatarUrl && <AvatarImage src={map.ownerAvatarUrl} alt={map.ownerName ?? ""} />}
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                {getInitials(map.ownerName || "?")}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              {map.ownerName || `@${map.ownerUsername}`}
            </span>
          </Link>
        )}

        <Link href={`/map/${map.shareUrl}`} data-testid={`link-feed-map-${map.id}`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden">
              {map.brandingLogoUrl ? (
                <img src={map.brandingLogoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <MapPin className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-foreground leading-snug line-clamp-1">{map.name}</h4>
              {map.description ? (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{map.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic mt-0.5">No description</p>
              )}
            </div>
          </div>
        </Link>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {pluralize(map.pinCount, ITEM_NOUN[map.itemType])}
          </span>
          <LikeButton
            mapId={map.id}
            liked={map.likedByViewer}
            likeCount={map.likeCount}
            invalidateKeys={[FEED_QUERY_KEY]}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Feed() {
  useEffect(() => {
    document.title = `Feed — ${APP_NAME}`;
  }, []);

  const { data, isLoading } = useQuery<FeedResponse>({ queryKey: [FEED_QUERY_KEY] });

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-fade-in">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 text-primary">
          <Rss className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Feed</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Recently added collections</h1>
        <p className="text-muted-foreground">From people you follow and {APP_NAME}'s own curated collections.</p>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-muted/30">
          <Rss className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">
            {data && data.followingCount === 0 ? "You're not following anyone yet" : "Nothing new yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {data && data.followingCount === 0
              ? "Follow people from their public profile to see their collections here."
              : "Check back soon, or explore curated collections in the meantime."}
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            data-testid="link-feed-empty-discover"
          >
            <Compass className="h-4 w-4" />
            Browse Discover
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {data.items.map((map) => (
            <FeedCard key={map.id} map={map} />
          ))}
        </div>
      )}
    </main>
  );
}
