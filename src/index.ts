import { config, log } from './config.js';
import { openDb, closeDb } from './database.js';
import { initRelays, subscribeToAgoraEvents, closeRelays } from './relay.js';
import { handleEvent } from './processor.js';

async function main(): Promise<void> {
  log('info', '=== Agora Nostr Announcement Bot starting ===');
  log('info', `Bot npub: ${config.botNpub}`);
  log('info', `Bot pubkey: ${config.pubkeyHex}`);
  log('info', `Subscription relays: ${config.relays.join(', ')}`);
  log('info', `Publish relays: ${config.publishRelays.join(', ')}`);
  log('info', `Post interval: ${config.postIntervalMs}ms`);

  // Initialize database
  openDb();

  // Connect to relays
  initRelays();

  // Start subscriptions
  subscribeToAgoraEvents(handleEvent);

  log('info', '=== Bot is live — listening for Agora events ===');

  // Keep alive
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Periodic health log
  setInterval(() => {
    log('info', 'Health: bot still running');
  }, 60 * 60 * 1000); // hourly
}

function shutdown(): void {
  log('info', '=== Shutting down ===');
  closeRelays();
  closeDb();
  process.exit(0);
}

main().catch((err) => {
  log('error', 'Fatal error', err);
  process.exit(1);
});
