import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { truncateNickname } from '@/lib/utils';
import { fetchGeoRelays, findClosestRelays } from '@/lib/georelays';
import { decode } from 'ngeohash';
import { useDisabledRelays } from '@/hooks/useDisabledRelays';

export interface EphemeralEventData {
  event: NostrEvent;
  geohash?: string;
  nickname?: string;
  message: string;
}

function validateEphemeralEvent(event: NostrEvent): boolean {
  // Check if it's an ephemeral event (kind 20000 or 20001)
  if (event.kind !== 20000 && event.kind !== 20001) return false;

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

// 1 hour in seconds for message time limit
const ONE_HOUR_SECONDS = 60 * 60;

export function useEphemeralEvents(targetGeohash?: string) {
  const { nostr } = useNostr();
  const { getEnabledRelays } = useDisabledRelays();

  return useQuery({
    queryKey: ['ephemeral-events', targetGeohash],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(60000)]); // 1 minute timeout
      const oneHourAgo = Math.floor(Date.now() / 1000) - ONE_HOUR_SECONDS;

      if (targetGeohash) {
        // CHAT MODE: Query for specific geohash from closest relays
        try {
          const geoRelays = await fetchGeoRelays();
          // Decode geohash to get coordinates (for potential future use with findClosestRelays)
          decode(targetGeohash);
          const closestRelayUrls = geoRelays
            .slice(0, 8) // Use first 8 relays
            .map(relay => relay.url);
          const enabledClosestRelays = getEnabledRelays(closestRelayUrls);

          if (enabledClosestRelays.length === 0) {
            const fallbackRelays = getEnabledRelays(['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net']);
            if (fallbackRelays.length === 0) {
              return [];
            }
            const events = await nostr.query([{ kinds: [20000, 20001], since: oneHourAgo, limit: 500 }], { signal, relays: fallbackRelays });
            return events.filter(validateEphemeralEvent).map(transformEphemeralEvent);
          }

          const events = await nostr.query([{ kinds: [20000, 20001], since: oneHourAgo, limit: 500 }], { signal, relays: enabledClosestRelays });
          return events.filter(validateEphemeralEvent).map(transformEphemeralEvent);
        } catch (error) {
          console.error('❌ Failed to fetch events for geohash:', error);
          const fallbackRelays = getEnabledRelays(['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net']);
          if (fallbackRelays.length === 0) {
            return [];
          }
          const events = await nostr.query([{ kinds: [20000, 20001], since: oneHourAgo, limit: 500 }], { signal, relays: fallbackRelays });
          return events.filter(validateEphemeralEvent).map(transformEphemeralEvent);
        }
      }

      // GLOBAL MODE: Query from default relays + rotating geographic relays
      const allDefaultRelays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'];
      const enabledDefaultRelays = getEnabledRelays(allDefaultRelays);
      const allEvents: NostrEvent[] = [];
      const failedRelays = new Set<string>();

      // Phase 1: Quick load from default relays
      try {
        if (enabledDefaultRelays.length === 0) {
          console.warn('⚠️ No default relays enabled - skipping Phase 1');
        } else {
          const defaultEvents = await nostr.query([{ kinds: [20000, 20001], since: oneHourAgo, limit: 300 }], {
            signal: AbortSignal.timeout(8000),
            relays: enabledDefaultRelays
          });
          allEvents.push(...defaultEvents);
        }
      } catch (error) {
        console.error('❌ Phase 1 failed:', error);
        allDefaultRelays.forEach(relay => failedRelays.add(relay));
      }

      // Phase 2: Geographic relay loading with rotation (max 8 relays)
      try {
        const geoRelays = await fetchGeoRelays();

        // Use 8 rotating relays for geographic coverage
        const rotationIndex = Math.floor(Date.now() / 300000) % geoRelays.length;
        const selectedRegionalRelays = geoRelays.slice(rotationIndex, rotationIndex + 8);

        // Filter out failed default relays and duplicates
        const availableRegionalRelays = selectedRegionalRelays.filter(
          relay => !failedRelays.has(relay.url) &&
                   !allDefaultRelays.includes(relay.url) &&
                   getEnabledRelays([relay.url]).length > 0
        );

        // Process geographic relays in batches of 4
        const batchSize = 4;
        for (let i = 0; i < availableRegionalRelays.length; i += batchSize) {
          const batch = availableRegionalRelays.slice(i, i + batchSize);
          const batchRelayUrls = batch.map(r => r.url);

          try {
            const batchEvents = await Promise.allSettled(
              batchRelayUrls.map(relayUrl =>
                nostr.query([{ kinds: [20000, 20001], since: oneHourAgo, limit: 200 }], {
                  signal: AbortSignal.timeout(8000),
                  relays: [relayUrl]
                }).catch(error => {
                  console.warn(`❌ Geographic relay ${relayUrl} failed:`, error.message);
                  failedRelays.add(relayUrl);
                  return [];
                })
              )
            );

            // Add successful results
            batchEvents.forEach(result => {
              if (result.status === 'fulfilled') {
                allEvents.push(...result.value);
              }
            });

            // Small delay between batches
            if (i + batchSize < availableRegionalRelays.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } catch {
            batchRelayUrls.forEach(url => failedRelays.add(url));
          }
        }
      } catch (geoError) {
        console.error('❌ Phase 2 geographic loading failed:', geoError);
      }

      // Deduplicate events by ID
      const uniqueEvents = Array.from(
        new Map(allEvents.map(event => [event.id, event])).values()
      );

      return uniqueEvents.filter(validateEphemeralEvent).map(transformEphemeralEvent);
    },
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    staleTime: 5000, // Consider data stale after 5 seconds
    placeholderData: (previousData) => previousData, // Keep showing previous data while fetching
  });
}