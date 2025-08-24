import type { GeoRelay } from './georelays';

interface Region {
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

interface CoverageStrategy {
  regions: string[];
  relaysPerRegion: number;
  totalRelays: number;
}

export function createIntelligentCoverageStrategy(
  totalRelaysAvailable: number,
  maxConcurrentRelays: number = 30
): CoverageStrategy {
  // Calculate how many regions we can cover
  const regionsToCover = Math.min(REGIONS.length, Math.ceil(maxConcurrentRelays / 3));
  
  // Calculate relays per region
  const relaysPerRegion = Math.floor(maxConcurrentRelays / regionsToCover);
  
  // Select regions with best geographic distribution
  const selectedRegions = selectBalancedRegions(regionsToCover);
  
  return {
    regions: selectedRegions,
    relaysPerRegion,
    totalRelays: selectedRegions.length * relaysPerRegion,
  };
}

function selectBalancedRegions(count: number): string[] {
  // Simple round-robin selection to ensure global coverage
  const selected: string[] = [];
  const regionNames = REGIONS.map(r => r.name);
  
  // Select regions in a distributed manner
  for (let i = 0; i < count && i < regionNames.length; i++) {
    // Distribute selection across different continents
    const index = Math.floor((i * regionNames.length) / count);
    selected.push(regionNames[index]);
  }
  
  return selected;
}

export function getRotatingRelaySelection(
  regionGroups: Map<string, GeoRelay[]>,
  strategy: CoverageStrategy,
  rotationIndex: number = 0
): GeoRelay[] {
  const selectedRelays: GeoRelay[] = [];
  
  strategy.regions.forEach((regionName, regionIndex) => {
    const regionRelays = regionGroups.get(regionName) || [];
    
    if (regionRelays.length > 0) {
      // Rotate through relays within each region
      const startIndex = (rotationIndex + regionIndex) % regionRelays.length;
      const relaysForThisRegion = regionRelays.slice(
        startIndex,
        startIndex + strategy.relaysPerRegion
      );
      
      // If we don't have enough relays, wrap around
      if (relaysForThisRegion.length < strategy.relaysPerRegion) {
        const additionalNeeded = strategy.relaysPerRegion - relaysForThisRegion.length;
        const additionalRelays = regionRelays.slice(0, additionalNeeded);
        selectedRelays.push(...relaysForThisRegion, ...additionalRelays);
      } else {
        selectedRelays.push(...relaysForThisRegion);
      }
    }
  });
  
  return selectedRelays;
}

export function getCoverageStats(
  regionGroups: Map<string, GeoRelay[]>,
  strategy: CoverageStrategy
): {
  coveredRegions: string[];
  totalRelays: number;
  averageRelaysPerRegion: number;
  coveragePercentage: number;
} {
  const coveredRegions = strategy.regions.filter(region => 
    (regionGroups.get(region) || []).length > 0
  );
  
  const totalAvailableRelays = Array.from(regionGroups.values())
    .reduce((sum, relays) => sum + relays.length, 0);
  
  const totalSelectedRelays = coveredRegions.reduce((sum, region) => {
    return sum + Math.min(
      strategy.relaysPerRegion,
      (regionGroups.get(region) || []).length
    );
  }, 0);
  
  return {
    coveredRegions,
    totalRelays: totalSelectedRelays,
    averageRelaysPerRegion: Math.round(totalSelectedRelays / coveredRegions.length),
    coveragePercentage: Math.round((totalSelectedRelays / totalAvailableRelays) * 100),
  };
}