import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { MapPin, Maximize2, MousePointerClick, Search } from 'lucide-react';
import { AddPinModal } from './add-pin-modal';
import { loadGoogleMaps } from '../lib/google-maps';
import { buildSocialUrl } from '../lib/social-links';

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

// Minimal inline SVGs mirroring lucide-react's icon paths, so the map popup's
// icons match the ones used elsewhere in the app without pulling in React.
function iconSvg(paths: string): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const ICONS = {
  twitter: iconSvg(
    '<path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>',
  ),
  instagram: iconSvg(
    '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  ),
  linkedin: iconSvg(
    '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
  ),
  externalLink: iconSvg(
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  ),
  x: iconSvg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
};

// A single compact row of icon links: socials (whichever handles are set)
// plus the Google Maps link, whichever of these exist for this pin.
function buildLinksRow(pin: Pin): string {
  const links: string[] = [];
  const twitterUrl = buildSocialUrl('twitter', pin.twitterHandle);
  if (twitterUrl) {
    links.push(
      `<a href="${escapeHtml(twitterUrl)}" target="_blank" rel="noopener noreferrer" title="Twitter" style="color:#475569; display:inline-flex;">${ICONS.twitter}</a>`,
    );
  }
  const instagramUrl = buildSocialUrl('instagram', pin.instagramHandle);
  if (instagramUrl) {
    links.push(
      `<a href="${escapeHtml(instagramUrl)}" target="_blank" rel="noopener noreferrer" title="Instagram" style="color:#475569; display:inline-flex;">${ICONS.instagram}</a>`,
    );
  }
  const linkedinUrl = buildSocialUrl('linkedin', pin.linkedinHandle);
  if (linkedinUrl) {
    links.push(
      `<a href="${escapeHtml(linkedinUrl)}" target="_blank" rel="noopener noreferrer" title="LinkedIn" style="color:#475569; display:inline-flex;">${ICONS.linkedin}</a>`,
    );
  }
  if (pin.googleMapsUrl) {
    links.push(
      `<a href="${escapeHtml(pin.googleMapsUrl)}" target="_blank" rel="noopener noreferrer" title="View on Google Maps" style="color:#1E40AF; display:inline-flex;">${ICONS.externalLink}</a>`,
    );
  }
  if (links.length === 0) return '';
  return `<div style="display:flex; align-items:center; gap:8px; margin-top:6px;">${links.join('')}</div>`;
}

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
  googleMapsUrl?: string | null;
  createdAt: string;
}

interface SimpleMapProps {
  mapCollection: {
    id: string;
    name: string;
    shareUrl: string;
    noteLabel?: string | null;
    notePrompt?: string | null;
    pins: Pin[];
  };
  /** Disables click-to-add-pin, for public/embedded views where visitors can only view. */
  readOnly?: boolean;
  /** Bumped by the parent (e.g. a pin-table row click) to pan/zoom to and open a specific pin. */
  focusRequest?: { pinId: string; nonce: number } | null;
}

