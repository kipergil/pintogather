import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddPinModal } from "./add-pin-modal";
import { Home, Maximize2, Info } from "lucide-react";

// Leaflet imports with proper types
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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
  const mapRef = useRef<L.Map | null>(null);
  const markersClusterGroupRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isAddPinModalOpen, setIsAddPinModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map with London as default location and zoom level 5
    const map = L.map(mapContainerRef.current).setView([51.5074, -0.1278], 5);
    mapRef.current = map;

    // Add CartoDB Positron tile layer (cleaner, less crowded)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Initialize marker cluster group with custom styling
    const markerClusterGroup = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      iconCreateFunction: function(cluster: any) {
        const count = cluster.getChildCount();
        let c = ' marker-cluster-';
        if (count < 10) {
          c += 'small';
        } else if (count < 100) {
          c += 'medium';
        } else {
          c += 'large';
        }
        
        return new L.DivIcon({
          html: '<div><span>' + count + '</span></div>',
          className: 'marker-cluster' + c,
          iconSize: new L.Point(40, 40)
        });
      }
    });
    
    markersClusterGroupRef.current = markerClusterGroup;
    map.addLayer(markerClusterGroup);

    // Add click handler for adding pins
    map.on('click', (e: any) => {
      setSelectedLocation({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
      setIsAddPinModalOpen(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersClusterGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersClusterGroupRef.current) return;

    // Clear existing markers from cluster group
    markersClusterGroupRef.current.clearLayers();

    if (!mapCollection.pins.length) return;

    // Add markers to cluster group
    const markers: L.Marker[] = [];
    mapCollection.pins.forEach((pin) => {
      const marker = L.marker([parseFloat(pin.latitude), parseFloat(pin.longitude)]);

      const socialLinks = [
        pin.twitterHandle && `<a href="https://twitter.com/${pin.twitterHandle}" target="_blank" class="text-blue-500 hover:underline">Twitter</a>`,
        pin.instagramHandle && `<a href="https://instagram.com/${pin.instagramHandle}" target="_blank" class="text-pink-500 hover:underline">Instagram</a>`,
        pin.linkedinHandle && `<a href="${pin.linkedinHandle.startsWith('http') ? pin.linkedinHandle : `https://linkedin.com/in/${pin.linkedinHandle}`}" target="_blank" class="text-blue-600 hover:underline">LinkedIn</a>`,
      ].filter(Boolean).join(' • ');

      marker.bindPopup(`
        <div class="p-2 min-w-[200px]">
          <h4 class="font-semibold text-neutral-900 mb-1">${pin.userName}</h4>
          ${pin.address ? `<p class="text-sm text-neutral-600 mb-2">${pin.address}</p>` : ''}
          ${pin.note ? `<p class="text-sm text-neutral-700 mb-2">${pin.note}</p>` : ''}
          ${socialLinks ? `<div class="text-xs">${socialLinks}</div>` : ''}
          <div class="text-xs text-neutral-500 mt-2">
            Added ${new Date(pin.createdAt).toLocaleDateString()}
          </div>
        </div>
      `);

      markers.push(marker);
    });

    // Add all markers to the cluster group
    markersClusterGroupRef.current.addLayers(markers);

    // Fit map to show all markers
    if (markers.length > 0) {
      const group = new L.FeatureGroup(markers);
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [mapCollection.pins]);

  const fitMapBounds = () => {
    if (!mapRef.current || !mapCollection.pins.length) return;
    
    const coordinates = mapCollection.pins.map(pin => [
      parseFloat(pin.latitude), 
      parseFloat(pin.longitude)
    ] as [number, number]);
    
    const bounds = L.latLngBounds(coordinates);
    mapRef.current.fitBounds(bounds.pad(0.1));
  };

  const resetMapView = () => {
    if (!mapRef.current) return;
    mapRef.current.setView([51.5074, -0.1278], 5);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="h-96 relative" ref={mapContainerRef}></div>
        
        {/* Map Controls */}
        <div className="p-4 border-t bg-neutral-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-neutral-600">
                <Info className="h-4 w-4 inline mr-1" />
                Click anywhere on the map to add a new pin
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={fitMapBounds}
                disabled={!mapCollection.pins.length}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetMapView}
              >
                <Home className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <AddPinModal
        isOpen={isAddPinModalOpen}
        onClose={() => setIsAddPinModalOpen(false)}
        mapCollection={mapCollection}
        selectedLocation={selectedLocation}
      />
    </>
  );
}
