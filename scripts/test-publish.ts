/**
 * Test script: Publish a test kind 1 announcement with the bot identity.
 *
 * Usage:
 *   npx tsx scripts/test-publish.ts --dry-run   (print to console only)
 *   npx tsx scripts/test-publish.ts              (actually publish)
 */

import { finalizeEvent } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';

const PUBLISH_RELAYS = [
  'wss://relay.ditto.pub/',
  'wss://relay.dreamith.to/',
  'wss://relay.primal.net/',
  'wss://nos.lol',
];

// Load secret key
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const secretHex = readFileSync(join(homedir(), '.config/agora-bot/secret.key'), 'utf-8').trim();
const secretBytes = hexToBytes(secretHex);

const dryRun = process.argv.includes('--dry-run');

const content = `🤖 Agora Bot test post

This is a test announcement from the Agora Nostr Bot. If you see this, the bot is working correctly!

#Agora #agora-bot`;

const template = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  content,
  tags: [
    ['t', 'agora'],
    ['t', 'agora-bot'],
  ],
};

const signedEvent = finalizeEvent(
  template as unknown as Record<string, unknown> as Parameters<typeof finalizeEvent>[0],
  secretBytes
);

console.log(`[${new Date().toISOString()}] Test publish`);
console.log(`Event ID: ${signedEvent.id}`);
console.log(`Pubkey: ${signedEvent.pubkey}`);
console.log(`Content:\n${signedEvent.content}`);
console.log(`Tags: ${JSON.stringify(signedEvent.tags)}`);
console.log('---\n');

if (dryRun) {
  console.log('Dry run — not publishing.');
  process.exit(0);
}

console.log(`Publishing to ${PUBLISH_RELAYS.length} relays...`);

const results = await Promise.allSettled(
  PUBLISH_RELAYS.map(
    (url) =>
      new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error(`Timeout to ${url}`));
        }, 15_000);

        ws.onopen = () => {
          ws.send(JSON.stringify(['EVENT', signedEvent]));
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data as string) as unknown[];
            if (data[0] === 'OK' && data[1] === signedEvent.id) {
              clearTimeout(timeout);
              ws.close();
              if (data[2] === true) {
                console.log(`  ✅ ${url}: Accepted`);
                resolve();
              } else {
                console.log(`  ❌ ${url}: Rejected — ${data[3] ?? 'unknown'}`);
                reject(new Error(`${url} rejected`));
              }
            }
          } catch {
            // ignore
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`WebSocket error to ${url}`));
        };
      })
  )
);

const ok = results.filter((r) => r.status === 'fulfilled').length;
console.log(`\nDone: ${ok}/${PUBLISH_RELAYS.length} relays accepted the event.`);
process.exit(0);
