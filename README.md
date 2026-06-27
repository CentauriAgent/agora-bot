# Agora Nostr Announcement Bot

A daemon that monitors [Agora](https://agora.spot) campaigns and donations in real-time via Nostr, and posts human-readable announcements to Nostr relays.

## What It Does

- 🚀 **New Campaign Alerts** — When someone creates a fundraising campaign on Agora (Nostr kind 33863), the bot announces it with title, summary, goal, and link.
- 💜 **Donation Alerts** — When someone makes an on-chain Bitcoin donation (kind 8333), the bot announces the amount in sats + USD equivalent.
- 📊 **Batch Summaries** — When the queue overflows (>50 events), posts a summary instead of individual announcements.

## Setup

### 1. Install Dependencies

```bash
cd /home/moltbot/projects/agora-bot
npm install
```

### 2. Configure

Copy `.env.example` to `.env` and fill in values, or use the systemd env file at `~/.config/agora-bot/env`.

Required env vars:
- `NOSTR_SECRET_KEY` — Bot's Nostr secret key (hex)
- `RELAYS` — Comma-separated subscription relays
- `PUBLISH_RELAYS` — Comma-separated publish relays

### 3. Bot Identity

The bot uses a dedicated Nostr keypair stored at `~/.config/agora-bot/secret.key`.

- **npub:** `npub180qwxhvzrwqcfm8qmevvnmckl27snvanw9ehwcgwnmc96gqutyeqxfq63w`

To regenerate:
```bash
nak key generate > ~/.config/agora-bot/secret.key
```

## Running

### Development

```bash
npm run dev        # Run with tsx (hot reload)
npm run build      # Compile TypeScript
npm start          # Run compiled output
```

### Testing

```bash
# Subscribe to Agora events and log them (read-only, no publishing)
npx tsx scripts/test-subscribe.ts

# Publish a test announcement
npx tsx scripts/test-publish.ts --dry-run   # Print only
npx tsx scripts/test-publish.ts             # Actually publish
```

### Systemd Service

The service file is at `~/.config/systemd/user/agora-bot.service`.

```bash
systemctl --user daemon-reload
systemctl --user enable agora-bot
systemctl --user start agora-bot
systemctl --user status agora-bot
journalctl --user -u agora-bot -f           # Follow logs
```

Environment file: `~/.config/agora-bot/env`

## Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Relay Subs   │───▶│  Event Processor  │──▶│  Publisher      │
│  (NRelay1)    │    │  + Dedup (SQLite) │    │  (kind 1 posts) │
└──────────────┘    └──────────────────┘    └─────────────────┘
```

### Event Kinds Monitored

| Kind | Purpose |
|------|---------|
| 33863 | New fundraising campaigns |
| 8333 | On-chain donation receipts |

### Event Kinds Published

| Kind | Content |
|------|---------|
| 1 | Announcement posts with `#agora` + `#agora-bot` tags |

## Rate Limiting

- Maximum 1 announcement post per 5 minutes (configurable via `POST_INTERVAL_MS`)
- Events are queued in FIFO order
- Queue overflow (>50) triggers a batch summary post

## BTC Price

Donation announcements include USD equivalents using:
- Primary: CoinGecko API
- Fallback: mempool.space API
- Cached for 5 minutes

## License

MIT
