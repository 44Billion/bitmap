import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { truncateNickname } from '@/lib/utils';
import { fetchGeoRelays, findClosestRelays } from '@/lib/georelays';
import {
  groupRelaysByRegion,
  createIntelligentCoverageStrategy,
  getRotatingRelaySelection
} from '@/lib/relayCoverage';
import { decode } from 'ngeohash';

export interface EphemeralEventData {
  event: NostrEvent;
  geohash?: string;
  nickname?: string;
  message: string;
}

function validateEphemeralEvent(event: NostrEvent): boolean {
  // Check if it's an ephemeral event
  if (event.kind !== 20000) return false;

  // Must have a geohash tag to be useful for the heat map
  const geohash = event.tags.find(([name]) => name === 'g')?.[1];
  if (!geohash) return false;

  return true;
}

function transformEphemeralEvent(event: NostrEvent): EphemeralEventData {
  const geohash = event.tags.find(([name]) => name === 'g')?.[1];
  const rawNickname = event.tags.find(([name]) => name === 'n')?.[1];
  const nickname = truncateNickname(rawNickname);

  return {
    event,
    geohash,
    nickname,
    message: event.content,
  };
}

export function useEphemeralEvents(targetGeohash?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['ephemeral-events', targetGeohash],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(120000)]); // Increased timeout to 2 minutes for more comprehensive loading

      if (targetGeohash) {
        // CHAT MODE: Find closest relays for chat
        console.log('🎯 CHAT MODE: Finding closest relays for geohash:', targetGeohash);
        try {
          const geoRelays = await fetchGeoRelays();
          const { latitude, longitude } = decode(targetGeohash);
          const closestRelays = findClosestRelays(geoRelays, latitude, longitude, 5);
          const relayUrls = closestRelays.map(relay => relay.url);
          console.log('✅ Selected closest relays for chat:', relayUrls);

          // Simple chat mode query
          const events = await nostr.query([{ kinds: [20000], limit: 500 }], { signal, relays: relayUrls });
          return events.filter(validateEphemeralEvent).map(transformEphemeralEvent);
        } catch (error) {
          console.error('❌ Failed to fetch geo relays for chat, using defaults:', error);
          const fallbackRelays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'];
          const events = await nostr.query([{ kinds: [20000], limit: 500 }], { signal, relays: fallbackRelays });
          return events.filter(validateEphemeralEvent).map(transformEphemeralEvent);
        }
      }

      // MAP MODE: Sophisticated progressive loading with relay rotation
      console.log('🗺️  MAP MODE: Progressive loading with intelligent relay rotation');

      const defaultRelays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'];
      const allEvents: NostrEvent[] = [];
      const failedRelays = new Set<string>();

      // Phase 1: Quick load from default relays (render map ASAP)
      try {
        console.log('🌟 Phase 1: Loading from default relays for initial render...');
        const defaultEvents = await nostr.query([{ kinds: [20000], limit: 300 }], {
          signal: AbortSignal.timeout(8000), // Short timeout for fast initial load
          relays: defaultRelays
        });

        allEvents.push(...defaultEvents);
        console.log('✅ Phase 1 complete:', defaultEvents.length, 'events from default relays');

        // Log initial results for debugging
        const initialResults = allEvents.filter(validateEphemeralEvent).map(transformEphemeralEvent);
        if (initialResults.length > 0) {
          console.log('🚀 Initial map render ready with', initialResults.length, 'events');
        }
      } catch (error) {
        console.error('❌ Phase 1 failed:', error);
        defaultRelays.forEach(relay => failedRelays.add(relay));
      }

      // Phase 2: Progressive loading from geographic relays with rotation
      try {
        const geoRelays = await fetchGeoRelays();

        // Group relays by region for intelligent rotation
        const regionGroups = groupRelaysByRegion(geoRelays);
        const strategy = createIntelligentCoverageStrategy(geoRelays.length, 20);
        const rotationIndex = Math.floor(Date.now() / 300000) % 10;
        const selectedRegionalRelays = getRotatingRelaySelection(regionGroups, strategy, rotationIndex);

        // Filter out failed default relays and duplicates
        const availableRegionalRelays = selectedRegionalRelays.filter(
          relay => !failedRelays.has(relay.url) && !defaultRelays.includes(relay.url)
        );

        // Process relays in larger batches for better throughput
        const batchSize = 8;
        for (let i = 0; i < availableRegionalRelays.length; i += batchSize) {
          const batch = availableRegionalRelays.slice(i, i + batchSize);
          const batchRelayUrls = batch.map(r => r.url);

          try {
            const batchEvents = await Promise.allSettled(
              batchRelayUrls.map(relayUrl =>
                nostr.query([{ kinds: [20000], limit: 200 }], {
                  signal: AbortSignal.timeout(8000), // Longer timeout per relay for better success rate
                  relays: [relayUrl]
                }).catch(error => {
                  console.warn(`❌ Relay ${relayUrl} failed, marking for rotation:`, error.message);
                  failedRelays.add(relayUrl);
                  return []; // Return empty array on failure
                })
              )
            );

            // Add successful results
            batchEvents.forEach(result => {
              if (result.status === 'fulfilled') {
                allEvents.push(...result.value);
              }
            });

            // Small delay between batches to avoid rate limiting
            if (i + batchSize < availableRegionalRelays.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }

          } catch (batchError) {
            // Mark all relays in this batch as failed
            batchRelayUrls.forEach(url => failedRelays.add(url));
          }
        }
      } catch (geoError) {
        console.error('❌ Phase 2 geographic loading failed:', geoError);
      }

      // Phase 3: Relay rotation for failed connections
      if (failedRelays.size > 0) {
        try {
          const geoRelays = await fetchGeoRelays();
          const failedRelayArray = Array.from(failedRelays);

          // Find backup relays from the same regions as failed ones
          const backupRelays: string[] = [];

          for (const failedRelayUrl of failedRelayArray) {
            const failedRelay = geoRelays.find(r => r.url === failedRelayUrl);
            if (failedRelay) {
              // Find relays from same region that haven't been tried yet
              const regionRelays = geoRelays.filter(r =>
                Math.abs(r.latitude - failedRelay.latitude) < 10 &&
                Math.abs(r.longitude - failedRelay.longitude) < 10 &&
                !failedRelays.has(r.url) &&
                !backupRelays.includes(r.url) &&
                !defaultRelays.includes(r.url)
              );

              // Take up to 4 backup relays per failed relay for better coverage
              regionRelays.slice(0, 4).forEach(backup => {
                backupRelays.push(backup.url);
              });
            }
          }

          if (backupRelays.length > 0) {
            const backupEvents = await Promise.allSettled(
              backupRelays.map(relayUrl =>
                nostr.query([{ kinds: [20000], limit: 100 }], {
                  signal: AbortSignal.timeout(5000),
                  relays: [relayUrl]
                }).catch(error => {
                  console.warn(`❌ Backup relay ${relayUrl} also failed:`, error.message);
                  return [];
                })
              )
            );

            // Add successful backup results
            backupEvents.forEach(result => {
              if (result.status === 'fulfilled') {
                allEvents.push(...result.value);
              }
            });

            const backupEventCount = backupEvents.reduce((sum, result) =>
              sum + (result.status === 'fulfilled' ? result.value.length : 0), 0
            );
          }
        } catch (rotationError) {
          console.error('❌ Phase 3 relay rotation failed:', rotationError);
        }
      }

      // Deduplicate events by ID
      const uniqueEvents = Array.from(
        new Map(allEvents.map(event => [event.id, event])).values()
      );

      return uniqueEvents.filter(validateEphemeralEvent).map(transformEphemeralEvent);
    },
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    staleTime: 5000, // Consider data stale after 5 seconds
  });
}