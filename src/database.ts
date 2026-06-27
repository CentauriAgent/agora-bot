import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config, log } from './config.js';
import type { CampaignInfo } from './types.js';

let db: Database.Database | null = null;

/** Open the SQLite database and initialize schema. */
export function openDb(): Database.Database {
  const dbPath = join(config.dataDir, 'agora-bot.db');
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS announced_events (
      event_id TEXT PRIMARY KEY,
      event_kind INTEGER NOT NULL,
      announced_at INTEGER NOT NULL,
      announcement_id TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS campaign_cache (
      coord TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      pubkey TEXT NOT NULL,
      identifier TEXT NOT NULL,
      naddr TEXT NOT NULL,
      goal_usd INTEGER,
      country_code TEXT,
      first_seen INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_announced_kind ON announced_events(event_kind);
    CREATE INDEX IF NOT EXISTS idx_campaign_coord ON campaign_cache(coord);
  `);

  log('info', `Database opened at ${dbPath}`);
  return db;
}

/** Close the database connection. */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    log('info', 'Database closed');
  }
}

/** Check if an event has already been announced. */
export function isAnnounced(eventId: string): boolean {
  if (!db) throw new Error('Database not open');
  const row = db.prepare('SELECT 1 FROM announced_events WHERE event_id = ?').get(eventId);
  return row !== undefined;
}

/** Record an announced event. */
export function recordAnnouncement(
  eventId: string,
  eventKind: number,
  announcementId: string | null,
  metadata: Record<string, unknown>
): void {
  if (!db) throw new Error('Database not open');
  db.prepare(
    `INSERT OR IGNORE INTO announced_events (event_id, event_kind, announced_at, announcement_id, metadata)
     VALUES (?, ?, ?, ?, ?)`
  ).run(eventId, eventKind, Date.now(), announcementId, JSON.stringify(metadata));
}

/** Cache a campaign for donation lookups. */
export function cacheCampaign(c: CampaignInfo): void {
  if (!db) throw new Error('Database not open');
  db.prepare(
    `INSERT OR REPLACE INTO campaign_cache
      (coord, title, summary, pubkey, identifier, naddr, goal_usd, country_code, first_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    c.coord,
    c.title,
    c.summary,
    c.pubkey,
    c.identifier,
    c.naddr,
    c.goalUsd,
    c.countryCode,
    Date.now()
  );
}

/** Look up a cached campaign by coordinate. */
export function getCampaignByCoord(coord: string): CampaignInfo | null {
  if (!db) throw new Error('Database not open');
  const row = db.prepare('SELECT * FROM campaign_cache WHERE coord = ?').get(coord) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    pubkey: row.pubkey as string,
    identifier: row.identifier as string,
    title: row.title as string,
    summary: (row.summary as string) ?? '',
    goalUsd: (row.goal_usd as number) ?? null,
    countryCode: (row.country_code as string) ?? null,
    wallet: null,
    naddr: row.naddr as string,
    url: `https://agora.spot/${row.naddr as string}`,
    coord: row.coord as string,
  };
}
