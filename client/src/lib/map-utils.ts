declare global {
  interface Window {
    google: typeof google;
  }
}

export interface LocationData {
  address: string;
  city: string;
  state: string;
  town: string;
  borough: string;
  postcode: string;
  country: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationData | null> {
  try {
    if (!window.google?.maps) {
      throw new Error('Google Maps not loaded');
    }

    const geocoder = new google.maps.Geocoder();
    const response = await geocoder.geocode({
      location: { lat, lng }
    });

    if (response.results && response.results.length > 0) {
      const result = response.results[0];
      const components = result.address_components;
      
      const getComponent = (types: string[]) => {
        const component = components.find(c => types.some(type => c.types.includes(type)));
        return component?.long_name || '';
      };

      return {
        address: result.formatted_address || '',
        city: getComponent(['locality', 'administrative_area_level_2']),
        state: getComponent(['administrative_area_level_1']),
        town: getComponent(['sublocality', 'neighborhood']),
        borough: getComponent(['sublocality_level_1']),
        postcode: getComponent(['postal_code']),
        country: getComponent(['country'])
      };
    }
    
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Fallback to server-side geocoding
    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (!response.ok) {
        throw new Error('Server geocoding failed');
      }
      const data = await response.json();
      return {
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        town: data.town || '',
        borough: data.borough || '',
        postcode: data.postcode || '',
        country: data.country || ''
      };
    } catch (fallbackError) {
      console.error('Fallback geocoding error:', fallbackError);
      return null;
    }
  }
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Distinct contributor count: grouped by actual user identity (userId) so the
 * same account never gets double-counted across differently-typed names, and
 * imported pins (which are always attributed to the importing user's id)
 * count as one contribution from that user. Pins with no userId (fully
 * anonymous, no one signed in) fall back to grouping by the typed name.
 */
export function countDistinctContributors(pins: Array<{ userId?: string | null; userName: string }>): number {
  const ids = new Set(pins.map((pin) => pin.userId || `anon:${pin.userName}`));
  return ids.size;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
