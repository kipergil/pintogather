import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Crown } from "lucide-react";
import { searchVenues, VenueResult, getVenueIcon } from "@/lib/venue-search";
import { useUserPermissions } from "@/hooks/use-user-permissions";

interface VenueSearchProps {
  onVenueSelect: (venue: VenueResult) => void;
  mapBounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  className?: string;
}

export function VenueSearch({ onVenueSelect, mapBounds, className }: VenueSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const { canUseVenueSearch } = useUserPermissions();

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Show cached results immediately if available
    if (results.length > 0 && searchQuery === query) {
      setShowResults(true);
      return;
    }

    setIsSearching(true);
    
    try {
      const venues = await searchVenues(searchQuery, mapBounds);
      setResults(venues);
      setShowResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleVenueSelect = (venue: VenueResult) => {
    onVenueSelect(venue);
    setShowResults(false);
    setQuery("");
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
      setShowResults(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative w-full ${className}`} ref={inputRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search for venues, restaurants, or places..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => query && setShowResults(true)}
          className="pl-10 pr-4"
          disabled={!canUseVenueSearch}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {showResults && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto">
          <CardContent className="p-0">
            {results.length > 0 ? (
              <div className="divide-y">
                {results.map((venue) => (
                  <button
                    key={venue.id}
                    onClick={() => handleVenueSelect(venue)}
                    className="w-full p-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5 flex-shrink-0">
                        {getVenueIcon(venue.types)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm truncate">
                            {venue.name}
                          </h4>
                          {venue.types && venue.types[0] && (
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-blue-100 text-blue-800 border-0"
                            >
                              {venue.types[0].replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {venue.rating && (
                            <Badge 
                              variant="outline" 
                              className="text-xs text-yellow-700 border-yellow-300"
                            >
                              ⭐ {venue.rating}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-1">
                          {venue.address}
                        </p>
                      </div>
                      <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            ) : !canUseVenueSearch && query.length > 0 ? (
              <div className="p-4 text-center">
                <Crown className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <h4 className="font-medium text-sm mb-1">Upgrade Required</h4>
                <p className="text-xs text-gray-600 mb-3">
                  Venue search is available for Basic and Premium users
                </p>
                <Button size="sm" className="text-xs">
                  Upgrade Now
                </Button>
              </div>
            ) : query.length > 0 && !isSearching ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No venues found for "{query}"
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}