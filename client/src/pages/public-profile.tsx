import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MapPin, Twitter, Instagram, Linkedin, Compass } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/map-utils";
import { buildSocialUrl } from "@/lib/social-links";
import type { PublicProfile } from "@shared/schema";

interface PublicProfileProps {
  params: {
    username: string;
  };
}

export default function PublicProfilePage({ params }: PublicProfileProps) {
  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: [`/api/profile/${params.username}`],
    retry: false,
  });

  if (isLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-muted rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto mb-4">
          <Compass className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-1.5">Profile not found</h1>
        <p className="text-muted-foreground">This username isn't taken, or the profile link is no longer valid.</p>
      </main>
    );
  }

  const displayName = profile.fullName || `@${profile.username}`;
  const totalPins = profile.maps.reduce((sum, map) => sum + map.pinCount, 0);
  const twitterUrl = buildSocialUrl("twitter", profile.twitterHandle);
  const instagramUrl = buildSocialUrl("instagram", profile.instagramHandle);
  const linkedinUrl = buildSocialUrl("linkedin", profile.linkedinHandle);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {/* Profile header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar className="h-24 w-24 border border-border shrink-0">
          {profile.profileImageUrl && <AvatarImage src={profile.profileImageUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground break-words">{displayName}</h1>
          <p className="text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="text-foreground/90 mt-2 max-w-lg whitespace-pre-wrap">{profile.bio}</p>}

          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {profile.maps.length} {profile.maps.length === 1 ? "map" : "maps"}
            </span>
            <span aria-hidden>·</span>
            <span>{totalPins} {totalPins === 1 ? "pin" : "pins"}</span>
          </div>

          {(twitterUrl || instagramUrl || linkedinUrl) && (
            <div className="flex items-center gap-3 mt-3">
              {twitterUrl && (
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-profile-twitter"
                >
                  <Twitter className="h-5 w-5" />
                </a>
              )}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-profile-instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-profile-linkedin"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Public maps grid */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Maps</h2>
        {profile.maps.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-muted/30">
            <MapPin className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-base font-medium text-foreground mb-1">No public maps yet</h3>
            <p className="text-sm text-muted-foreground">Check back later.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.maps.map((map) => (
              <Link key={map.id} href={`/map/${map.shareUrl}`} data-testid={`link-profile-map-${map.id}`}>
                <Card className="border-border h-full transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 overflow-hidden">
                      {map.brandingLogoUrl ? (
                        <img src={map.brandingLogoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <MapPin className="h-5 w-5" />
                      )}
                    </div>
                    <h4 className="font-semibold text-foreground leading-snug line-clamp-1 mb-1">{map.name}</h4>
                    {map.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{map.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic mb-3">No description</p>
                    )}
                    <div className="mt-auto pt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
