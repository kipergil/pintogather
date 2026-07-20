import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface PlacesSearchProps {
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
}

export function PlacesSearch({ onPlaceSelect, placeholder = "Search for a place...", className = "" }: PlacesSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializePlaces = async () => {
      try {
        const configResponse = await fetch('/api/config');
        if (!configResponse.ok) return;

        const config = await configResponse.json();
        if (!config.googleMapsApiKey) return;

        const loader = new Loader({
          apiKey: config.googleMapsApiKey,
          version: "weekly",
          libraries: ["places"]
        });

        await loader.load();
        
        const mapDiv = document.createElement('div');
        const map = new google.maps.Map(mapDiv, { center: { lat: 0, lng: 0 }, zoom: 1 });
        
        setPlacesService(new google.maps.places.PlacesService(map));
        setAutocompleteService(new google.maps.places.AutocompleteService());
      } catch (error) {
        console.error('Failed to initialize Places API:', error);
      }
    };

    initializePlaces();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (!autocompleteService || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const request: google.maps.places.AutocompletionRequest = {
        input: searchQuery,
        types: ['establishment', 'geocode']
      };

      autocompleteService.getPlacePredictions(request, (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
        setIsLoading(false);
      });
    } catch (error) {
      console.error('Error searching places:', error);
      setSuggestions([]);
      setIsLoading(false);
    }
  }, [autocompleteService]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchPlaces(value);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectPlace = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService) return;

    setIsLoading(true);
    const request: google.maps.places.PlaceDetailsRequest = {
      placeId: prediction.place_id,
      fields: ['name', 'formatted_address', 'geometry', 'place_id']
    };

    placesService.getDetails(request, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry?.location) {
        const result: PlaceResult = {
          placeId: place.place_id || prediction.place_id,
          name: place.name || prediction.structured_formatting.main_text,
          address: place.formatted_address || prediction.description,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };

        setQuery(result.name);
        setShowSuggestions(false);
        setSuggestions([]);
        onPlaceSelect(result);
      }
      setIsLoading(false);
    });
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="pl-10 pr-10"
          data-testid="input-places-search"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelectPlace(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-0"
              data-testid={`place-suggestion-${suggestion.place_id}`}
            >
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {suggestion.structured_formatting.main_text}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {suggestion.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
