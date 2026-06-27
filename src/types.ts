/** Shared TypeScript types for Agora Bot */

export interface CampaignInfo {
  pubkey: string;
  identifier: string;      // d-tag
  title: string;
  summary: string;
  goalUsd: number | null;
  countryCode: string | null;
  wallet: string | null;
  naddr: string;
  url: string;
  coord: string;           // "33863:<pubkey>:<d>"
}

export interface DonationInfo {
  pubkey: string;
  amountSats: number;
  campaignCoord: string | null;  // "33863:<pubkey>:<d>"
  comment: string;
  txid: string | null;
  sourceEventId: string;
}

export interface ParsedEvent {
  kind: number;
  eventId: string;
  campaign?: CampaignInfo;
  donation?: DonationInfo;
}

export interface PriceData {
  usd: number;
  fetchedAt: number;
}

export interface QueuedAnnouncement {
  content: string;
  tags: string[][];
  sourceEventId: string;
  sourceKind: number;
  metadata: Record<string, unknown>;
  queuedAt: number;
}
