export interface LocationData {
  address: string;
  city: string;
  state: string;
  borough: string;
  postcode: string;
  country: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationData | null> {
  try {
    const response = await fetch(
      `/api/geocode?lat=${lat}&lng=${lng}`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
