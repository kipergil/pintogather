import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { MapPin, Plus } from 'lucide-react';
import { VenueSearch } from './venue-search';
import { AddPinModal } from './add-pin-modal';
import { loadGoogleMaps } from '../lib/google-maps';
import { VenueResult } from '../lib/venue-search';

interface LocationData {
  address: string;
  city: string;
  state: string;
  town: string;
  borough: string;
  postcode: string;
  country: string;
}

// Reverse geocoding function
const reverseGeocode = async (lat: number, lng: number): Promise<LocationData | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding failed');
    }
    
    const data = await response.json();
    
    if (data && data.address) {
      return {
        address: data.display_name || '',
        city: data.address.city || data.address.town || data.address.village || '',
        state: data.address.state || data.address.region || '',
        town: data.address.town || data.address.village || '',
        borough: data.address.borough || '',
        postcode: data.address.postcode || '',
        country: data.address.country || ''
      };
    }
    
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

interface MapViewProps {
  mapCollection: {
    id: string;
    name: string;
    shareUrl: string;
    pins: Array<{
      id: string;
      userName: string;
      latitude: string;
      longitude: string;
      address?: string;
      city?: string;
      state?: string;
      twitterHandle?: string;
      instagramHandle?: string;
      linkedinHandle?: string;
      note?: string;
      createdAt: string;
    }>;
  };
}

export function MapView({ mapCollection }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isAddPinModalOpen, setIsAddPinModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Google Maps using the simple working approach
  useEffect(() => {
    console.log('MapView: useEffect triggered, isLoading:', isLoading);
    
    const initMap = async () => {
      console.log('MapView: initMap called, mapRef.current:', mapRef.current, 'mapInstanceRef.current:', mapInstanceRef.current);
      
      if (!mapRef.current || mapInstanceRef.current) {
        console.log('MapView: Early return - no container or map already exists');
        return;
      }

      try {
        console.log('MapView: Starting Google Maps initialization...');
        await loadGoogleMaps();
        console.log('MapView: Google Maps API loaded successfully');
        
        // Check if we still have a valid container reference
        if (!mapRef.current) {
          console.error('MapView: Container reference lost during API loading');
          return;
        }
        
        // Check container dimensions
        const container = mapRef.current;
        console.log('MapView: Container dimensions after API load:', {
          width: container.offsetWidth,
          height: container.offsetHeight,
          clientWidth: container.clientWidth,
          clientHeight: container.clientHeight,
          display: window.getComputedStyle(container).display,
          visibility: window.getComputedStyle(container).visibility
        });

        // If container has no dimensions, wait a bit and retry
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          console.log('MapView: Container has zero dimensions, retrying in 100ms...');
          setTimeout(() => initMap(), 100);
          return;
        }

        // Calculate center from pins or use default
        let center = { lat: 51.505, lng: -0.09 }; // Default to London
        let zoom = 2;
        
        if (mapCollection.pins.length > 0) {
          const lats = mapCollection.pins.map(pin => parseFloat(pin.latitude));
          const lngs = mapCollection.pins.map(pin => parseFloat(pin.longitude));
          center = {
            lat: lats.reduce((a, b) => a + b, 0) / lats.length,
            lng: lngs.reduce((a, b) => a + b, 0) / lngs.length
          };
          zoom = 10;
        }

        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        });

        mapInstanceRef.current = map;
        console.log('MapView: Map created successfully');

        // Add click listener for adding pins
        map.addListener('click', async (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            
            // Get address via reverse geocoding
            const locationData = await reverseGeocode(lat, lng);
            
            setSelectedLocation({
              lat,
              lng,
              address: locationData?.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            });
            setIsAddPinModalOpen(true);
          }
        });

        // Add existing pins to the map
        addPinsToMap(map);
        
        // Force loading state off immediately after map creation
        console.log('MapView: Forcing loading state off immediately');
        setIsLoading(false);

      } catch (error) {
        console.error('MapView: Error creating map:', error);
        setIsLoading(false);
      }
    };

    initMap();
  }, []);

  // Update pins when mapCollection changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      addPinsToMap(mapInstanceRef.current);
    }
  }, [mapCollection.pins]);

  const addPinsToMap = (map: google.maps.Map) => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    mapCollection.pins.forEach(pin => {
      const marker = new google.maps.Marker({
        position: {
          lat: parseFloat(pin.latitude),
          lng: parseFloat(pin.longitude)
        },
        map,
        title: pin.userName,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#3B82F6',
          fillOpacity: 1,
          strokeColor: '#1E40AF',
          strokeWeight: 2,
        }
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-2">
            <h3 class="font-semibold text-sm">${pin.userName}</h3>
            ${pin.address ? `<p class="text-xs text-gray-600 mt-1">${pin.address}</p>` : ''}
            ${pin.note ? `<p class="text-xs mt-1">${pin.note}</p>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Adjust map bounds to fit all pins
    if (mapCollection.pins.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      mapCollection.pins.forEach(pin => {
        bounds.extend({
          lat: parseFloat(pin.latitude),
          lng: parseFloat(pin.longitude)
        });
      });
      map.fitBounds(bounds);
    }
  };

  const handleVenueSelect = (venue: VenueResult) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: venue.lat, lng: venue.lng });
      mapInstanceRef.current.setZoom(15);
      
      setSelectedLocation({
        lat: venue.lat,
        lng: venue.lng,
        address: venue.address
      });
      setIsAddPinModalOpen(true);
    }
  };

  const getMapBounds = () => {
    if (!mapInstanceRef.current) return undefined;
    const bounds = mapInstanceRef.current.getBounds();
    if (!bounds) return undefined;
    
    return {
      north: bounds.getNorthEast().lat(),
      south: bounds.getSouthWest().lat(),
      east: bounds.getNorthEast().lng(),
      west: bounds.getSouthWest().lng()
    };
  };

  if (isLoading) {
    return (
      <Card>
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-neutral-600">Loading map...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Venue Search */}
      <Card>
        <div className="p-4">
          <VenueSearch 
            onVenueSelect={handleVenueSelect}
            mapBounds={getMapBounds()}
            className="w-full max-w-md mx-auto"
          />
        </div>
      </Card>

      {/* Map Container */}
      <Card>
        <div className="relative">
          <div 
            ref={mapRef} 
            className="w-full h-96 rounded-lg bg-gray-100"
            style={{ 
              minHeight: '400px',
              height: '400px',
              width: '100%',
              position: 'relative'
            }}
          />
          
          {/* Map Info Overlay */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs">
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-neutral-900">Click to add a pin</p>
                <p className="text-neutral-600 text-xs mt-1">
                  Share your location and connect with the community
                </p>
              </div>
            </div>
          </div>

          {/* Quick Add Button */}
          <div className="absolute bottom-4 right-4">
            <Button
              onClick={() => {
                if (mapInstanceRef.current) {
                  const center = mapInstanceRef.current.getCenter();
                  if (center) {
                    setSelectedLocation({
                      lat: center.lat(),
                      lng: center.lng(),
                      address: `${center.lat().toFixed(6)}, ${center.lng().toFixed(6)}`
                    });
                    setIsAddPinModalOpen(true);
                  }
                }
              }}
              className="rounded-full w-12 h-12 p-0 bg-blue-600 hover:bg-blue-700 shadow-lg"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add Pin Modal */}
      <AddPinModal
        isOpen={isAddPinModalOpen}
        onClose={() => {
          setIsAddPinModalOpen(false);
          setSelectedLocation(null);
        }}
        mapCollection={mapCollection}
        selectedLocation={selectedLocation}
      />
    </div>
  );
}