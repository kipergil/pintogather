import { useEffect, useRef, useState } from 'react';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Expand, Loader2, Locate, LocateFixed, MapPin, Maximize2, MousePointerClick, Search, X } from 'lucide-react';
import { AddPinModal } from './add-pin-modal';
import { loadGoogleMaps } from '../lib/google-maps';
import { sortPinsForRoute } from '@shared/geo';
import { buildSocialUrl } from '../lib/social-links';
import { useToast } from '../hooks/use-toast';
import { buildPinMarkerIcon, resolvePinStyle } from '../lib/pin-styles';
import type { PinColor, PinIcon } from '@shared/enums';

/** Google's familiar "blue dot" color for a user's own location — deliberately distinct from the app's default pin color (blue). */
const MY_LOCATION_COLOR = '#4285F4';

// Clustering logic: below this many pins, clustering isn't worth the
// overhead — every pin just shows individually, at every zoom level. At or
// above it, pins group into clusters when zoomed out (or just crowded
// together), but still fall back to individual markers once zoomed in past
// CLUSTER_MAX_ZOOM — that close in, a cluster badge would only be hiding
// detail, not reducing clutter.
const CLUSTER_MIN_PIN_COUNT = 12;
const CLUSTER_MAX_ZOOM = 15;
const CLUSTER_RADIUS = 60;

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
  check: iconSvg('<polyline points="20 6 9 17 4 12"/>'),
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
  title: string;
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
  photoUrl?: string | null;
  approved?: boolean;
  pinColor?: PinColor | null;
  pinIcon?: PinIcon | null;
  sequence?: number | null;
  createdAt: string;
}

interface SimpleMapProps {
  mapCollection: {
    id: string;
    name: string;
    shareUrl: string;
    noteLabel?: string | null;
    notePrompt?: string | null;
    defaultPinColor?: PinColor | null;
    defaultPinIcon?: PinIcon | null;
    hasPinCustomization?: boolean;
    pins: Pin[];
  };
  /** Disables click-to-add-pin, for public/embedded views where visitors can only view. */
  readOnly?: boolean;
  /** Bumped by the parent (e.g. a pin-table row click) to pan/zoom to and open a specific pin. */
  focusRequest?: { pinId: string; nonce: number } | null;
  /** Draws a route line through the pins in their route/itinerary order (see route-view.tsx) — a driving route where possible, falling back to a straight line. */
  showRoute?: boolean;
}

