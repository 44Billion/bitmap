import { REGIONS } from './relayCoverage';
import type { GeoRelay } from './georelays';

export interface CoverageVisualization {
  regions: {
    name: string;
    color: string;
    relayCount: number;
    selectedRelays: number;
    percentage: number;
  }[];
  totalRelays: number;
  selectedRelays: number;
  coveragePercentage: number;
  strategy: string;
}

export function createCoverageVisualization(
  allRelays: GeoRelay[],
  selectedRelays: GeoRelay[],
  strategy: string = 'intelligent'
): CoverageVisualization {
  // Group all relays by region
  const regionCounts = new Map<string, number>();
  const selectedRegionCounts = new Map<string, number>();
  
  // Initialize all regions
  REGIONS.forEach(region => {
    regionCounts.set(region.name, 0);
    selectedRegionCounts.set(region.name, 0);
  });
  
  // Count relays in each region
  allRelays.forEach(relay => {
    for (const region of REGIONS) {
      if (isRelayInRegion(relay, region)) {
        regionCounts.set(region.name, regionCounts.get(region.name)! + 1);
        break;
      }
    }
  });
  
  // Count selected relays in each region
  selectedRelays.forEach(relay => {
    for (const region of REGIONS) {
      if (isRelayInRegion(relay, region)) {
        selectedRegionCounts.set(region.name, selectedRegionCounts.get(region.name)! + 1);
        break;
      }
    }
  });
  
  // Create visualization data
  const regions = REGIONS.map(region => {
    const totalInRegion = regionCounts.get(region.name) || 0;
    const selectedInRegion = selectedRegionCounts.get(region.name) || 0;
    const percentage = totalInRegion > 0 ? (selectedInRegion / totalInRegion) * 100 : 0;
    
    return {
      name: region.name,
      color: region.color,
      relayCount: totalInRegion,
      selectedRelays: selectedInRegion,
      percentage: Math.round(percentage),
    };
  });
  
  return {
    regions,
    totalRelays: allRelays.length,
    selectedRelays: selectedRelays.length,
    coveragePercentage: Math.round((selectedRelays.length / allRelays.length) * 100),
    strategy,
  };
}

function isRelayInRegion(relay: GeoRelay, region: typeof REGIONS[0]): boolean {
  return (
    relay.latitude >= region.bounds.minLat &&
    relay.latitude <= region.bounds.maxLat &&
    relay.longitude >= region.bounds.minLng &&
    relay.longitude <= region.bounds.maxLng
  );
}

export function generateCoverageReport(visualization: CoverageVisualization): string {
  const report = [
    `🌍 Relay Coverage Report (${visualization.strategy} strategy)`,
    '',
    `📊 Overall Coverage: ${visualization.coveragePercentage}% (${visualization.selectedRelays}/${visualization.totalRelays} relays)`,
    '',
    '📍 Regional Breakdown:',
    ...visualization.regions
      .filter(region => region.relayCount > 0)
      .map(region => 
        `   ${region.color} ${region.name}: ${region.selectedRelays}/${region.relayCount} (${region.percentage}%)`
      ),
    '',
    '🔄 Strategy Benefits:',
    '   ✅ Balanced global coverage',
    '   ✅ Reduced resource usage',
    '   ✅ Geographic distribution',
    '   ✅ Rotating selection for fairness',
  ];
  
  return report.join('\n');
}