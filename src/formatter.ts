import type { CampaignInfo, DonationInfo } from './types.js';
import { truncateWallet, countryCodeToFlag, countryCodeToName } from './campaigns.js';
import { satsToUsdString } from './price.js';

/** Format a new campaign announcement post. */
export function formatCampaignPost(c: CampaignInfo): string {
  const lines: string[] = [];

  lines.push('🚀 New campaign on Agora!');
  lines.push('');
  lines.push(c.title);
  lines.push('');

  if (c.summary) {
    lines.push(c.summary);
    lines.push('');
  }

  if (c.goalUsd) {
    lines.push(`🎯 Goal: $${c.goalUsd.toLocaleString('en-US')} USD`);
  }

  const flag = countryCodeToFlag(c.countryCode);
  const countryName = countryCodeToName(c.countryCode);
  lines.push(`🌍 ${flag} ${countryName}`);

  const walletPreview = truncateWallet(c.wallet);
  lines.push(`₿ ${walletPreview}`);
  lines.push('');

  lines.push(`Support here: ${c.url}`);
  lines.push('');
  lines.push('#Agora #Bitcoin #Fundraising');

  return lines.join('\n');
}

/** Format a donation announcement post. */
export async function formatDonationPost(
  donation: DonationInfo,
  campaign: CampaignInfo | null,
  url: string
): Promise<string> {
  const lines: string[] = [];

  const amountFormatted = donation.amountSats.toLocaleString('en-US');
  const usdStr = await satsToUsdString(donation.amountSats);
  const campaignTitle = campaign?.title ?? 'a campaign';

  lines.push(`💜 Someone just donated ${amountFormatted} sats to "${campaignTitle}"!`);
  lines.push('');
  lines.push(`That's ${usdStr} at current prices.`);
  lines.push('');

  if (donation.comment) {
    lines.push(`"${donation.comment}"`);
    lines.push('');
  }

  lines.push(`Support this campaign: ${url}`);
  lines.push('');
  lines.push('#Agora #Bitcoin');

  return lines.join('\n');
}

/** Format a batch summary post. */
export function formatSummaryPost(
  campaignCount: number,
  donationCount: number,
  totalSats: number
): string {
  const lines: string[] = [];
  lines.push('📊 Agora Activity Summary:');
  lines.push('');

  if (campaignCount > 0) {
    lines.push(`🚀 ${campaignCount} new campaign${campaignCount > 1 ? 's' : ''} launched`);
  }
  if (donationCount > 0) {
    lines.push(`💜 ${donationCount} donation${donationCount > 1 ? 's' : ''} totaling ${totalSats.toLocaleString('en-US')} sats`);
  }

  lines.push('');
  lines.push('See all: https://agora.spot');
  lines.push('');
  lines.push('#Agora #Bitcoin');

  return lines.join('\n');
}
