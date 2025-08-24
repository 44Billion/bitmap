import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent, NostrRelayEVENT, NostrRelayEOSE, NostrRelayCLOSED } from '@nostrify/nostrify';
import { truncateNickname } from '@/lib/utils';
import { fetchGeoRelays, findClosestRelays } from '@/lib/georelays';
import {
  groupRelaysByRegion,
  createIntelligentCoverageStrategy,
  getRotatingRelaySelection,
  getCoverageStats
} from '@/lib/relayCoverage';
import { createCoverageVisualization, generateCoverageReport } from '@/lib/coverageVisualizer';
import { decode } from 'ngeohash';

type NostrMessage = NostrRelayEVENT | NostrRelayEOSE | NostrRelayCLOSED;

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
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(30000)]);

      let relayUrls: string[] = [];

      if (targetGeohash) {
        // CHAT MODE: Target geohash provided, find closest 5 relays for optimal chat performance
        console.log('🎯 CHAT MODE: Finding closest relays for geohash:', targetGeohash, '(500 events per relay)');
        try {
          const geoRelays = await fetchGeoRelays();
          const { latitude, longitude } = decode(targetGeohash);
          const closestRelays = findClosestRelays(geoRelays, latitude, longitude, 5);
          relayUrls = closestRelays.map(relay => relay.url);
          console.log('✅ Selected closest relays for chat:', relayUrls, '(500 events each)');
        } catch (error) {
          console.error('❌ Failed to fetch geo relays for target geohash:', error);
          // Fallback to all georelays if specific targeting fails
          try {
            const allGeoRelays = await fetchGeoRelays();
            relayUrls = allGeoRelays.map(relay => relay.url);
            console.log('⚠️ Fallback: Using all relays for chat:', relayUrls.length, 'relays (500 events each)');
          } catch (fallbackError) {
            console.error('❌ Failed to fetch fallback relays:', fallbackError);
            relayUrls = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'];
            console.log('⚠️ Emergency fallback: Using default relays (500 events each)');
          }
        }
      } else {
        // MAP MODE: Intelligent regional coverage + default relays for comprehensive global monitoring
        console.log('🗺️  MAP MODE: Creating hybrid coverage strategy (regional + default)');
        try {
          const geoRelays = await fetchGeoRelays();

          // Default relays for comprehensive coverage (500 events each)
          const defaultRelays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'];

          // Group relays by geographic region
          const regionGroups = groupRelaysByRegion(geoRelays);

          // Create intelligent coverage strategy (max 25 relays, ~2-3 per region)
          const strategy = createIntelligentCoverageStrategy(geoRelays.length, 25);

          // Get rotating selection for this session
          const rotationIndex = Math.floor(Date.now() / 300000) % 10; // Rotate every 5 minutes
          const selectedRegionalRelays = getRotatingRelaySelection(regionGroups, strategy, rotationIndex);

          // Remove default relays from regional selection to avoid duplication
          const filteredRegionalRelays = selectedRegionalRelays.filter(
            regionalRelay => !defaultRelays.includes(regionalRelay.url)
          );

          // Combine filtered regional relays with default relays
          const allSelectedRelays = [...filteredRegionalRelays];
          defaultRelays.forEach(defaultRelayUrl => {
            const defaultRelay = geoRelays.find(r => r.url === defaultRelayUrl);
            if (defaultRelay) {
              allSelectedRelays.push(defaultRelay);
            } else {
              // Add default relay even if not in georelays
              allSelectedRelays.push({
                url: defaultRelayUrl,
                latitude: 0, // Default coordinates
                longitude: 0
              });
            }
          });

          relayUrls = allSelectedRelays.map(relay => relay.url);

          // Get coverage statistics and visualization (using filtered regional relays)
          const stats = getCoverageStats(regionGroups, strategy);
          const visualization = createCoverageVisualization(geoRelays, filteredRegionalRelays, 'hybrid');

          // Calculate deduplication stats
          const duplicateCount = selectedRegionalRelays.length - filteredRegionalRelays.length;

          console.log(`🌍 Hybrid coverage strategy (Regional + Default):`);
          console.log(`   📊 Covered regions: ${stats.coveredRegions.join(', ')}`);
          console.log(`   📡 Regional relays: ${filteredRegionalRelays.length} (${stats.coveragePercentage}% coverage)`);
          console.log(`   🌟 Default relays: ${defaultRelays.length} (500 events each)`);
          console.log(`   🔄 Total concurrent relays: ${relayUrls.length}`);
          console.log(`   🔄 Rotation index: ${rotationIndex} (changes every 5 minutes)`);
          console.log(`   📈 Average relays per region: ${stats.averageRelaysPerRegion}`);
          console.log(`   🎯 Regional: 200 events, Default: 500 events`);
          if (duplicateCount > 0) {
            console.log(`   ✅ Deduplicated: ${duplicateCount} relay(s) removed from regional selection`);
          }
          console.log(`\n${generateCoverageReport(visualization)}`);
          console.log(`\n🌟 Default relays (500 events each): ${defaultRelays.join(', ')}`);

        } catch (error) {
          console.error('❌ Failed to create hybrid coverage strategy:', error);
          // Fallback to default relays only
          relayUrls = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'];
          console.log('⚠️ Fallback: Using default relays for map (500 events each)');
        }
      }

      // Use nostr.req to subscribe to events instead of querying
      const events: NostrEvent[] = [];

      return new Promise<EphemeralEventData[]>((resolve, reject) => {
        let eoseCount = 0;
        let expectedEoseCount = 1;
        const subscriptions: AsyncIterable<NostrMessage>[] = [];

        const timeoutId = setTimeout(() => {
          // Timeout reached, resolve with what we have
          const validEvents = events
            .filter(validateEphemeralEvent)
            .map(transformEphemeralEvent);
          console.log('⏰ Subscription timeout reached, resolving with', validEvents.length, 'events');
          resolve(validEvents);
        }, 30000);

        try {
          // For map mode, we may need multiple subscriptions with different limits
          if (!targetGeohash && relayUrls.length > 3) {
            // Hybrid map mode: regional relays (200 events) + default relays (500 events)
            const defaultRelays = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'];
            const regionalRelays = relayUrls.filter(url => !defaultRelays.includes(url));

            expectedEoseCount = 0;

            // Subscription 1: Regional relays with 200 events
            if (regionalRelays.length > 0) {
              console.log('📡 Creating regional subscription (200 events) for', regionalRelays.length, 'relays');
              const regionalSubscription = nostr.req(
                [{ kinds: [20000], limit: 200 }],
                { signal, relays: regionalRelays }
              );
              subscriptions.push(regionalSubscription);
              expectedEoseCount++;
            }

            // Subscription 2: Default relays with 500 events
            console.log('🌟 Creating default subscription (500 events) for', defaultRelays.length, 'relays');
            const defaultSubscription = nostr.req(
              [{ kinds: [20000], limit: 500 }],
              { signal, relays: defaultRelays }
            );
            subscriptions.push(defaultSubscription);
            expectedEoseCount++;

          } else {
            // Single subscription for chat mode or fallback scenarios
            const limit = targetGeohash ? 500 : 200;
            console.log('📡 Creating single subscription (', limit, 'events) for', relayUrls.length, 'relays');

            const subscription = nostr.req(
              [{ kinds: [20000], limit }],
              { signal, relays: relayUrls }
            );
            subscriptions.push(subscription);
          }

          // Process all subscriptions asynchronously
          const processSubscription = async (subscription: AsyncIterable<NostrMessage>, subscriptionIndex: number) => {
            try {
              for await (const message of subscription) {
                if (message[0] === 'EVENT') {
                  const event = message[2];
                  events.push(event);
                } else if (message[0] === 'EOSE') {
                  console.log(`✅ EOSE received for subscription ${subscriptionIndex + 1}/${subscriptions.length}`);
                  eoseCount++;
                  if (eoseCount >= expectedEoseCount) {
                    clearTimeout(timeoutId);
                    // All subscriptions reached EOSE, filter and transform
                    const validEvents = events
                      .filter(validateEphemeralEvent)
                      .map(transformEphemeralEvent);
                    console.log('🎉 All subscriptions completed, total events:', validEvents.length);
                    resolve(validEvents);
                  }
                } else if (message[0] === 'CLOSED') {
                  console.log(`🔚 Subscription ${subscriptionIndex + 1}/${subscriptions.length} closed`);
                  eoseCount++;
                  if (eoseCount >= expectedEoseCount) {
                    clearTimeout(timeoutId);
                    // Connection closed, resolve with what we have
                    const validEvents = events
                      .filter(validateEphemeralEvent)
                      .map(transformEphemeralEvent);
                    console.log('🔚 All subscriptions closed, total events:', validEvents.length);
                    resolve(validEvents);
                  }
                }
              }
            } catch (error) {
              console.error(`Error in subscription ${subscriptionIndex + 1}:`, error);
              eoseCount++;
              if (eoseCount >= expectedEoseCount) {
                clearTimeout(timeoutId);
                resolve(events
                  .filter(validateEphemeralEvent)
                  .map(transformEphemeralEvent));
              }
            }
          };

          // Start processing all subscriptions
          subscriptions.forEach((subscription, index) => {
            processSubscription(subscription, index);
          });

        } catch (error) {
          clearTimeout(timeoutId);
          console.error('Failed to create subscription(s):', error);
          reject(error);
        }
      });
    },
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    staleTime: 5000, // Consider data stale after 5 seconds
  });
}