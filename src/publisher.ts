import { finalizeEvent } from 'nostr-tools';
import { config, log } from './config.js';
import type { NostrEvent } from '@nostrify/nostrify';

/** Sign and publish a kind 1 announcement to all publish relays. */
export async function publishAnnouncement(
  content: string,
  tags: string[][]
): Promise<string | null> {
  // Build the event
  const template: Omit<NostrEvent, 'id' | 'sig' | 'pubkey'> = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    content,
    tags: [
      ['t', 'agora'],
      ['t', 'agora-bot'],
      ...tags,
    ],
  };

  // Sign with nostr-tools (finalizeEvent mutates and returns)
  const signedEvent = finalizeEvent(
    template as unknown as Record<string, unknown> as Parameters<typeof finalizeEvent>[0],
    config.secretKeyBytes
  ) as NostrEvent;

  log('info', `Signed announcement ${signedEvent.id}`);
  log('debug', 'Announcement content:', content);

  // Publish to all relays via WebSocket
  const publishPromises = config.publishRelays.map((relayUrl) =>
    publishToRelay(relayUrl, signedEvent)
  );

  const results = await Promise.allSettled(publishPromises);
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - succeeded;

  if (failed > 0) {
    log('warn', `Published to ${succeeded}/${config.publishRelays.length} relays (${failed} failed)`);
  } else {
    log('info', `Published to all ${config.publishRelays.length} relays`);
  }

  return signedEvent.id;
}

/** Publish a single event to a single relay via raw WebSocket. */
function publishToRelay(relayUrl: string, event: NostrEvent): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Publish timeout to ${relayUrl}`));
    }, 15_000);

    ws.onopen = () => {
      ws.send(JSON.stringify(['EVENT', event]));
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string) as unknown[];
        if (data[0] === 'OK' && data[1] === event.id) {
          clearTimeout(timeout);
          ws.close();
          if (data[2] === true) {
            log('debug', `Published to ${relayUrl}: OK`);
            resolve();
          } else {
            const reason = data[3] ?? 'rejected';
            reject(new Error(`Relay ${relayUrl} rejected: ${reason}`));
          }
        }
      } catch {
        // Ignore non-JSON or unexpected messages
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      ws.close();
      reject(new Error(`WebSocket error to ${relayUrl}`));
    };
  });
}
