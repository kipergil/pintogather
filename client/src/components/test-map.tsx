import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/google-maps';

export function TestMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    console.log('TestMap component mounted');
    
    const init = async () => {
      try {
        setStatus('Loading Google Maps API...');
        console.log('Loading Google Maps API...');
        
        await loadGoogleMaps();
        console.log('Google Maps API loaded');
        setStatus('Creating map...');
        
        if (mapRef.current) {
          console.log('Creating map instance');
          const map = new google.maps.Map(mapRef.current, {
            center: { lat: 51.5074, lng: -0.1278 },
            zoom: 10
          });
          
          console.log('Map created successfully');
          setStatus('Map loaded successfully!');
        } else {
          console.error('Map container not found');
          setStatus('Error: Map container not found');
        }
      } catch (error) {
        console.error('Error:', error);
        setStatus(`Error: ${error}`);
      }
    };
    
    init();
  }, []);

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Test Map</h3>
      <p className="mb-4 text-sm text-gray-600">Status: {status}</p>
      <div 
        ref={mapRef}
        className="w-full h-64 bg-gray-200 border rounded"
        style={{ height: '300px' }}
      />
    </div>
  );
}