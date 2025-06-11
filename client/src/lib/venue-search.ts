export interface VenueResult {
  place_id: string;
  name: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  category: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  extratags?: {
    cuisine?: string;
    website?: string;
    phone?: string;
  };
}

export async function searchVenues(query: string, options: {
  limit?: number;
  countryCode?: string;
  viewbox?: string;
} = {}): Promise<VenueResult[]> {
  const { limit = 10, countryCode = 'us,gb,ca,au', viewbox } = options;
  
  if (!query.trim()) return [];

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
      limit: limit.toString(),
      countrycodes: countryCode,
      dedupe: '1'
    });

    if (viewbox) {
      params.append('viewbox', viewbox);
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
      place_id: result.place_id,
      name: result.name || result.display_name.split(',')[0],
      display_name: result.display_name,
      lat: result.lat,
      lon: result.lon,
      type: result.type,
      category: result.class,
      address: result.address || {},
      extratags: result.extratags || {}
    }));
  } catch (error) {
    console.error('Venue search error:', error);
    return [];
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