export function SimpleGoogleMap({ mapCollection, readOnly = false, focusRequest }: SimpleMapProps) {
  console.log('SimpleGoogleMap component rendering with', mapCollection.pins.length, 'pins');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const markersByPinIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const activeInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
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

        // Create map — fitToAllPins() (called after markers are placed below)
        // adjusts the center/zoom to the actual pins, so the starting values
        // here only matter for the brief moment before that runs.
        console.log('Creating Google Maps instance');
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 51.5074, lng: -0.1278 }, // Default: London
          zoom: 10,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          gestureHandling: 'greedy', // Enable single-finger dragging
          zoomControl: true, // Show zoom buttons
          streetViewControl: false, // Hide street view icon
          mapTypeControl: false // Hide map/satellite view options
        });

        mapInstanceRef.current = map;
        console.log('Google Maps instance created successfully');

        // Add click listener for new pins (view-only maps skip this entirely)
        if (!readOnly) {
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
        }

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

  useEffect(() => {
    if (!focusRequest || !mapInstanceRef.current) return;
    const marker = markersByPinIdRef.current.get(focusRequest.pinId);
    const position = marker?.getPosition();
    if (!marker || !position) return;

    mapInstanceRef.current.panTo(position);
    if ((mapInstanceRef.current.getZoom() ?? 0) < 16) {
      mapInstanceRef.current.setZoom(16);
    }
    google.maps.event.trigger(marker, 'click');
  }, [focusRequest]);

  const updatePins = () => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    markersByPinIdRef.current.clear();

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
      const noteLabel = mapCollection.noteLabel || 'Note';

      // Info window — compact: title, optional location/note, then a single
      // row of social icons and/or the Google Maps link, whichever exist.
      // Google's own close button lives in a fixed-size row that gets clipped
      // when we shrink it via CSS, so we hide it entirely (see index.css) and
      // render our own close control inside content we fully control.
      const closeButtonId = `iw-close-${pin.id}`;
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="position: relative; padding: 4px 22px 4px 4px; min-width: 130px; max-width: 220px; font-family: inherit;">
            <button type="button" id="${closeButtonId}" aria-label="Close" style="position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; min-width: 18px; min-height: 18px; padding: 0; border: 0; background: none; color: #6b7280; cursor: pointer; display: flex; align-items: center; justify-content: center;">${ICONS.x}</button>
            <div style="font-weight: 600; font-size: 13px; line-height: 1.3; color: #111827;">${escapeHtml(pin.userName)}</div>
            ${locationText ? `<div style="margin-top: 2px; color: #666; font-size: 11px;">${escapeHtml(locationText)}</div>` : ''}
            ${pin.note ? `<div style="margin-top: 4px; font-size: 12px; color: #374151;"><strong>${escapeHtml(noteLabel)}:</strong> ${escapeHtml(pin.note)}</div>` : ''}
            ${buildLinksRow(pin)}
          </div>
        `
      });

      infoWindow.addListener('domready', () => {
        document.getElementById(closeButtonId)?.addEventListener('click', () => infoWindow.close());
      });

      marker.addListener('click', () => {
        activeInfoWindowRef.current?.close();
        infoWindow.open(mapInstanceRef.current, marker);
        activeInfoWindowRef.current = infoWindow;
      });

      markersRef.current.push(marker);
      markersByPinIdRef.current.set(pin.id, marker);
    });

    fitToAllPins();
  };

  // Re-centers/zooms the map to frame every pin — used both right after
  // markers are (re)built and by the "Reset view" button.
  const fitToAllPins = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (mapCollection.pins.length === 0) {
      map.setCenter({ lat: 51.5074, lng: -0.1278 });
      map.setZoom(10);
      return;
    }

    if (mapCollection.pins.length === 1) {
      const [pin] = mapCollection.pins;
      map.setCenter({ lat: parseFloat(pin.latitude), lng: parseFloat(pin.longitude) });
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    mapCollection.pins.forEach(pin => {
      bounds.extend({
        lat: parseFloat(pin.latitude),
        lng: parseFloat(pin.longitude)
      });
    });
    map.fitBounds(bounds);
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
      {!readOnly && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MousePointerClick className="h-4 w-4 shrink-0" />
            Click anywhere on the map to drop a pin there
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedLocation(null);
              setIsAddPinModalOpen(true);
            }}
            data-testid="button-add-venue"
          >
            <Search className="h-4 w-4 mr-1.5" />
            Add a venue
          </Button>
        </div>
      )}

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
          {!isLoading && !error && mapCollection.pins.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute top-2 left-2 shadow-md"
              onClick={fitToAllPins}
              title="Show all pins"
              data-testid="button-reset-map-view"
            >
              <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
              Reset view
            </Button>
          )}
        </div>
      </Card>

      {/* Add Pin Modal */}
      {!readOnly && (
        <AddPinModal
          isOpen={isAddPinModalOpen}
          onClose={() => {
            setIsAddPinModalOpen(false);
            setSelectedLocation(null);
          }}
          mapCollection={mapCollection}
          selectedLocation={selectedLocation}
        />
      )}
    </div>
  );
}