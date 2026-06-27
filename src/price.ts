import { log } from './config.js';
import type { PriceData } from './types.js';

let cache: PriceData | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Fetch BTC price in USD, with caching. Falls back to mempool.space. */
export async function getBtcPriceUsd(): Promise<number | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.usd;
  }

  // Primary: CoinGecko
  try {
    const resp = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      { headers: { Accept: 'application/json' } }
    );
    if (resp.ok) {
      const data = (await resp.json()) as { bitcoin?: { usd?: number } };
      const usd = data?.bitcoin?.usd;
      if (usd && usd > 0) {
        cache = { usd, fetchedAt: Date.now() };
        log('debug', `BTC price (CoinGecko): $${usd}`);
        return usd;
      }
    }
  } catch (err) {
    log('warn', 'CoinGecko price fetch failed', err);
  }

  // Fallback: mempool.space
  try {
    const resp = await fetch('https://mempool.space/api/v1/prices');
    if (resp.ok) {
      const data = (await resp.json()) as { USD?: number };
      const usd = data?.USD;
      if (usd && usd > 0) {
        cache = { usd, fetchedAt: Date.now() };
        log('debug', `BTC price (mempool.space): $${usd}`);
        return usd;
      }
    }
  } catch (err) {
    log('warn', 'mempool.space price fetch failed', err);
  }

  log('warn', 'All BTC price sources failed');
  return null;
}

/** Convert sats to USD string. Returns "~$X.XX" or "unknown". */
export async function satsToUsdString(sats: number): Promise<string> {
  const price = await getBtcPriceUsd();
  if (!price) return 'unknown';
  const btc = sats / 100_000_000;
  const usd = btc * price;
  if (usd < 1) return `~$${usd.toFixed(2)}`;
  if (usd < 1000) return `~$${usd.toFixed(2)}`;
  return `~$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
