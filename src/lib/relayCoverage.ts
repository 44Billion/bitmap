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

interface CoverageStrategy {
  regions: string[];
  relaysPerRegion: number;
  totalRelays: number;
}

export function createIntelligentCoverageStrategy(
  totalRelaysAvailable: number,
  maxConcurrentRelays: number = 20
): CoverageStrategy {
  // Use a reasonable number of regions for good coverage
  const regionsToCover = Math.min(6, REGIONS.length);

  // Calculate relays per region - aim for 2-3 per region for balanced coverage
  const relaysPerRegion = Math.min(3, Math.floor(maxConcurrentRelays / regionsToCover));

  // Select regions with best geographic distribution
  const selectedRegions = selectBalancedRegions(regionsToCover);

  return {
    regions: selectedRegions,
    relaysPerRegion,
    totalRelays: Math.min(maxConcurrentRelays, selectedRegions.length * relaysPerRegion),
  };
}

function selectBalancedRegions(count: number): string[] {
  // Select all regions for maximum coverage
  const regionNames = REGIONS.map(r => r.name);

  // If we want fewer regions than available, select them evenly
  if (count < regionNames.length) {
    const selected: string[] = [];
    const step = Math.floor(regionNames.length / count);

    for (let i = 0; i < count; i++) {
      const index = (i * step) % regionNames.length;
      selected.push(regionNames[index]);
    }
    return selected;
  }

  // Otherwise, return all regions
  return regionNames;
}

export function getRotatingRelaySelection(
  regionGroups: Map<string, GeoRelay[]>,
  strategy: CoverageStrategy,
  rotationIndex: number = 0
): GeoRelay[] {
  const selectedRelays: GeoRelay[] = [];
  const usedRelayUrls = new Set<string>(); // Track used relay URLs to avoid duplicates

  // First pass: select unique relays from each region
  strategy.regions.forEach((regionName, regionIndex) => {
    const regionRelays = regionGroups.get(regionName) || [];

    if (regionRelays.length > 0) {
      // Filter out already used relays
      const availableRelays = regionRelays.filter(relay => !usedRelayUrls.has(relay.url));

      if (availableRelays.length > 0) {
        // Rotate through available relays within this region
        const startIndex = (rotationIndex + regionIndex) % availableRelays.length;
        const relaysForThisRegion = availableRelays.slice(
          startIndex,
          startIndex + Math.min(strategy.relaysPerRegion, availableRelays.length)
        );

        // Add selected relays and mark them as used
        relaysForThisRegion.forEach(relay => {
          selectedRelays.push(relay);
          usedRelayUrls.add(relay.url);
        });
      }
    }
  });

  // Second pass: if we still need more relays, allow some strategic duplicates from regions with the most relays
  const remainingNeeded = Math.max(0, strategy.totalRelays - selectedRelays.length);
  if (remainingNeeded > 0) {
    // Sort regions by relay count (most relays first)
    const sortedRegions = strategy.regions
      .map(regionName => ({
        regionName,
        relays: regionGroups.get(regionName) || []
      }))
      .filter(({ relays }) => relays.length > 0)
      .sort((a, b) => b.relays.length - a.relays.length);

    let addedCount = 0;
    for (const { relays } of sortedRegions) {
      if (addedCount >= remainingNeeded) break;

      // Add up to 2 duplicates from this region
      const regionLimit = Math.min(2, remainingNeeded - addedCount);
      const startIndex = rotationIndex % relays.length;
      const duplicateRelays = relays.slice(startIndex, startIndex + regionLimit);

      duplicateRelays.forEach(relay => {
        selectedRelays.push(relay);
        addedCount++;
      });
    }
  }

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