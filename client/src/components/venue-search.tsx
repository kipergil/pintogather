import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Clock } from "lucide-react";
import { searchVenues, VenueResult, getVenueIcon, formatVenueAddress } from "@/lib/venue-search";

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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('pinnedVenueSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load recent searches:', e);
      }
    }
  }, []);

  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('pinnedVenueSearches', JSON.stringify(updated));
  };

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      const viewbox = mapBounds 
        ? `${mapBounds.west},${mapBounds.south},${mapBounds.east},${mapBounds.north}`
        : undefined;

      const venues = await searchVenues(searchQuery, {
        limit: 8,
        viewbox
      });
      
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
    saveRecentSearch(query);
    setShowResults(false);
    setQuery("");
    onVenueSelect(venue);
    inputRef.current?.blur();
  };

  const handleRecentSearchClick = (searchTerm: string) => {
    setQuery(searchTerm);
    performSearch(searchTerm);
    inputRef.current?.focus();
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      amenity: "bg-blue-100 text-blue-800",
      shop: "bg-green-100 text-green-800",
      tourism: "bg-purple-100 text-purple-800",
      leisure: "bg-orange-100 text-orange-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search venues, restaurants, places..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          onBlur={() => {
            // Delay hiding results to allow for click events
            setTimeout(() => setShowResults(false), 200);
          }}
          className="pl-10 pr-4 h-11"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto">
          <CardContent className="p-0">
            {results.length > 0 ? (
              <div className="divide-y">
                {results.map((venue) => (
                  <button
                    key={venue.place_id}
                    onClick={() => handleVenueSelect(venue)}
                    className="w-full p-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5 flex-shrink-0">
                        {getVenueIcon(venue.category, venue.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm truncate">
                            {venue.name}
                          </h4>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getCategoryBadgeColor(venue.category)} border-0`}
                          >
                            {venue.type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-1">
                          {formatVenueAddress(venue.address)}
                        </p>
                        {venue.extratags?.cuisine && (
                          <p className="text-xs text-blue-600 mt-1">
                            {venue.extratags.cuisine.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                      <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            ) : query.length > 2 && !isSearching ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No venues found for "{query}"
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Recent Searches */}
      {!showResults && recentSearches.length > 0 && !query && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-40">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-600 font-medium">Recent Searches</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {recentSearches.map((search, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleRecentSearchClick(search)}
                  className="text-xs h-6 px-2"
                >
                  {search}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}