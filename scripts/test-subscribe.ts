/**
 * Test script: Subscribe to Agora events on Ditto relays.
 * Logs raw events to console. Does NOT publish anything.
 *
 * Usage: npx tsx scripts/test-subscribe.ts
 */

import { NRelay1 } from '@nostrify/nostrify';

const RELAYS = ['wss://relay.ditto.pub/', 'wss://relay.dreamith.to/'];
const now = Math.floor(Date.now() / 1000);

// Also look back 24h for testing
const since = now - 24 * 60 * 60;

const filters = [
  {
    kinds: [33863],
    '#t': ['agora', 'Agora'],
    since,
    limit: 10,
  },
  {
    kinds: [8333],
    '#t': ['agora', 'Agora'],
    since,
    limit: 10,
  },
];

console.log(`[${new Date().toISOString()}] Test subscribe starting`);
console.log(`Relays: ${RELAYS.join(', ')}`);
console.log(`Looking back since: ${new Date(since * 1000).toISOString()}`);
console.log('---\n');

for (const url of RELAYS) {
  console.log(`\n=== Connecting to ${url} ===`);

  try {
    const relay = new NRelay1(url);

    for (const filter of filters) {
      const kindLabel = filter.kinds[0] === 33863 ? 'CAMPAIGN' : 'DONATION';
      console.log(`\n  [${kindLabel}] Subscribing...`);

      (async () => {
        let count = 0;
        try {
          for await (const msg of relay.req([filter])) {
            if (msg[0] === 'EVENT') {
              count++;
              const event = msg[2];
              console.log(`\n  [${kindLabel}] Event #${count}:`);
              console.log(`    ID: ${event.id}`);
              console.log(`    Kind: ${event.kind}`);
              console.log(`    Pubkey: ${event.pubkey}`);
              console.log(`    Created: ${new Date((event.created_at ?? 0) * 1000).toISOString()}`);
              console.log(`    Content: ${(event.content ?? '').slice(0, 200)}`);
              console.log(`    Tags:`);
              for (const tag of event.tags) {
                console.log(`      ${JSON.stringify(tag)}`);
              }
              console.log('    ---');
            } else if (msg[0] === 'EOSE') {
              console.log(`  [${kindLabel}] End of stored events (EOSE). Listening for new events...`);
            }
          }
        } catch (err) {
          console.error(`  [${kindLabel}] Subscription error:`, err);
        }
      })();
    }
  } catch (err) {
    console.error(`Failed to connect to ${url}:`, err);
  }
}

console.log('\n=== Listening for events (press Ctrl+C to stop) ===');
