import type { NostrEvent } from '@nostrify/nostrify';
import { config, log } from './config.js';
import { isAnnounced, recordAnnouncement, getCampaignByCoord } from './database.js';
import { parseCampaign } from './campaigns.js';
import { parseDonation } from './donations.js';
import { formatCampaignPost, formatDonationPost } from './formatter.js';
import { publishAnnouncement } from './publisher.js';
import { parseCoord, buildAgoraUrl } from './naddr.js';
import type { QueuedAnnouncement } from './types.js';

const queue: QueuedAnnouncement[] = [];
let lastPostTime = 0;
let processing = false;

/** Main event handler — dedup, parse, format, enqueue. */
export async function handleEvent(event: NostrEvent): Promise<void> {
  // Dedup
  if (isAnnounced(event.id)) {
    log('debug', `Skipping already-announced event ${event.id}`);
    return;
  }

  log('info', `Processing event ${event.id} (kind ${event.kind})`);

  if (event.kind === 33863) {
    await handleCampaignEvent(event);
  } else if (event.kind === 8333) {
    await handleDonationEvent(event);
  } else {
    log('debug', `Ignoring unhandled kind ${event.kind}`);
    recordAnnouncement(event.id, event.kind, null, { reason: 'unhandled_kind' });
  }
}

/** Process a kind 33863 campaign event. */
async function handleCampaignEvent(event: NostrEvent): Promise<void> {
  const campaign = parseCampaign(event);

  // Check if we've already announced this campaign coordinate
  const existing = getCampaignByCoord(campaign.coord);
  if (existing && existing.title === campaign.title) {
    // This is likely an update, not a new campaign
    log('debug', `Campaign ${campaign.coord} already cached, likely an update`);
    recordAnnouncement(event.id, 33863, null, { reason: 'campaign_update', coord: campaign.coord });
    return;
  }

  const content = formatCampaignPost(campaign);

  enqueue({
    content,
    tags: [
      ['r', campaign.url],
    ],
    sourceEventId: event.id,
    sourceKind: 33863,
    metadata: { coord: campaign.coord, title: campaign.title },
    queuedAt: Date.now(),
  });
}

/** Process a kind 8333 donation receipt event. */
async function handleDonationEvent(event: NostrEvent): Promise<void> {
  const donation = parseDonation(event);

  if (donation.amountSats <= 0) {
    log('warn', `Donation ${event.id} has invalid amount, skipping`);
    recordAnnouncement(event.id, 8333, null, { reason: 'invalid_amount' });
    return;
  }

  // Resolve campaign
  let campaignTitle = 'a campaign';
  let campaignUrl = 'https://agora.spot';

  if (donation.campaignCoord) {
    const cached = getCampaignByCoord(donation.campaignCoord);
    if (cached) {
      campaignTitle = cached.title;
      campaignUrl = cached.url;
    } else {
      // Try to parse coordinate and build URL
      const parts = parseCoord(donation.campaignCoord);
      if (parts) {
        const { url } = buildAgoraUrl(parts.pubkey, parts.identifier);
        campaignUrl = url;
        campaignTitle = parts.identifier.replace(/-/g, ' ');
      }
    }
  }

  // Use donor pubkey for npub reference
  const donorNpub = event.pubkey;

  const content = await formatDonationPost(
    donation,
    getCampaignByCoord(donation.campaignCoord ?? ''),
    campaignUrl
  );

  const tags: string[][] = [
    ['p', donorNpub],
  ];

  // Add quote/mention of source event
  tags.push(['e', event.id, '', 'mention']);
  tags.push(['q', event.id]);

  // Tag the campaign author if we know the coord
  if (donation.campaignCoord) {
    const parts = parseCoord(donation.campaignCoord);
    if (parts) {
      tags.push(['p', parts.pubkey]);
    }
  }

  enqueue({
    content,
    tags,
    sourceEventId: event.id,
    sourceKind: 8333,
    metadata: {
      amountSats: donation.amountSats,
      campaignCoord: donation.campaignCoord,
      campaignTitle,
    },
    queuedAt: Date.now(),
  });
}

/** Add an announcement to the queue. */
function enqueue(announcement: QueuedAnnouncement): void {
  queue.push(announcement);
  log('info', `Queued announcement (${queue.length} in queue)`);
  void processQueue();
}

/** Process the queue with rate limiting. */
async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    while (queue.length > 0) {
      const elapsed = Date.now() - lastPostTime;
      const wait = config.postIntervalMs;

      if (elapsed < wait) {
        const delay = wait - elapsed;
        log('debug', `Rate limit: waiting ${delay}ms before next post`);
        await sleep(delay);
      }

      // Batch if queue is too large
      if (queue.length > 50) {
        await flushBatch();
      } else {
        const item = queue.shift()!;
        const announcementId = await publishAnnouncement(item.content, item.tags);

        recordAnnouncement(item.sourceEventId, item.sourceKind, announcementId, item.metadata);
        lastPostTime = Date.now();
        log('info', `Published announcement ${announcementId} for event ${item.sourceEventId}`);
      }
    }
  } catch (err) {
    log('error', 'Queue processing error', err);
  } finally {
    processing = false;
  }
}

/** Flush the queue as a batch summary post. */
async function flushBatch(): Promise<void> {
  const campaignCount = queue.filter((q) => q.sourceKind === 33863).length;
  const donationItems = queue.filter((q) => q.sourceKind === 8333);
  const donationCount = donationItems.length;
  const totalSats = donationItems.reduce((sum, q) => {
    const meta = q.metadata as { amountSats?: number };
    return sum + (meta.amountSats ?? 0);
  }, 0);

  // Import formatter for batch
  const { formatSummaryPost } = await import('./formatter.js');
  const content = formatSummaryPost(campaignCount, donationCount, totalSats);

  const sourceIds = queue.map((q) => q.sourceEventId);
  const announcementId = await publishAnnouncement(content, []);

  // Record all events as announced
  for (const item of queue) {
    recordAnnouncement(item.sourceEventId, item.sourceKind, announcementId, {
      ...item.metadata,
      batch: true,
    });
  }

  queue.length = 0;
  lastPostTime = Date.now();
  log('info', `Published batch summary (${campaignCount} campaigns, ${donationCount} donations) for ${sourceIds.length} events`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
