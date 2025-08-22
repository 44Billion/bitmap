import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Rectangle } from 'react-leaflet';
import { decode, decode_bbox } from 'ngeohash';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { useEphemeralEvents, type EphemeralEventData } from '@/hooks/useEphemeralEvents';
import { AlertTriangle, Activity, MapPin, User, Plus, Minus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatDialog } from '@/components/chat/ChatDialog';
import { Button } from '@/components/ui/button';

interface HeatMapPoint {
  lat: number;
  lng: number;
  intensity: number;
  events: EphemeralEventData[];
}

// Custom zoom controls component
function CustomZoomControls({ mapRef }: { mapRef: React.RefObject<L.Map | null> }) {
  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  return (
    <div className="absolute top-4 left-4 bg-black/80 border border-green-500/30 rounded-lg font-mono text-xs z-50">
      <button
        onClick={handleZoomIn}
        className="flex items-center justify-center w-8 h-8 text-green-400 hover:bg-green-500/10 transition-colors border-b border-green-500/20"
        title="Zoom In"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        onClick={handleZoomOut}
        className="flex items-center justify-center w-8 h-8 text-green-400 hover:bg-green-500/10 transition-colors"
        title="Zoom Out"
      >
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}

// Component to highlight geohash bounds
function GeohashHighlight({ geohash }: { geohash: string | null }) {
  if (!geohash) return null;

  try {
    const [minLat, minLng, maxLat, maxLng] = decode_bbox(geohash);
    const bounds: [[number, number], [number, number]] = [
      [minLat, minLng],
      [maxLat, maxLng]
    ];

    return (
      <Rectangle
        bounds={bounds}
        pathOptions={{
          color: '#00ffff',
          fillColor: '#00ffff',
          fillOpacity: 0.1,
          weight: 2,
          opacity: 0.8,
          dashArray: '5, 5'
        }}
      />
    );
  } catch (error) {
    console.warn('Invalid geohash for highlighting:', geohash, error);
    return null;
  }
}

// Custom hook to enforce strict map boundaries
function MapBoundaryEnforcer() {
  const map = useMap();

  useEffect(() => {
    const bounds: LatLngExpression[] = [[-85, -250], [85, 250]];
    let isEnforcing = false;

    const enforceBounds = () => {
      if (isEnforcing) return; // Prevent recursion

      const currentBounds = map.getBounds();
      const mapBounds = L.latLngBounds(bounds);

      if (!mapBounds.contains(currentBounds)) {
        isEnforcing = true;
        map.fitBounds(mapBounds, { animate: false });
        setTimeout(() => {
          isEnforcing = false;
        }, 100);
      }
    };

    map.on('moveend', enforceBounds);

    return () => {
      map.off('moveend', enforceBounds);
    };
  }, [map]);

  return null;
}

const EventPopup = React.memo(({ point, onOpenChat }: {
  point: HeatMapPoint;
  onOpenChat: (geohash: string, events: EphemeralEventData[]) => void;
}) => {
  const latestEvent = point.events[0];
  const eventCount = point.events.length;

  return (
    <div className="min-w-[250px] max-w-[300px] bg-black/90 text-green-400 border border-cyan-500/50 rounded-lg p-3 font-mono text-xs">
      <div className="flex items-center gap-2 mb-2 text-cyan-400">
        <Activity className="h-3 w-3" />
        <span className="font-bold">BITCHAT DETECTED</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-3 w-3 text-red-400" />
          <span className="text-gray-300">
            {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
          </span>
        </div>

        {latestEvent.geohash && (
          <div className="flex items-center gap-2">
            <span className="text-purple-400 text-[10px]">GEOHASH:</span>
            <span className="text-purple-300 text-[10px] font-mono">
              {latestEvent.geohash}
            </span>
          </div>
        )}

        {latestEvent.nickname && (
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-blue-400" />
            <span className="text-blue-300">{latestEvent.nickname}</span>
          </div>
        )}

        <div className="bg-gray-900/50 p-2 rounded border border-gray-700">
          <div className="text-yellow-400 text-[10px] mb-1">LATEST TRANSMISSION:</div>
          <div className="text-gray-200 break-words">
            {latestEvent.message || '[ENCRYPTED]'}
          </div>
        </div>

        {eventCount > 1 && (
          <div className="text-orange-400 text-[10px]">
            +{eventCount - 1} additional bitchats detected
          </div>
        )}

        <div className="text-gray-500 text-[10px]">
          TIMESTAMP: {new Date(latestEvent.event.created_at * 1000).toLocaleString()}
        </div>
      </div>

      {/* Chat button */}
      {latestEvent.geohash && (
        <div className="mt-3 pt-2 border-t border-green-500/20">
          <Button
            onClick={() => onOpenChat(latestEvent.geohash!, point.events)}
            size="sm"
            className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/50 text-cyan-400 text-xs h-7"
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            OPEN CHAT
          </Button>
        </div>
      )}
    </div>
  );
});

export function EphemeralHeatMap({ className }: { className?: string }) {
  const { data: events, isLoading, error } = useEphemeralEvents();
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([40.7128, -74.0060]); // Default to NYC
  const [highlightedGeohash, setHighlightedGeohash] = useState<string | null>(null);
  const [chatDialog, setChatDialog] = useState<{
    isOpen: boolean;
    geohash: string;
    initialEvents: EphemeralEventData[];
  }>({ isOpen: false, geohash: '', initialEvents: [] });
  const mapRef = React.useRef<L.Map | null>(null);

  // Process events into heat map points
  const heatMapPoints = useMemo(() => {
    if (!events || events.length === 0) return [];

    // Group events by geohash to create intensity clusters
    const geohashGroups = new Map<string, EphemeralEventData[]>();

    events.forEach(event => {
      if (!event.geohash) return;

      // Use first 6 characters of geohash for clustering (roughly 1.2km precision)
      const clusterHash = event.geohash.substring(0, 6);

      if (!geohashGroups.has(clusterHash)) {
        geohashGroups.set(clusterHash, []);
      }
      geohashGroups.get(clusterHash)!.push(event);
    });

    // Convert to heat map points
    const points: HeatMapPoint[] = [];

    geohashGroups.forEach((groupEvents, geohash) => {
      try {
        const { latitude, longitude } = decode(geohash);
        points.push({
          lat: latitude,
          lng: longitude,
          intensity: groupEvents.length,
          events: groupEvents.sort((a, b) => b.event.created_at - a.event.created_at), // Sort by newest first
        });
      } catch (error) {
        console.warn('Invalid geohash:', geohash, error);
      }
    });

    // Auto-center map on first event if available
    if (points.length > 0 && events.length > 0) {
      setMapCenter([points[0].lat, points[0].lng]);
    }

    return points;
  }, [events]);

  // Calculate intensity colors (hacker green to red scale)
  const getIntensityColor = (intensity: number, maxIntensity: number) => {
    const ratio = intensity / Math.max(maxIntensity, 1);

    if (ratio < 0.3) return '#00ff41'; // Matrix green
    if (ratio < 0.6) return '#ffff00'; // Yellow warning
    if (ratio < 0.8) return '#ff8c00'; // Orange alert
    return '#ff0000'; // Red critical
  };

  const getIntensityRadius = (intensity: number, maxIntensity: number) => {
    const ratio = intensity / Math.max(maxIntensity, 1);
    return Math.max(8, Math.min(25, 8 + ratio * 17));
  };

  const maxIntensity = Math.max(...heatMapPoints.map(p => p.intensity), 1);

  // Chat dialog handlers
  const handleOpenChat = (geohash: string, events: EphemeralEventData[]) => {
    setChatDialog({
      isOpen: true,
      geohash,
      initialEvents: events,
    });
  };

  const handleCloseChat = () => {
    setChatDialog(prev => ({ ...prev, isOpen: false }));
  };

  if (isLoading) {
    return (
      <div className={cn("bg-black flex items-center justify-center", className)}>
        <div className="text-center text-cyan-400 font-mono">
          <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" />
          <div className="text-sm">LOADING BITMAP...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-black flex items-center justify-center", className)}>
        <div className="text-center text-red-400 font-mono">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <div className="text-sm">BITMAP LOAD FAILED</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative bg-black", className)} style={{ height: '100vh', width: '100vw' }}>
      {/* Scanning line animation overlay */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse z-10" />

      <MapContainer
        center={mapCenter}
        zoom={3}
        style={{ height: '100%', width: '100%', minHeight: '100vh' }}
        className="z-0"
        attributionControl={false}
        zoomControl={false}
        maxBounds={[[-85, -250], [85, 250]]}
        maxBoundsViscosity={1.0}
        minZoom={2}
        maxZoom={18}
        worldCopyJump={false}
        ref={mapRef}
      >
        <MapBoundaryEnforcer />

        {/* Dark tile layer - using CartoDB Dark Matter */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution=""
          noWrap={false}
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />

        {/* Render heat map points */}
        {heatMapPoints.map((point, index) => (
          <CircleMarker
            key={`heatpoint-${index}-${point.lat}-${point.lng}`}
            center={[point.lat, point.lng]}
            radius={getIntensityRadius(point.intensity, maxIntensity)}
            pathOptions={{
              color: getIntensityColor(point.intensity, maxIntensity),
              fillColor: getIntensityColor(point.intensity, maxIntensity),
              fillOpacity: 0.6,
              weight: 2,
              opacity: 0.8,
            }}
            eventHandlers={{
              click: (e) => {
                const latestEvent = point.events[0];
                if (latestEvent.geohash) {
                  setHighlightedGeohash(latestEvent.geohash);
                }
                e.target.openPopup();
              }
            }}
          >
            <Popup
              closeOnClick={true}
              autoClose={true}
              eventHandlers={{
                remove: () => {
                  setHighlightedGeohash(null);
                }
              }}
            >
              <EventPopup point={point} onOpenChat={handleOpenChat} />
            </Popup>
          </CircleMarker>
        ))}

        {/* Render geohash highlight */}
        <GeohashHighlight geohash={highlightedGeohash} />


      </MapContainer>

      {/* Custom zoom controls */}
      <CustomZoomControls mapRef={mapRef} />

      {/* Status indicator with event count */}
      <div className="absolute top-4 right-4 bg-black/80 border border-green-500/30 rounded-lg p-2 font-mono text-xs z-10">
        <div className="flex items-center gap-2 text-green-400">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span>LIVE - {events?.length || 0} EVENTS</span>
        </div>
      </div>

      {/* Chat Dialog */}
      <ChatDialog
        isOpen={chatDialog.isOpen}
        onClose={handleCloseChat}
        geohash={chatDialog.geohash}
        _initialEvents={chatDialog.initialEvents}
      />

      {/* Footer */}
      <div className="absolute bottom-4 right-4 text-xs font-mono text-gray-500 z-10">
        <a
          href="https://nostrhub.io/naddr1qvzqqqrhnypzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qyt8wumn8ghj7un9d3shjtnswf5k6ctv9ehx2aqqqe3xjardv9cq5q8qjf"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bitmap
        </a>
        {' '} | Vibed with{' '}
        <a
          href="https://soapbox.pub/mkstack"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          MKStack
        </a>
      </div>
    </div>
  );
}