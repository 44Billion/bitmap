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
  const { getEnabledRelays } = useDisabledRelays();

  return useQuery({
    queryKey: ['ephemeral-events', targetGeohash],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(120000)]); // Increased timeout to 2 minutes for more comprehensive loading

      if (targetGeohash) {
        // CHAT MODE: Find closest relays for chat
        try {
          const geoRelays = await fetchGeoRelays();
          const { latitude, longitude } = decode(targetGeohash);
          const closestRelays = findClosestRelays(geoRelays, latitude, longitude, 8); // Use 8 closest relays for better coverage
          const closestRelayUrls = closestRelays.map(relay => relay.url);
          const enabledClosestRelays = getEnabledRelays(closestRelayUrls);

          if (enabledClosestRelays.length === 0) {
            const fallbackRelays = getEnabledRelays(['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net']);
            if (fallbackRelays.length === 0) {
              return [];
            }
            const events = await nostr.query([{ kinds: [20000], limit: 500 }], { signal, relays: fallbackRelays });
            return events.filter(validateEphemeralEvent).map(transformEphemeralEvent);
          }

          // Simple chat mode query
          const events = await nostr.query([{ kinds: [20000], limit: 500 }], { signal, relays: enabledClosestRelays });
          return events.filter(validateEphemeralEvent).map(transformEphemeralEvent);
        } catch (error) {
          console.error('❌ Failed to fetch geo relays for chat, using defaults:', error);
          const fallbackRelays = getEnabledRelays(['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net']);
          if (fallbackRelays.length === 0) {
            return [];
          }
          const events = await nostr.query([{ kinds: [20000], limit: 500 }], { signal, relays: fallbackRelays });
          return events.filter(validateEphemeralEvent).map(transformEphemeralEvent);
        }
      }

      const allDefaultRelays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'];
      const enabledDefaultRelays = getEnabledRelays(allDefaultRelays);
      const allEvents: NostrEvent[] = [];
      const failedRelays = new Set<string>();

      // Phase 1: Quick load from default relays (render map ASAP)
      try {
        if (enabledDefaultRelays.length === 0) {
          console.warn('⚠️ No default relays enabled - skipping Phase 1');
        } else {
          const defaultEvents = await nostr.query([{ kinds: [20000], limit: 300 }], {
            signal: AbortSignal.timeout(8000), // Short timeout for fast initial load
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

        // Filter out failed default relays, disabled relays, and duplicates
        const availableRegionalRelays = selectedRegionalRelays.filter(
          relay => !failedRelays.has(relay.url) &&
                   !allDefaultRelays.includes(relay.url) &&
                   getEnabledRelays([relay.url]).length > 0
        );

        // Process geographic relays in batches of 4 for better throughput
        const batchSize = 4;
        for (let i = 0; i < availableRegionalRelays.length; i += batchSize) {
          const batch = availableRegionalRelays.slice(i, i + batchSize);
          const batchRelayUrls = batch.map(r => r.url);

          try {
            const batchEvents = await Promise.allSettled(
              batchRelayUrls.map(relayUrl =>
                nostr.query([{ kinds: [20000], limit: 200 }], {
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

            // Small delay between batches to avoid rate limiting
            if (i + batchSize < availableRegionalRelays.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } catch {
            // Mark all relays in this batch as failed
            batchRelayUrls.forEach(url => failedRelays.add(url));
          }
        }
      } catch (geoError) {
        console.error('❌ Phase 2 geographic loading failed:', geoError);
      }

      // Phase 3: Backup relay rotation for failed connections (max 5 relays)
      if (failedRelays.size > 0) {
        try {
          const geoRelays = await fetchGeoRelays();
          const failedRelayArray = Array.from(failedRelays);

          // Find backup relays from the same regions as failed ones
          const backupRelays: string[] = [];

          for (const failedRelayUrl of failedRelayArray.slice(0, 5)) { // Limit to 5 failed relays
            const failedRelay = geoRelays.find(r => r.url === failedRelayUrl);
            if (failedRelay) {
              // Find relays from same region that haven't been tried yet
              const regionRelays = geoRelays.filter(r =>
                Math.abs(r.latitude - failedRelay.latitude) < 10 &&
                Math.abs(r.longitude - failedRelay.longitude) < 10 &&
                !failedRelays.has(r.url) &&
                !backupRelays.includes(r.url) &&
                !allDefaultRelays.includes(r.url)
              );

              // Take up to 2 backup relays per failed relay
              regionRelays.slice(0, 2).forEach(backup => {
                backupRelays.push(backup.url);
              });
            }
          }

          // Limit to max 5 backup relays total
          const limitedBackupRelays = backupRelays.slice(0, 5);

          if (limitedBackupRelays.length > 0) {
            const backupEvents = await Promise.allSettled(
              limitedBackupRelays.map(relayUrl =>
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