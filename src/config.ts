import { hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { nip19 } from 'nostr-tools';
import { secp256k1 } from '@noble/curves/secp256k1.js';

/** Load configuration from environment variables. */

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

const SECRET_KEY_HEX = required('NOSTR_SECRET_KEY');
const RELAYS = optional('RELAYS', 'wss://relay.ditto.pub/,wss://relay.dreamith.to/')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

const PUBLISH_RELAYS = optional(
  'PUBLISH_RELAYS',
  'wss://relay.ditto.pub/,wss://relay.dreamith.to/,wss://relay.primal.net/,wss://nos.lol'
)
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

const DATA_DIR = optional('DATA_DIR', './data');
const POST_INTERVAL_MS = parseInt(optional('POST_INTERVAL_MS', '300000'), 10);
const LOG_LEVEL = optional('LOG_LEVEL', 'info');

// Derive pubkey from secret key (compressed: 0x02/0x03 || x — drop prefix byte)
const secretKeyBytes = hexToBytes(SECRET_KEY_HEX);
const PUBKEY_HEX = bytesToHex(secp256k1.getPublicKey(secretKeyBytes, true).slice(1));
const BOT_NPUB = nip19.npubEncode(PUBKEY_HEX);
const BOT_NSEC = nip19.nsecEncode(secretKeyBytes);

export const config = {
  secretKeyHex: SECRET_KEY_HEX,
  secretKeyBytes,
  pubkeyHex: PUBKEY_HEX,
  botNpub: BOT_NPUB,
  botNsec: BOT_NSEC,
  relays: RELAYS,
  publishRelays: PUBLISH_RELAYS,
  dataDir: DATA_DIR,
  postIntervalMs: POST_INTERVAL_MS,
  logLevel: LOG_LEVEL,
} as const;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function log(level: LogLevel, msg: string, extra?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[config.logLevel as LogLevel]) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (extra !== undefined) {
    console.log(prefix, msg, extra);
  } else {
    console.log(prefix, msg);
  }
}
