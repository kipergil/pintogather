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

export function getVenueIcon(category: string, type: string): string {
  const amenityIcons: Record<string, string> = {
    restaurant: '🍽️',
    cafe: '☕',
    bar: '🍺',
    pub: '🍻',
    fast_food: '🍟',
    hotel: '🏨',
    hospital: '🏥',
    pharmacy: '💊',
    bank: '🏦',
    gas_station: '⛽',
    cinema: '🎬',
    theatre: '🎭',
    museum: '🏛️',
    library: '📚',
    school: '🏫',
    university: '🎓',
    place_of_worship: '⛪',
    gym: '💪',
    shopping_mall: '🛍️'
  };

  const shopIcons: Record<string, string> = {
    supermarket: '🛒',
    clothes: '👕',
    books: '📚',
    electronics: '📱',
    bakery: '🥖',
    butcher: '🥩',
    florist: '🌸'
  };

  const tourismIcons: Record<string, string> = {
    attraction: '🎯',
    museum: '🏛️',
    hotel: '🏨',
    viewpoint: '👁️',
    zoo: '🦁',
    theme_park: '🎢'
  };

  const leisureIcons: Record<string, string> = {
    park: '🌳',
    playground: '🛝',
    sports_centre: '🏃',
    swimming_pool: '🏊',
    golf_course: '⛳'
  };

  switch (category) {
    case 'amenity':
      return amenityIcons[type] || '🏢';
    case 'shop':
      return shopIcons[type] || '🛍️';
    case 'tourism':
      return tourismIcons[type] || '🎯';
    case 'leisure':
      return leisureIcons[type] || '🌳';
    default:
      return '📍';
  }
}

export function formatVenueAddress(address: VenueResult['address']): string {
  const parts = [];
  
  if (address.road) {
    if (address.house_number) {
      parts.push(`${address.house_number} ${address.road}`);
    } else {
      parts.push(address.road);
    }
  }
  
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  
  return parts.join(', ');
}

export function extractSocialHandles(venue: VenueResult): {
  twitter: string;
  instagram: string;
  linkedin: string;
} {
  const extratags = venue.extratags || {};
  
  // Extract handles from various possible fields
  const twitter = extratags.twitter || extratags['contact:twitter'] || '';
  const instagram = extratags.instagram || extratags['contact:instagram'] || '';
  const linkedin = extratags.linkedin || extratags['contact:linkedin'] || '';
  
  // Clean up handles (remove @ symbol and URLs)
  const cleanHandle = (handle: string) => {
    if (!handle) return '';
    return handle.replace(/^@/, '').replace(/^https?:\/\/[^\/]+\//, '').trim();
  };
  
  return {
    twitter: cleanHandle(twitter),
    instagram: cleanHandle(instagram),
    linkedin: cleanHandle(linkedin)
  };
}