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

import { searchVenues as googleSearchVenues, loadGoogleMaps } from './google-maps';

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
    // Try Google Maps first
    const results = await googleSearchVenues(query, bounds);
    return results;
  } catch (error) {
    console.error('Google venue search error:', error);
    
    // Fallback to Nominatim
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        format: 'json',
        addressdetails: '1',
        extratags: '1',
        limit: '10',
        dedupe: '1'
      });

      if (bounds) {
        params.append('viewbox', `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`);
        params.append('bounded', '1');
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            'User-Agent': 'PinTogather/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const results = await response.json();
      
      return results.map((result: any) => ({
        id: result.place_id || Math.random().toString(),
        name: result.name || result.display_name.split(',')[0],
        address: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        types: [result.type, result.class].filter(Boolean),
        rating: undefined,
        website: undefined
      }));
    } catch (fallbackError) {
      console.error('Fallback venue search error:', fallbackError);
      return [];
    }
  }
}

export function getVenueIcon(types?: string[]): string {
  if (!types || types.length === 0) return '📍';
  
  const type = types[0];
  
  // Google Places types to icons mapping
  const typeIcons: Record<string, string> = {
    restaurant: '🍽️',
    cafe: '☕',
    bar: '🍺',
    food: '🍽️',
    lodging: '🏨',
    hospital: '🏥',
    pharmacy: '💊',
    bank: '🏦',
    gas_station: '⛽',
    movie_theater: '🎬',
    museum: '🏛️',
    library: '📚',
    school: '🏫',
    university: '🎓',
    church: '⛪',
    gym: '💪',
    shopping_mall: '🛍️',
    store: '🏪',
    park: '🌳',
    tourist_attraction: '🎯',
    establishment: '🏢'
  };

  return typeIcons[type] || '📍';
}