import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { MapPin, Plus } from 'lucide-react';
import { AddPinModal } from './add-pin-modal';
import { loadGoogleMaps } from '../lib/google-maps';

interface Pin {
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
}

interface SimpleMapProps {
  mapCollection: {
    id: string;
    name: string;
    shareUrl: string;
    pins: Pin[];
  };
}

export function SimpleGoogleMap({ mapCollection }: SimpleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddPinModalOpen, setIsAddPinModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) {
      updatePins();
    }
  }, [mapCollection.pins]);

  const initializeMap = async () => {
    if (!mapRef.current) {
      console.log('Map container not available, retrying...');
      setTimeout(initializeMap, 100);
      return;
    }

    try {
      await loadGoogleMaps();
      
      // Calculate center from pins
      let center = { lat: 51.5074, lng: -0.1278 }; // Default: London
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

      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });

      mapInstanceRef.current = map;

      // Add click listener for new pins
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          setSelectedLocation({
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
            address: `${e.latLng.lat().toFixed(6)}, ${e.latLng.lng().toFixed(6)}`
          });
          setIsAddPinModalOpen(true);
        }
      });

      updatePins();
      setIsLoading(false);

    } catch (error) {
      console.error('Failed to initialize map:', error);
      setIsLoading(false);
    }
  };

  const updatePins = () => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add markers for each pin
    mapCollection.pins.forEach(pin => {
      const marker = new google.maps.Marker({
        position: {
          lat: parseFloat(pin.latitude),
          lng: parseFloat(pin.longitude)
        },
        map: mapInstanceRef.current,
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

      // Info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 4px 0; font-weight: 600;">${pin.userName}</h3>
            ${pin.address ? `<p style="margin: 4px 0; color: #666; font-size: 12px;">${pin.address}</p>` : ''}
            ${pin.note ? `<p style="margin: 4px 0; font-size: 12px;">${pin.note}</p>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if multiple pins
    if (mapCollection.pins.length > 1 && mapInstanceRef.current) {
      const bounds = new google.maps.LatLngBounds();
      mapCollection.pins.forEach(pin => {
        bounds.extend({
          lat: parseFloat(pin.latitude),
          lng: parseFloat(pin.longitude)
        });
      });
      mapInstanceRef.current.fitBounds(bounds);
    }
  };

  const handleAddPin = () => {
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
      <Card>
        <div className="relative">
          <div 
            ref={mapRef}
            className="w-full h-96 rounded-lg"
            style={{ height: '400px' }}
          />
          
          {/* Map Info Overlay */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs">
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-neutral-900">Click to add a pin</p>
                <p className="text-neutral-600 text-xs mt-1">
                  Share your location with the community
                </p>
              </div>
            </div>
          </div>

          {/* Add Pin Button */}
          <div className="absolute bottom-4 right-4">
            <Button
              onClick={handleAddPin}
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