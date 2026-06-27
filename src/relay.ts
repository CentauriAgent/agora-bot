import type { NostrEvent } from '@nostrify/nostrify';
import { NRelay1 } from '@nostrify/nostrify';
import { config, log } from './config.js';

export type EventHandler = (event: NostrEvent) => Promise<void>;

/** Subscription relays — we connect to each and merge events. */
const subscriptionRelays: NRelay1[] = [];

/** Open relay connections for subscription. */
export function initRelays(): void {
  for (const url of config.relays) {
    try {
      const relay = new NRelay1(url);
      subscriptionRelays.push(relay);
      log('info', `Connected to relay: ${url}`);
    } catch (err) {
      log('error', `Failed to connect to relay ${url}`, err);
    }
  }
}

/** Subscribe to Agora campaign and donation events. */
export function subscribeToAgoraEvents(handler: EventHandler): void {
  const now = Math.floor(Date.now() / 1000);

  const filters = [
    {
      kinds: [33863],
      '#t': ['agora', 'Agora'],
      since: now,
    },
    {
      kinds: [8333],
      '#t': ['agora', 'Agora'],
      since: now,
    },
  ];

  for (const relay of subscriptionRelays) {
    for (const filter of filters) {
      log('info', `Subscribing to kind ${filter.kinds} on relay`);

      (async () => {
        try {
          for await (const msg of relay.req([filter])) {
            if (msg[0] === 'EVENT') {
              const event = msg[2] as NostrEvent;
              try {
                await handler(event);
              } catch (err) {
                log('error', `Error handling event ${event.id}`, err);
              }
            }
          }
        } catch (err) {
          log('error', 'Subscription error', err);
        }
      })();
    }
  }

  log('info', `Subscribed to Agora events on ${subscriptionRelays.length} relay(s)`);
}

/** Close all relay connections. */
export function closeRelays(): void {
  for (const relay of subscriptionRelays) {
    try {
      relay.close();
    } catch {
      // ignore
    }
  }
  subscriptionRelays.length = 0;
  log('info', 'Relay connections closed');
}
