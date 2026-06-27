import type { NostrEvent } from '@nostrify/nostrify';
import { log } from './config.js';
import { getTag } from './campaigns.js';
import { getCampaignByCoord } from './database.js';
import { parseCoord, buildAgoraUrl } from './naddr.js';
import type { CampaignInfo, DonationInfo } from './types.js';

/** Parse a kind 8333 donation receipt event. */
export function parseDonation(event: NostrEvent): DonationInfo {
  const amountStr = getTag(event, 'amount');
  const amountSats = amountStr ? parseInt(amountStr, 10) || 0 : 0;

  const campaignCoord = getTag(event, 'a');
  const comment = event.content ?? '';
  const txidTag = getTag(event, 'i');
  const txid = txidTag?.replace('bitcoin:tx:', '') ?? null;

  const info: DonationInfo = {
    pubkey: event.pubkey,
    amountSats,
    campaignCoord,
    comment,
    txid,
    sourceEventId: event.id,
  };

  log('debug', `Parsed donation: ${amountSats} sats to ${campaignCoord}`);

  return info;
}

/** Resolve campaign info for a donation, from cache or relay data. */
export function resolveDonationCampaign(
  donation: DonationInfo,
  fetchCampaign?: (coord: string) => Promise<CampaignInfo | null>
): { campaign: CampaignInfo | null; url: string } {
  if (!donation.campaignCoord) {
    return { campaign: null, url: 'https://agora.spot' };
  }

  // Try cache first
  const cached = getCampaignByCoord(donation.campaignCoord);
  if (cached) {
    return { campaign: cached, url: cached.url };
  }

  // Parse coordinate for URL building (fallback)
  const parts = parseCoord(donation.campaignCoord);
  if (parts) {
    const { url } = buildAgoraUrl(parts.pubkey, parts.identifier);
    return { campaign: null, url };
  }

  return { campaign: null, url: 'https://agora.spot' };
}


