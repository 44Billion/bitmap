import React, { useCallback, useEffect, useRef, useState } from 'react';
import { encode } from 'ngeohash';
import { useMap } from 'react-leaflet';
import { createPortal } from 'react-dom';
import { Activity, MapPin, X } from 'lucide-react';

interface GeohashOption {
  precision: number;
  label: string;
  description: string;
}

const GEOHASH_OPTIONS: GeohashOption[] = [
  { precision: 1, label: 'Continent', description: '(~5,000km)' },
  { precision: 2, label: 'Large Region', description: '(~1,200km)' },
  { precision: 3, label: 'State/Province', description: '(~150km)' },
  { precision: 4, label: 'City', description: '(~20km)' },
  { precision: 5, label: 'District', description: '(~2.4km)' },
];

interface MapClickLocation {
  lat: number;
  lng: number;
}

interface MapGeohashContextMenuProps {
  onGeohashSelect: (geohash: string, precision: number) => void;
}

// Mobile-friendly context menu component
function CustomContextMenu({ 
  x, y, 
  location,
  onSelect, 
  onClose,
  isMobile
}: { 
  x: number; 
  y: number; 
  location: MapClickLocation;
  onSelect: (precision: number) => void;
  onClose: () => void;
  isMobile: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside or pressing escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Prevent body scrolling when menu is open on mobile
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      if (isMobile) {
        document.body.style.overflow = '';
      }
    };
  }, [onClose, isMobile]);

  // Mobile-first positioning
  const menuStyle: React.CSSProperties = isMobile ? {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10000,
    maxHeight: '90vh',
    overflowY: 'auto',
  } : {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 320),
    top: Math.min(y, window.innerHeight - 350),
    zIndex: 10000,
  };

  return createPortal(
    <>
      {/* Backdrop for mobile */}
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
          onClick={onClose}
        />
      )}
      
      {/* Menu container */}
      <div
        ref={menuRef}
        className={`
          ${isMobile 
            ? 'w-[90vw] max-w-sm mx-auto rounded-xl' 
            : 'w-80 rounded-lg'
          }
          bg-black border border-green-500/30 shadow-2xl font-mono
        `}
        style={menuStyle}
      >
        {/* Header */}
        <div className="border-b border-green-500/20 p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400 font-mono">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">TELEPORT TO A GEOHASH</span>
            </div>
            {isMobile && (
              <button
                onClick={onClose}
                className="text-green-400 hover:text-green-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        
        {/* Menu items */}
        <div>
          {GEOHASH_OPTIONS.map((option) => {
            const geohash = encode(location.lat, location.lng, option.precision);
            return (
              <button
                key={option.precision}
                onClick={() => {
                  onSelect(option.precision);
                  onClose();
                }}
                className={`
                  w-full text-left px-2 py-2
                  hover:bg-green-500/10 active:bg-green-500/20
                  transition-colors border-b border-green-500/10 last:border-b-0
                  focus:outline-none focus:ring-2 focus:ring-green-500/50
                `}
              >
                {/* Precision level header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <span className="text-cyan-400 text-sm font-mono">{option.label}</span>
                    <span className="text-xs text-gray-500 leading-relaxed">{option.description}</span>
                  </div>
                  <span className="text-xs text-purple-400 bg-black/70 px-2 py-1 rounded border border-purple-500/30 font-mono break-all">
                    GEOHASH: {geohash}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
}

// Component that sets up the context menu event handling - must be inside MapContainer
export function MapGeohashContextMenuHandler({ onGeohashSelect }: MapGeohashContextMenuProps) {
  const map = useMap();
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [clickLocation, setClickLocation] = useState<MapClickLocation | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Handle context menu (right-click on desktop, long-press on mobile)
  const handleContextMenu = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    
    // Get the map container
    const mapContainer = map.getContainer();
    const rect = mapContainer.getBoundingClientRect();
    
    let clientX, clientY;
    
    if (e instanceof MouseEvent) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (e instanceof TouchEvent && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      return;
    }
    
    // Calculate relative position
    const containerX = clientX - rect.left;
    const containerY = clientY - rect.top;
    
    // Convert container coordinates to lat/lng
    const latlng = map.containerPointToLatLng([containerX, containerY]);
    const location: MapClickLocation = { lat: latlng.lat, lng: latlng.lng };
    
    // Store the click location and menu position
    setClickLocation(location);
    setMenuPosition({ x: clientX, y: clientY });
  }, [map]);

  // Handle long-press for mobile
  useEffect(() => {
    if (!isMobile) return;
    
    const mapContainer = map.getContainer();
    let pressTimer: NodeJS.Timeout | null = null;
    
    const handleTouchStart = (e: TouchEvent) => {
      pressTimer = setTimeout(() => {
        handleContextMenu(e);
      }, 500); // 500ms long press
    };
    
    const handleTouchEnd = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    
    const handleTouchMove = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    
    mapContainer.addEventListener('touchstart', handleTouchStart as EventListener);
    mapContainer.addEventListener('touchend', handleTouchEnd as EventListener);
    mapContainer.addEventListener('touchmove', handleTouchMove as EventListener);
    
    return () => {
      mapContainer.removeEventListener('touchstart', handleTouchStart as EventListener);
      mapContainer.removeEventListener('touchend', handleTouchEnd as EventListener);
      mapContainer.removeEventListener('touchmove', handleTouchMove as EventListener);
    };
  }, [isMobile, handleContextMenu]);

  const handleGeohashSelect = useCallback((precision: number) => {
    if (!clickLocation) return;
    
    const geohash = encode(clickLocation.lat, clickLocation.lng, precision);
    onGeohashSelect(geohash, precision);
    
    // Clean up
    setClickLocation(null);
    setMenuPosition(null);
  }, [clickLocation, onGeohashSelect]);

  const handleCloseMenu = useCallback(() => {
    setMenuPosition(null);
    setClickLocation(null);
  }, []);

  useEffect(() => {
    // Add context menu event listener to the map container (desktop only)
    if (!isMobile) {
      const mapContainer = map.getContainer();
      mapContainer.addEventListener('contextmenu', handleContextMenu);

      return () => {
        mapContainer.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [map, handleContextMenu, isMobile]);

  return (
    <>
      {/* Render the custom context menu when needed */}
      {menuPosition && clickLocation && (
        <CustomContextMenu
          x={menuPosition.x}
          y={menuPosition.y}
          location={clickLocation}
          onSelect={handleGeohashSelect}
          onClose={handleCloseMenu}
          isMobile={isMobile}
        />
      )}
    </>
  );
}

// Wrapper component - just a pass-through for consistency
export function MapGeohashContextMenu({ children }: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}