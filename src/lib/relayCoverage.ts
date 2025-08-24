import type { GeoRelay } from './georelays';

export interface Region {
  name: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  color: string;
}

export const REGIONS: Region[] = [
  // Americas
  { name: 'North America', bounds: { minLat: 15, maxLat: 75, minLng: -170, maxLng: -50 }, color: '#4CAF50' },
  { name: 'South America', bounds: { minLat: -60, maxLat: 15, minLng: -90, maxLng: -30 }, color: '#8BC34A' },

  // Europe & Africa
  { name: 'Europe', bounds: { minLat: 35, maxLat: 75, minLng: -15, maxLng: 50 }, color: '#2196F3' },
  { name: 'Africa', bounds: { minLat: -35, maxLat: 35, minLng: -20, maxLng: 55 }, color: '#00BCD4' },

  // Asia-Pacific
  { name: 'Middle East', bounds: { minLat: 10, maxLat: 45, minLng: 35, maxLng: 75 }, color: '#FF9800' },
  { name: 'Central Asia', bounds: { minLat: 35, maxLat: 55, minLng: 50, maxLng: 90 }, color: '#FF5722' },
  { name: 'East Asia', bounds: { minLat: 15, maxLat: 55, minLng: 90, maxLng: 155 }, color: '#E91E63' },
  { name: 'South Asia', bounds: { minLat: 5, maxLat: 35, minLng: 65, maxLng: 95 }, color: '#9C27B0' },
  { name: 'Southeast Asia', bounds: { minLat: -15, maxLat: 25, minLng: 90, maxLng: 155 }, color: '#673AB7' },
  { name: 'Oceania', bounds: { minLat: -50, maxLat: 0, minLng: 110, maxLng: 180 }, color: '#3F51B5' },
];

function isRelayInRegion(relay: GeoRelay, region: Region): boolean {
  return (
    relay.latitude >= region.bounds.minLat &&
    relay.latitude <= region.bounds.maxLat &&
    relay.longitude >= region.bounds.minLng &&
    relay.longitude <= region.bounds.maxLng
  );
}

export function groupRelaysByRegion(relays: GeoRelay[]): Map<string, GeoRelay[]> {
  const regionGroups = new Map<string, GeoRelay[]>();

  // Initialize all regions
  REGIONS.forEach(region => {
    regionGroups.set(region.name, []);
  });

  // Group relays by region
  relays.forEach(relay => {
    for (const region of REGIONS) {
      if (isRelayInRegion(relay, region)) {
        regionGroups.get(region.name)!.push(relay);
        break; // Assign to first matching region
      }
    }
  });

  return regionGroups;
}

