export interface GeoRelay {
  url: string;
  latitude: number;
  longitude: number;
}

// Cache for geo relays to avoid duplicate fetches
let geoRelaysCache: GeoRelay[] | null = null;
let geoRelaysFetchPromise: Promise<GeoRelay[]> | null = null;

export async function fetchGeoRelays(): Promise<GeoRelay[]> {
  // Return cached data if available
  if (geoRelaysCache) {
    console.log('Using cached geo relays:', geoRelaysCache.length, 'relays');
    return geoRelaysCache;
  }

  // Return existing promise if fetch is in progress
  if (geoRelaysFetchPromise) {
    console.log('Waiting for existing geo relays fetch...');
    return geoRelaysFetchPromise;
  }

  try {
    console.log('Fetching geo relays from CSV...');
    geoRelaysFetchPromise = (async () => {
      const response = await fetch('https://raw.githubusercontent.com/permissionlesstech/georelays/refs/heads/main/nostr_relays.csv');
      const csvText = await response.text();

      // Parse the CSV data
      const relays: GeoRelay[] = [];
      const lines = csvText.trim().split('\n');

      for (const line of lines) {
        // The format is: relayUrl,latitude,longitude
        const parts = line.split(',');
        if (parts.length >= 3) {
          const url = parts[0].trim();
          const latitude = parseFloat(parts[1]);
          const longitude = parseFloat(parts[2]);

          if (url && !isNaN(latitude) && !isNaN(longitude)) {
            // Ensure URL has proper websocket protocol
            const wsUrl = url.startsWith('wss://') ? url : `wss://${url}`;
            relays.push({ url: wsUrl, latitude, longitude });
          }
        }
      }

      console.log('Fetched and parsed', relays.length, 'geo relays');
      geoRelaysCache = relays;
      return relays;
    })();

    const result = await geoRelaysFetchPromise;
    return result;
  } catch (error) {
    console.error('Failed to fetch geo relays:', error);
    geoRelaysFetchPromise = null;
    return [];
  }
}

export function findClosestRelays(relays: GeoRelay[], targetLat: number, targetLng: number, count: number = 5): GeoRelay[] {
  if (relays.length === 0) return [];

  // Calculate distances using Haversine formula
  const relaysWithDistance = relays.map(relay => {
    const distance = calculateDistance(targetLat, targetLng, relay.latitude, relay.longitude);
    return { ...relay, distance };
  });

  // Sort by distance and return the closest ones
  return relaysWithDistance
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(({ distance, ...relay }) => relay);
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}