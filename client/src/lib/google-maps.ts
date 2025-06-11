import { Loader } from '@googlemaps/js-api-loader';

let loader: Loader | null = null;
let mapsPromise: Promise<void> | null = null;

export function getGoogleMapsLoader(): Loader {
  if (!loader) {
    loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
      version: 'weekly',
      libraries: ['places', 'geometry']
    });
  }
  return loader;
}

export async function loadGoogleMaps(): Promise<void> {
  if (!mapsPromise) {
    mapsPromise = getGoogleMapsLoader().load();
  }
  return mapsPromise;
}

export function isGoogleMapsLoaded(): boolean {
  return window.google?.maps != null;
}

export interface VenueResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types?: string[];
  rating?: number;
  website?: string;
}

export async function searchVenues(
  query: string,
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  }
): Promise<VenueResult[]> {
  try {
    await loadGoogleMaps();
    
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    
    const request: google.maps.places.TextSearchRequest = {
      query,
      ...(bounds && {
        bounds: new google.maps.LatLngBounds(
          { lat: bounds.south, lng: bounds.west },
          { lat: bounds.north, lng: bounds.east }
        )
      })
    };

    return new Promise((resolve, reject) => {
      service.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const venues: VenueResult[] = results.slice(0, 10).map(place => ({
            id: place.place_id || '',
            name: place.name || '',
            address: place.formatted_address || '',
            lat: place.geometry?.location?.lat() || 0,
            lng: place.geometry?.location?.lng() || 0,
            types: place.types,
            rating: place.rating,
            website: place.website
          }));
          resolve(venues);
        } else {
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('Venue search error:', error);
    throw error;
  }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    await loadGoogleMaps();
    
    const geocoder = new google.maps.Geocoder();
    const response = await geocoder.geocode({ address });
    
    if (response.results && response.results.length > 0) {
      const location = response.results[0].geometry.location;
      return {
        lat: location.lat(),
        lng: location.lng()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}