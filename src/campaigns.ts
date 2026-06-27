import type { NostrEvent } from '@nostrify/nostrify';
import { log } from './config.js';
import { buildAgoraUrl, buildCoord } from './naddr.js';
import { cacheCampaign } from './database.js';
import type { CampaignInfo } from './types.js';

/** Get a tag value from a Nostr event. */
export function getTag(event: NostrEvent, name: string): string | null {
  for (const tag of event.tags) {
    if (tag[0] === name && tag[1]) return tag[1];
  }
  return null;
}

/** Get all values for a named tag. */
export function getTagAll(event: NostrEvent, name: string): string[] {
  return event.tags.filter((t) => t[0] === name && t[1]).map((t) => t[1]);
}

/** Parse a kind 33863 campaign event. */
export function parseCampaign(event: NostrEvent): CampaignInfo {
  const identifier = getTag(event, 'd') ?? '';
  const title = getTag(event, 'title') ?? 'Untitled Campaign';
  const summary = getTag(event, 'summary') ?? '';
  const goalStr = getTag(event, 'goal');
  const goalUsd = goalStr ? parseInt(goalStr, 10) || null : null;
  const countryCode = getTag(event, 'i')?.replace('iso3166:', '') ?? null;
  const wallets = getTagAll(event, 'w');
  const wallet = wallets.length > 0 ? wallets[0] : null;

  const { naddr, url } = buildAgoraUrl(event.pubkey, identifier);
  const coord = buildCoord(33863, event.pubkey, identifier);

  const info: CampaignInfo = {
    pubkey: event.pubkey,
    identifier,
    title,
    summary,
    goalUsd,
    countryCode,
    wallet,
    naddr,
    url,
    coord,
  };

  // Cache it for donation lookups
  cacheCampaign(info);
  log('debug', `Parsed campaign: ${title} (${coord})`);

  return info;
}

/** Truncate a wallet address for display. */
export function truncateWallet(wallet: string | null): string {
  if (!wallet) return 'N/A';
  if (wallet.length <= 20) return wallet;
  return `${wallet.slice(0, 12)}...${wallet.slice(-6)}`;
}

/** Country code to flag emoji. */
export function countryCodeToFlag(code: string | null): string {
  if (!code || code.length !== 2) return '🌍';
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

/** Full country name lookup (common ones). */
export function countryCodeToName(code: string | null): string {
  if (!code) return 'Unknown';
  const names: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    DE: 'Germany',
    FR: 'France',
    JP: 'Japan',
    BR: 'Brazil',
    MX: 'Mexico',
    AR: 'Argentina',
    ES: 'Spain',
    IT: 'Italy',
    NL: 'Netherlands',
    PT: 'Portugal',
    SE: 'Sweden',
    NO: 'Norway',
    FI: 'Finland',
    DK: 'Denmark',
    CH: 'Switzerland',
    AT: 'Austria',
    BE: 'Belgium',
    IE: 'Ireland',
    PL: 'Poland',
    CZ: 'Czech Republic',
    GR: 'Greece',
    TR: 'Turkey',
    IN: 'India',
    CN: 'China',
    KR: 'South Korea',
    SG: 'Singapore',
    ID: 'Indonesia',
    TH: 'Thailand',
    VN: 'Vietnam',
    PH: 'Philippines',
    MY: 'Malaysia',
    ZA: 'South Africa',
    NG: 'Nigeria',
    KE: 'Kenya',
    EG: 'Egypt',
    MA: 'Morocco',
    UY: 'Uruguay',
    CO: 'Colombia',
    CL: 'Chile',
    PE: 'Peru',
    VE: 'Venezuela',
    EC: 'Ecuador',
    CR: 'Costa Rica',
    PA: 'Panama',
    DO: 'Dominican Republic',
    GT: 'Guatemala',
    IL: 'Israel',
    AE: 'United Arab Emirates',
    SA: 'Saudi Arabia',
    LB: 'Lebanon',
    JO: 'Jordan',
    UA: 'Ukraine',
    RU: 'Russia',
    LV: 'Latvia',
    LT: 'Lithuania',
    EE: 'Estonia',
    IS: 'Iceland',
    HR: 'Croatia',
    RS: 'Serbia',
    RO: 'Romania',
    BG: 'Bulgaria',
    HU: 'Hungary',
    SK: 'Slovakia',
    SI: 'Slovenia',
  };
  return names[code.toUpperCase()] ?? code.toUpperCase();
}
