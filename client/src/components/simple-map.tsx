import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/google-maps';

interface SimpleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
}

export function SimpleMap({ center = { lat: 51.505, lng: -0.09 }, zoom = 10 }: SimpleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      try {
        console.log('SimpleMap: Loading Google Maps...');
        await loadGoogleMaps();
        
        console.log('SimpleMap: Creating map instance...');
        console.log('SimpleMap: Container dimensions:', {
          width: mapRef.current.offsetWidth,
          height: mapRef.current.offsetHeight
        });

        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        mapInstanceRef.current = map;
        console.log('SimpleMap: Map created successfully');

        // Add a marker to test
        new google.maps.Marker({
          position: center,
          map: map,
          title: 'Test Marker'
        });

      } catch (error) {
        console.error('SimpleMap: Error creating map:', error);
      }
    };

    initMap();
  }, [center, zoom]);

  return (
    <div 
      ref={mapRef}
      style={{
        width: '100%',
        height: '400px',
        backgroundColor: '#f0f0f0',
        border: '1px solid #ccc'
      }}
    />
  );
}