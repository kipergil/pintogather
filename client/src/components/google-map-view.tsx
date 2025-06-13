import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Maximize2, Info } from "lucide-react";
import { useLocation } from "wouter";
import { VenueSearch } from "@/components/venue-search-simple";
import { VenueResult } from "@/lib/venue-search";
import { loadGoogleMaps } from "@/lib/google-maps";
import { AddPinModal } from "@/components/add-pin-modal";
import { reverseGeocode } from "@/lib/map-utils";

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
  const [, setLocation] = useLocation();
  const [isAddPinModalOpen, setIsAddPinModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        console.log('Starting Google Maps initialization...');
        console.log('Map container ref:', mapRef.current);
        console.log('Existing map instance:', mapInstanceRef.current);
        
        if (!mapRef.current) {
          console.error('Map container not found');
          return;
        }

        await loadGoogleMaps();
        console.log('Google Maps loaded successfully');
        
        // Check if Google Maps API is available
        if (typeof google === 'undefined' || !google.maps) {
          console.error('Google Maps API not loaded properly');
          setIsLoading(false);
          return;
        }
        
        if (mapRef.current && !mapInstanceRef.current) {
          console.log('Creating Google Maps instance...');
          console.log('Container dimensions:', {
            width: mapRef.current.offsetWidth,
            height: mapRef.current.offsetHeight,
            display: window.getComputedStyle(mapRef.current).display
          });

          // Calculate center from pins or use default
          let center = { lat: 51.505, lng: -0.09 }; // Default to London
          
          if (mapCollection.pins.length > 0) {
            const lats = mapCollection.pins.map(pin => parseFloat(pin.latitude));
            const lngs = mapCollection.pins.map(pin => parseFloat(pin.longitude));
            center = {
              lat: lats.reduce((a, b) => a + b, 0) / lats.length,
              lng: lngs.reduce((a, b) => a + b, 0) / lngs.length
            };
          }

          console.log('Map center:', center);

          // Create map with error handling
          try {
            const map = new google.maps.Map(mapRef.current, {
              zoom: mapCollection.pins.length > 0 ? 10 : 2,
              center,
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
            console.log('Google Maps instance created successfully');
            
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

            // Add existing pins
            addPinsToMap(map);
            
            // Wait for map to be fully loaded
            google.maps.event.addListenerOnce(map, 'idle', () => {
              console.log('Google Maps fully loaded and idle');
              setIsLoading(false);
            });
          } catch (mapError) {
            console.error('Error creating Google Maps instance:', mapError);
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to initialize Google Maps:', error);
        console.error('Error details:', error);
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
          url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ef4444">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(24, 24),
          anchor: new google.maps.Point(12, 24)
        }
      });

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="max-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">${pin.userName}</h3>
            ${pin.address ? `<p style="margin: 0 0 4px 0; font-size: 14px;">${pin.address}</p>` : ''}
            ${pin.note ? `<p style="margin: 0; font-size: 12px; color: #666;">${pin.note}</p>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all pins
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
    
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    return {
      north: ne.lat(),
      south: sw.lat(),
      east: ne.lng(),
      west: sw.lng()
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
      {/* Map Controls */}
      <Card>
        <div className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/")}
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
            
            <VenueSearch 
              onVenueSelect={handleVenueSelect}
              mapBounds={getMapBounds()}
              className="flex-1 max-w-md"
            />
          </div>
        </div>
      </Card>

      {/* Map Container */}
      <Card>
        <div className="relative">
          <div 
            ref={mapRef} 
            className="w-full h-96 rounded-lg"
            style={{ minHeight: '400px' }}
          />
          
          {/* Map Info Overlay */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-neutral-700">
                <p className="font-medium mb-1">Click anywhere to add a pin</p>
                <p>Share this map's URL with others to collaborate</p>
              </div>
            </div>
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