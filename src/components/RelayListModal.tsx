import React, { useState, useEffect } from 'react';
import { List, X, Wifi, Globe, MapPin, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/hooks/useAppContext';
import { useDisabledRelays } from '@/hooks/useDisabledRelays';
import { fetchGeoRelays, type GeoRelay } from '@/lib/georelays';
import { REGIONS, groupRelaysByRegion, type Region } from '@/lib/relayCoverage';
import { cn } from '@/lib/utils';

interface RelayListModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RegionalRelayGroup {
  region: Region;
  relays: GeoRelay[];
  isActive: boolean;
}

export function RelayListModal({ isOpen, onOpenChange }: RelayListModalProps) {
  const { config, presetRelays = [] } = useAppContext();
  const {
  disabledRelays,
  toggleRelay,
  isRelayDisabled,
  toggleRegionRelays,
  isRegionFullyEnabled,
  isRegionFullyDisabled
} = useDisabledRelays();
  const [geoRelays, setGeoRelays] = useState<GeoRelay[]>([]);
  const [regionalGroups, setRegionalGroups] = useState<RegionalRelayGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load geo relays when modal opens
  useEffect(() => {
    if (isOpen) {
      loadGeoRelays();
    }
  }, [isOpen]);

  const loadGeoRelays = async () => {
    try {
      setIsLoading(true);
      const relays = await fetchGeoRelays();
      setGeoRelays(relays);

      // Group relays by region
      const regionGroups = groupRelaysByRegion(relays);

      // Create regional relay groups with activity status
      const groups: RegionalRelayGroup[] = REGIONS.map(region => {
        const regionRelays = regionGroups.get(region.name) || [];
        const enabledRelaysInRegion = regionRelays.filter(relay => !isRelayDisabled(relay.url));
        return {
          region,
          relays: regionRelays,
          isActive: enabledRelaysInRegion.length > 0,
        };
      });

      setRegionalGroups(groups);
    } catch (error) {
      console.error('Failed to load geo relays:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadGeoRelays();
    setIsRefreshing(false);
  };

  const _getRelayStatusColor = (relayUrl: string) => {
    // Check if relay is disabled
    if (isRelayDisabled(relayUrl)) {
      return 'text-red-400';
    }
    // Check if this is the currently selected default relay
    if (relayUrl === config.relayUrl) {
      return 'text-green-400';
    }
    return 'text-gray-400';
  };

  // const getRegionStatusIcon = (isActive: boolean) => {
  //   if (isActive) {
  //     return <Wifi className="h-3 w-3 text-green-400" />;
  //   }
  //   return <div className="h-3 w-3 rounded-full bg-gray-600" />;
  // };

  const getEnabledRelaysInRegion = (regionRelays: GeoRelay[]) => {
    return regionRelays.filter(relay => !isRelayDisabled(relay.url));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-full sm:max-h-[80vh] bg-black border border-green-500/30 overflow-hidden p-4 sm:p-6 flex flex-col">
        <DialogHeader className="border-b border-green-500/20 sm:pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-green-400 font-mono">
              <List className="h-5 w-5" />
              RELAY NETWORK STATUS
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="sr-only">Refresh</span>
              </Button>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-green-500 hover:text-green-400 hover:bg-green-500/20 rounded-sm"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto sm:p-4 space-y-4 flex-grow">
          {/* Primary Relays Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm border-b border-cyan-500/30 pb-1 sm:pb-2">
              <Globe className="h-4 w-4" />
              <span>PRIMARY RELAYS</span>
              <span className="text-xs text-gray-500">({presetRelays.length} active)</span>
            </div>

            <div className="space-y-1">
              {presetRelays.map((relay) => (
                <div key={relay.url}>
                  <div className="flex items-center gap-2 py-1 sm:py-2">
                    <button
                      onClick={() => toggleRelay(relay.url)}
                      className={cn(
                        "p-1 rounded hover:bg-gray-700/50 transition-colors",
                        isRelayDisabled(relay.url) ? "text-red-400" : "text-green-400 hover:text-green-300"
                      )}
                      title={isRelayDisabled(relay.url) ? "Click to enable relay" : "Click to disable relay"}
                    >
                      {isRelayDisabled(relay.url) ? (
                        <WifiOff className="h-4 w-4" />
                      ) : (
                        <Wifi className="h-4 w-4" />
                      )}
                    </button>
                    <span className={cn(
                      "font-mono text-sm font-medium",
                      isRelayDisabled(relay.url) ? "text-red-400" : "text-green-400"
                    )}>
                      {relay.name}
                    </span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded font-mono",
                      isRelayDisabled(relay.url)
                        ? "bg-red-500/10 text-red-400"
                        : "bg-green-500/10 text-green-400"
                    )}>
                      {isRelayDisabled(relay.url) ? "DISABLED" : "ACTIVE"}
                    </span>
                  </div>

                  <div className="sm:ml-6">
                    <div className="flex items-center justify-between text-xs bg-gray-900/20 border border-gray-700/30 rounded p-1 sm:p-2">
                      <span className="text-gray-300 font-mono truncate">
                        {relay.url.replace(/^wss?:\/\//, '')}
                      </span>
                      <span className={cn(
                        "text-[10px] font-mono",
                        isRelayDisabled(relay.url) ? "text-red-500" : "text-gray-500"
                      )}>
                        Primary • {isRelayDisabled(relay.url) ? "Disabled" : "In use"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Regional Relays Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-mono text-sm border-b border-purple-500/30 pb-1 sm:pb-2">
              <MapPin className="h-4 w-4" />
              <span>REGIONAL RELAYS</span>
              <span className="text-xs text-gray-500">({geoRelays.length} total)</span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-4 sm:py-8">
                <Loader2 className="h-6 w-6 animate-spin text-green-400" />
                <span className="ml-2 text-green-400 font-mono text-sm">LOADING REGIONAL RELAYS...</span>
              </div>
            ) : (
              <div className="space-y-1">
                {regionalGroups.map((group) => {
                  const enabledCount = getEnabledRelaysInRegion(group.relays).length;
                  return (
                    <div key={group.region.name}>
                      <div className="flex items-center gap-2 py-1 sm:py-2">
                        <button
                          onClick={() => toggleRegionRelays(group.relays.map(r => r.url))}
                          className={cn(
                            "p-1 rounded hover:bg-gray-700/50 transition-colors",
                            isRegionFullyEnabled(group.relays.map(r => r.url))
                              ? "text-green-400 hover:text-green-300"
                              : isRegionFullyDisabled(group.relays.map(r => r.url))
                                ? "text-red-400 hover:text-red-300"
                                : "text-purple-400 hover:text-purple-300"
                          )}
                          title={
                            isRegionFullyEnabled(group.relays.map(r => r.url))
                              ? "Click to disable all relays in this region"
                              : isRegionFullyDisabled(group.relays.map(r => r.url))
                                ? "Click to enable all relays in this region"
                                : "Click to toggle all relays in this region"
                          }
                        >
                          {isRegionFullyEnabled(group.relays.map(r => r.url)) ? (
                            <Wifi className="h-4 w-4" />
                          ) : isRegionFullyDisabled(group.relays.map(r => r.url)) ? (
                            <WifiOff className="h-4 w-4" />
                          ) : (
                            <Wifi className="h-4 w-4" />
                          )}
                        </button>
                        <span className={cn(
                          "font-mono text-sm font-medium",
                          isRegionFullyEnabled(group.relays.map(r => r.url))
                            ? "text-green-400"
                            : isRegionFullyDisabled(group.relays.map(r => r.url))
                              ? "text-red-400"
                              : "text-purple-300"
                        )}>
                          {group.region.name}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded font-mono",
                          isRegionFullyEnabled(group.relays.map(r => r.url))
                            ? "bg-green-500/10 text-green-400"
                            : isRegionFullyDisabled(group.relays.map(r => r.url))
                              ? "bg-red-500/10 text-red-400"
                              : "bg-purple-500/10 text-purple-400"
                        )}>
                          {enabledCount}/{group.relays.length}
                        </span>
                        <span className={cn(
                          "text-[10px] font-mono",
                          isRegionFullyEnabled(group.relays.map(r => r.url))
                            ? "text-green-500"
                            : isRegionFullyDisabled(group.relays.map(r => r.url))
                              ? "text-red-500"
                              : "text-purple-500"
                        )}>
                          {isRegionFullyEnabled(group.relays.map(r => r.url))
                            ? "ALL ON"
                            : isRegionFullyDisabled(group.relays.map(r => r.url))
                              ? "ALL OFF"
                              : "MIXED"
                          }
                        </span>
                      </div>

                      {group.relays.length > 0 ? (
                        <div className="sm:ml-6 space-y-1">
                          {group.relays.map((relay) => (
                            <div
                              key={relay.url}
                              className="flex items-center justify-between text-xs bg-gray-900/20 border border-gray-700/30 rounded p-1 sm:p-2"
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <button
                                  onClick={() => toggleRelay(relay.url)}
                                  className={cn(
                                    "p-1 rounded hover:bg-gray-700/50 transition-colors flex-shrink-0",
                                    isRelayDisabled(relay.url) ? "text-red-400" : "text-green-400 hover:text-green-300"
                                  )}
                                  title={isRelayDisabled(relay.url) ? "Click to enable relay" : "Click to disable relay"}
                                >
                                  {isRelayDisabled(relay.url) ? (
                                    <WifiOff className="h-3 w-3" />
                                  ) : (
                                    <Wifi className="h-3 w-3" />
                                  )}
                                </button>
                                <span className={cn(
                                  "font-mono truncate flex-1 hidden sm:flex",
                                  isRelayDisabled(relay.url) ? "text-red-400 line-through" : "text-gray-300"
                                )}>
                                  {relay.url.replace(/^wss?:\/\//, '')}
                                </span>
                                <span className={cn(
                                  "font-mono truncate flex-1 flex sm:hidden",
                                  isRelayDisabled(relay.url) ? "text-red-400 line-through" : "text-gray-300"
                                )}>
                                  {relay.url.length >= 22 ? `${relay.url.replace(/^wss?:\/\//, '').slice(0,22)}...` : relay.url.replace(/^wss?:\/\//, '') }
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[10px] font-mono",
                                  isRelayDisabled(relay.url) ? "text-red-500" : "text-gray-500"
                                )}>
                                  {relay.latitude.toFixed(1)}°, {relay.longitude.toFixed(1)}°
                                </span>
                                <span className={cn(
                                  "text-[10px] px-1 py-0.5 rounded font-mono",
                                  isRelayDisabled(relay.url)
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-green-500/10 text-green-400"
                                )}>
                                  {isRelayDisabled(relay.url) ? "OFF" : "ON"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="ml-6 text-xs text-gray-600 py-1">
                          No relays available in this region
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary Statistics */}
          {!isLoading && (
            <div className="bg-gray-900/30 border border-green-500/20 rounded-lg p-2 sm:p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-400 font-mono">
                    {presetRelays.length + geoRelays.length}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">TOTAL RELAYS</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-400 font-mono">
                    {presetRelays.filter(r => !isRelayDisabled(r.url)).length}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">ENABLED PRIMARY</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-400 font-mono">
                    {regionalGroups.filter(g => g.isActive).length}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">ACTIVE REGIONS</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400 font-mono">
                    {geoRelays.filter(r => !isRelayDisabled(r.url)).length}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">ENABLED REGIONAL</div>
                </div>
              </div>
              <div className="mt-1 sm:mt-3 text-xs text-gray-500 font-mono text-center">
                {disabledRelays.size > 0 && (
                  <span>{disabledRelays.size} relays disabled • </span>
                )}
                Click WiFi icons to toggle relays on/off
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-green-500/20 p-2 sm:p-4">
          <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
            <div>
              Network status: {isLoading ? 'Loading...' : `${geoRelays.length} relays available`}
            </div>
            <div>
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}