export function SimpleGoogleMap({ mapCollection, readOnly = false, focusRequest, showRoute = false }: SimpleMapProps) {
  console.log('SimpleGoogleMap component rendering with', mapCollection.pins.length, 'pins');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const markersByPinIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  // Whether the current clustererRef instance was built with clustering on
  // or off — the algorithm can't be swapped on an existing MarkerClusterer,
  // so updatePins() recreates the instance whenever this needs to flip.
  const clusteringEnabledRef = useRef<boolean | null>(null);
  const activeInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  // The temporary marker + confirm/cancel bubble shown after a click while
  // "Add pin" mode is armed — the actual pin isn't created until the user
  // confirms, so an accidental or mis-aimed click can't drop a pin outright.
  const pendingMarkerRef = useRef<google.maps.Marker | null>(null);
  const pendingInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // "Show my location" — opt-in only, never requested automatically. Off by
  // default; the user must click the toggle button, which is what triggers
  // the browser's permission prompt if it hasn't been granted yet.
  const [myLocationStatus, setMyLocationStatus] = useState<'off' | 'locating' | 'on'>('off');
  const myLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const myLocationAccuracyCircleRef = useRef<google.maps.Circle | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);
  // Backstop for the (rare, but observed) case where the browser's own
  // geolocation `timeout` option doesn't fire — e.g. the permission prompt
  // itself sits unanswered — so the button never gets stuck on "locating".
  const geoTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAddPinModalOpen, setIsAddPinModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);
  // Whether "Add pin" mode is toggled on, i.e. clicking the map opens the
  // add-pin dialog. Read from a ref inside the map's click listener (set up
  // once on mount) so it always sees the latest value instead of a stale one.
  const [isArmedForClick, setIsArmedForClick] = useState(false);
  const isArmedForClickRef = useRef(isArmedForClick);
  useEffect(() => {
    isArmedForClickRef.current = isArmedForClick;
    if (!isArmedForClick) {
      clearPendingLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArmedForClick]);

  // Full-screen mode: the browser's native Fullscreen API (not a CSS-only
  // fake) so ESC-to-exit and other OS/browser affordances work for free.
  // fullscreenContainerRef wraps the map card + the pin-title legend that's
  // only shown while full-screen, since requestFullscreen() blows up a
  // single element to fill the viewport.
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === fullscreenContainerRef.current;
      setIsFullscreen(active);
      // Google Maps doesn't observe container resizes on its own — nudge it
      // once the fullscreen transition (and the browser's own layout pass)
      // has actually happened.
      setTimeout(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        google.maps.event.trigger(map, 'resize');
        fitToAllPins();
      }, 50);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      fullscreenContainerRef.current?.requestFullscreen();
    }
  };

  // Pans/zooms to a pin and opens its info window — shared by the
  // full-screen legend's click handler and the focusRequest effect below.
  const focusOnPin = (pinId: string) => {
    const map = mapInstanceRef.current;
    const marker = markersByPinIdRef.current.get(pinId);
    const position = marker?.getPosition();
    if (!map || !marker || !position) return;
    map.panTo(position);
    if ((map.getZoom() ?? 0) < 16) {
      map.setZoom(16);
    }
    google.maps.event.addListenerOnce(map, 'idle', () => {
      google.maps.event.trigger(marker, 'click');
    });
  };

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
          mapTypeControl: false, // Hide map/satellite view options
          // Without this, clicking a POI icon (a restaurant, landmark, etc.)
          // opens Google's own default info window on top of ours, which
          // visually blocks the "Drop a pin here?" confirm bubble and makes
          // it look like the click did nothing. The map still fires its
          // normal 'click' event with the clicked lat/lng either way, so
          // click-to-add-pin behaves the same everywhere on the map.
          clickableIcons: false,
        });

        mapInstanceRef.current = map;
        console.log('Google Maps instance created successfully');

        // Add click listener for new pins (view-only maps skip this entirely).
        // Only shows the confirm/cancel bubble while "Add pin" mode is armed;
        // the dialog itself only opens once the user confirms that spot.
        if (!readOnly) {
          map.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (!isArmedForClickRef.current) return;
            console.log('Map clicked at:', e.latLng?.lat(), e.latLng?.lng());
            if (e.latLng) {
              showPendingLocationConfirm(e.latLng.lat(), e.latLng.lng());
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
    if (!focusRequest) return;
    let cancelled = false;
    let attempts = 0;

    // A pin-table row click (the original trigger for this) only fires once
    // the map is already fully loaded and interactive, so the map/marker
    // refs are always ready on the first check. A URL-driven deep link (see
    // map-detail.tsx's ?pin= handling) can set focusRequest before the map
    // has finished initializing, so this retries briefly instead of just
    // giving up — resolves immediately in the already-loaded case.
    const tryFocus = () => {
      if (cancelled) return;
      const map = mapInstanceRef.current;
      const marker = focusRequest && map ? markersByPinIdRef.current.get(focusRequest.pinId) : undefined;
      const position = marker?.getPosition();
      if (map && marker && position) {
        map.panTo(position);
        if ((map.getZoom() ?? 0) < 16) {
          map.setZoom(16);
        }
        // Wait for the map to settle before clicking — at this zoom the
        // marker should have declustered, but the clusterer only re-renders
        // on 'idle', so clicking immediately can hit a marker still hidden
        // inside a cluster.
        google.maps.event.addListenerOnce(map, 'idle', () => {
          google.maps.event.trigger(marker, 'click');
        });
        return;
      }
      attempts += 1;
      if (attempts < 25) setTimeout(tryFocus, 200); // up to ~5s while the map finishes loading
    };
    tryFocus();

    return () => {
      cancelled = true;
    };
  }, [focusRequest]);

  // Removes the pending-location marker and its confirm/cancel bubble, if any.
  // Safe to call even when nothing is pending.
  const clearPendingLocation = () => {
    pendingInfoWindowRef.current?.close();
    pendingInfoWindowRef.current = null;
    pendingMarkerRef.current?.setMap(null);
    pendingMarkerRef.current = null;
  };

  // Drops a temporary marker at the clicked spot with a small "Drop a pin
  // here?" bubble offering Confirm/Cancel, instead of opening the Add Pin
  // dialog immediately — guards against accidental or mis-aimed clicks.
  // Clicking elsewhere while armed just moves the pending spot here.
  const showPendingLocationConfirm = (lat: number, lng: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    clearPendingLocation();

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#2563EB',
        fillOpacity: 0.9,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      zIndex: 9999,
      clickable: false,
    });
    pendingMarkerRef.current = marker;

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 6px 4px; min-width: 170px; font-family: inherit;">
          <div style="font-size: 12px; color: #374151; margin-bottom: 8px;">Drop a pin here?</div>
          <div style="display: flex; gap: 8px;">
            <button type="button" id="pending-pin-confirm" style="flex:1; display:flex; align-items:center; justify-content:center; gap:4px; background:#2563EB; color:#fff; border:0; border-radius:6px; padding:6px 10px; font-size:12px; font-weight:600; cursor:pointer;">${ICONS.check} Confirm</button>
            <button type="button" id="pending-pin-cancel" style="flex:1; display:flex; align-items:center; justify-content:center; gap:4px; background:#fff; color:#374151; border:1px solid #d1d5db; border-radius:6px; padding:6px 10px; font-size:12px; font-weight:600; cursor:pointer;">${ICONS.x} Cancel</button>
          </div>
        </div>
      `,
    });

    infoWindow.addListener('domready', () => {
      document.getElementById('pending-pin-confirm')?.addEventListener('click', () => {
        setSelectedLocation({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
        setIsAddPinModalOpen(true);
        clearPendingLocation();
      });
      document.getElementById('pending-pin-cancel')?.addEventListener('click', () => {
        clearPendingLocation();
      });
    });
    infoWindow.addListener('closeclick', clearPendingLocation);

    infoWindow.open(map, marker);
    pendingInfoWindowRef.current = infoWindow;
  };

  const updatePins = () => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    clustererRef.current?.clearMarkers();
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    markersByPinIdRef.current.clear();

    // Add markers for each pin. The map is intentionally left unset here —
    // the MarkerClusterer below takes ownership of each marker's map
    // assignment, showing either the individual marker or a cluster badge
    // depending on the current zoom level.
    mapCollection.pins.forEach(pin => {
      const { color, icon } = resolvePinStyle(pin, mapCollection);
      const marker = new google.maps.Marker({
        position: {
          lat: parseFloat(pin.latitude),
          lng: parseFloat(pin.longitude)
        },
        title: pin.title,
        icon: buildPinMarkerIcon({ color, icon, pending: pin.approved === false }),
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
            ${pin.photoUrl ? `<img src="${escapeHtml(pin.photoUrl)}" alt="" style="display: block; width: 100%; max-height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 6px;" />` : ''}
            <div style="font-weight: 600; font-size: 13px; line-height: 1.3; color: #111827;">${escapeHtml(pin.title)}</div>
            ${pin.approved === false ? `<div style="margin-top: 2px; color: #B45309; font-size: 11px; font-weight: 600;">Pending approval</div>` : ''}
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

    const shouldCluster = mapCollection.pins.length >= CLUSTER_MIN_PIN_COUNT;
    if (!shouldCluster) {
      // Below the threshold, skip the clusterer entirely and show every pin
      // as its own marker — simpler, and sidesteps a MarkerClusterer quirk
      // where an always-"nothing changed" algorithm (e.g. a no-op) makes it
      // skip its own render pass, so markers never actually get placed on
      // the map at all. See CLUSTER_MIN_PIN_COUNT above.
      clustererRef.current?.setMap(null);
      clustererRef.current = null;
      clusteringEnabledRef.current = false;
      markersRef.current.forEach((marker) => marker.setMap(mapInstanceRef.current));
    } else if (clustererRef.current && clusteringEnabledRef.current === true) {
      clustererRef.current.addMarkers(markersRef.current);
    } else {
      // Mode flipped (or this is the first run) — recreate the clusterer.
      clustererRef.current?.setMap(null);
      clustererRef.current = new MarkerClusterer({
        map: mapInstanceRef.current,
        markers: markersRef.current,
        algorithm: new SuperClusterAlgorithm({ radius: CLUSTER_RADIUS, maxZoom: CLUSTER_MAX_ZOOM }),
      });
      clusteringEnabledRef.current = shouldCluster;
    }

    fitToAllPins();
    drawOrClearRoute();
  };

  // Draws a line through the pins in their route/itinerary order (see
  // route-view.tsx / shared/geo.ts's sortPinsForRoute) — a real driving
  // route via DirectionsService where possible, falling back to a straight
  // polyline for routes DirectionsService can't handle (over its 25-stop
  // waypoint cap, or no drivable path between stops, e.g. overseas legs).
  const drawOrClearRoute = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const orderedPins = sortPinsForRoute(mapCollection.pins);
    if (!showRoute || orderedPins.length < 2) {
      directionsRendererRef.current?.setMap(null);
      routePolylineRef.current?.setMap(null);
      return;
    }

    const points = orderedPins.map(pin => ({ lat: parseFloat(pin.latitude), lng: parseFloat(pin.longitude) }));

    const drawStraightPolyline = () => {
      directionsRendererRef.current?.setMap(null);
      if (!routePolylineRef.current) {
        routePolylineRef.current = new google.maps.Polyline({
          map,
          path: points,
          strokeColor: '#2563EB',
          strokeWeight: 3,
          strokeOpacity: 0.8,
        });
      } else {
        routePolylineRef.current.setPath(points);
        routePolylineRef.current.setMap(map);
      }
    };

    // Directions API's waypoints (excluding origin/destination) cap out at 23.
    if (points.length > 25) {
      drawStraightPolyline();
      return;
    }

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({ suppressMarkers: true, preserveViewport: true });
    }
    directionsRendererRef.current.setMap(map);
    routePolylineRef.current?.setMap(null);

    new google.maps.DirectionsService().route(
      {
        origin: points[0],
        destination: points[points.length - 1],
        waypoints: points.slice(1, -1).map(location => ({ location, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRendererRef.current?.setDirections(result);
        } else {
          drawStraightPolyline();
        }
      },
    );
  };

  useEffect(() => {
    if (mapInstanceRef.current) drawOrClearRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRoute]);

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

  // Places (or moves) the "your location" marker + accuracy halo. Pans/zooms
  // to it only the first time it appears, so later position updates while
  // watching don't yank the view out from under the user.
  const updateMyLocationMarker = (position: GeolocationPosition) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const latLng = { lat: position.coords.latitude, lng: position.coords.longitude };

    if (!myLocationMarkerRef.current) {
      myLocationMarkerRef.current = new google.maps.Marker({
        position: latLng,
        map,
        title: 'Your location',
        zIndex: 9999,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: MY_LOCATION_COLOR,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      map.panTo(latLng);
      if ((map.getZoom() ?? 0) < 14) map.setZoom(14);
    } else {
      myLocationMarkerRef.current.setPosition(latLng);
    }

    if (!myLocationAccuracyCircleRef.current) {
      myLocationAccuracyCircleRef.current = new google.maps.Circle({
        map,
        center: latLng,
        radius: position.coords.accuracy,
        fillColor: MY_LOCATION_COLOR,
        fillOpacity: 0.15,
        strokeColor: MY_LOCATION_COLOR,
        strokeOpacity: 0.3,
        strokeWeight: 1,
        clickable: false,
      });
    } else {
      myLocationAccuracyCircleRef.current.setCenter(latLng);
      myLocationAccuracyCircleRef.current.setRadius(position.coords.accuracy);
    }

    clearGeoTimeout();
    setMyLocationStatus('on');
  };

  const clearGeoTimeout = () => {
    if (geoTimeoutIdRef.current !== null) {
      clearTimeout(geoTimeoutIdRef.current);
      geoTimeoutIdRef.current = null;
    }
  };

  const stopWatchingMyLocation = () => {
    clearGeoTimeout();
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
    myLocationMarkerRef.current?.setMap(null);
    myLocationMarkerRef.current = null;
    myLocationAccuracyCircleRef.current?.setMap(null);
    myLocationAccuracyCircleRef.current = null;
  };

  // Toggle handler for the "My location" button — the only place location
  // permission is ever requested; nothing here runs until the user clicks it.
  const handleToggleMyLocation = () => {
    if (myLocationStatus !== 'off') {
      stopWatchingMyLocation();
      setMyLocationStatus('off');
      return;
    }

    if (!navigator.geolocation) {
      toast({
        title: 'Location not available',
        description: "Your browser doesn't support geolocation.",
        variant: 'destructive',
      });
      return;
    }

    setMyLocationStatus('locating');
    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      updateMyLocationMarker,
      (geoError) => {
        let description = "Couldn't get your location. Please try again.";
        if (geoError.code === geoError.PERMISSION_DENIED) {
          description = 'Location permission was denied. Allow it in your browser settings to show your position.';
        } else if (geoError.code === geoError.TIMEOUT) {
          description = 'Getting your location timed out. Please try again.';
        }
        toast({ title: "Couldn't show your location", description, variant: 'destructive' });
        stopWatchingMyLocation();
        setMyLocationStatus('off');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );

    // Some browsers leave the permission prompt unanswered indefinitely
    // (or otherwise never invoke either callback) — without this, the
    // button would stay stuck on "locating" forever in that case.
    geoTimeoutIdRef.current = setTimeout(() => {
      toast({
        title: "Couldn't show your location",
        description: 'No response to the location permission request. Please try again.',
        variant: 'destructive',
      });
      stopWatchingMyLocation();
      setMyLocationStatus('off');
    }, 15000);
  };

  // Stop watching if the map unmounts while location sharing is on.
  useEffect(() => {
    return () => {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
      if (geoTimeoutIdRef.current !== null) {
        clearTimeout(geoTimeoutIdRef.current);
      }
      clearPendingLocation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isArmedForClick ? "default" : "outline"}
              onClick={() => setIsArmedForClick((prev) => !prev)}
              data-testid="button-add-pin-mode"
            >
              <MousePointerClick className="h-4 w-4 mr-1.5" />
              Add pin
            </Button>
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
              Add venue
            </Button>
          </div>
          {isArmedForClick ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mt-2.5">
              <MousePointerClick className="h-4 w-4 shrink-0" />
              Click anywhere on the map, then confirm the spot to drop a pin there
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-2.5">
              Two ways to add a pin — click the map to drop one anywhere, or search for a specific venue.
            </p>
          )}
        </div>
      )}

      <div ref={fullscreenContainerRef} className={isFullscreen ? 'h-screen bg-background' : ''}>
        <Card className={isFullscreen ? 'h-full rounded-none border-0' : undefined}>
          <div className={isFullscreen ? 'relative h-full' : 'relative'}>
            <div
              ref={mapRef}
              className={isFullscreen ? 'w-full h-full' : 'w-full h-96 rounded-lg bg-gray-100'}
              style={
                isFullscreen
                  ? undefined
                  : { height: '400px', minHeight: '400px', width: '100%', position: 'relative' }
              }
            />
            {!isLoading && !error && mapCollection.pins.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-2 left-2 h-7 w-7 min-h-7 rounded-full opacity-80 shadow-sm hover:opacity-100"
                onClick={fitToAllPins}
                title="Show all pins"
                data-testid="button-reset-map-view"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {!isLoading && !error && (
              <Button
                type="button"
                variant={myLocationStatus === 'on' ? 'default' : 'secondary'}
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 min-h-7 rounded-full opacity-80 shadow-sm hover:opacity-100"
                onClick={handleToggleMyLocation}
                disabled={myLocationStatus === 'locating'}
                title={myLocationStatus === 'on' ? 'Hide your location' : 'Show your location'}
                data-testid="button-toggle-my-location"
              >
                {myLocationStatus === 'locating' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : myLocationStatus === 'on' ? (
                  <LocateFixed className="h-3.5 w-3.5" />
                ) : (
                  <Locate className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            {!isLoading && !error && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-11 right-2 h-7 w-7 min-h-7 rounded-full opacity-80 shadow-sm hover:opacity-100"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit full screen' : 'View full screen'}
                data-testid="button-toggle-fullscreen"
              >
                {isFullscreen ? <X className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
              </Button>
            )}
            {isFullscreen && mapCollection.pins.length > 0 && (
              <div
                className="absolute top-2 right-11 max-h-[calc(100%-1rem)] w-56 overflow-y-auto rounded-lg border border-border bg-background/95 shadow-md backdrop-blur-sm"
                data-testid="map-fullscreen-legend"
              >
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
                  Pins ({mapCollection.pins.length})
                </div>
                <ul>
                  {mapCollection.pins.map((pin) => (
                    <li key={pin.id}>
                      <button
                        type="button"
                        className="w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => focusOnPin(pin.id)}
                        title={pin.title}
                        data-testid={`legend-item-${pin.id}`}
                      >
                        {pin.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

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