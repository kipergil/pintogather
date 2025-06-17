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
  town?: string;
  borough?: string;
  postcode?: string;
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
  console.log('SimpleGoogleMap component rendering with', mapCollection.pins.length, 'pins');
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddPinModalOpen, setIsAddPinModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);

  useEffect(() => {
    console.log('SimpleGoogleMap useEffect triggered');
    
    // Force immediate initialization
    const init = async () => {
      try {
        setIsLoading(true);
        console.log('Starting immediate map initialization');
        
        if (!mapRef.current) {
          throw new Error('Map container not found');
        }

        console.log('Loading Google Maps API...');
        await loadGoogleMaps();
        console.log('Google Maps API loaded successfully');

        // Calculate center from pins
        let center = { lat: 51.5074, lng: -0.1278 }; // Default: London
        let zoom = 10; // Default zoom for London

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
        console.log('Creating Google Maps instance with center:', center, 'zoom:', zoom);
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          gestureHandling: 'greedy' // Enable single-finger dragging
        });

        mapInstanceRef.current = map;
        console.log('Google Maps instance created successfully');

        // Add click listener for new pins
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          console.log('Map clicked at:', e.latLng?.lat(), e.latLng?.lng());
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
        console.log('Map initialization complete');
        setIsLoading(false);

      } catch (error) {
        console.error('Failed to initialize map:', error);
        setError(`Failed to initialize map: ${error}`);
        setIsLoading(false);
      }
    };
    
    // Small delay to ensure DOM is rendered
    setTimeout(() => {
      init();
    }, 50);
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) {
      updatePins();
    }
  }, [mapCollection.pins]);

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

      // Create concise location info - using only available fields
      const locationParts = [];
      if (pin.city) locationParts.push(pin.city);
      if (pin.state) locationParts.push(pin.state);
      const locationText = locationParts.join(', ');

      // Info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 150px;">
            <h3 style="margin: 0 0 4px 0; font-weight: 600;">${pin.userName}</h3>
            ${locationText ? `<p style="margin: 4px 0; color: #666; font-size: 12px;">${locationText}</p>` : ''}
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

  if (error) {
    return (
      <Card>
        <div className="h-96 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-red-600 font-medium mb-2">Map Error</p>
            <p className="text-sm text-gray-600">{error}</p>
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
            className="w-full h-96 rounded-lg bg-gray-100"
            style={{ 
              height: '400px',
              minHeight: '400px',
              width: '100%',
              position: 'relative'
            }}
          />

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