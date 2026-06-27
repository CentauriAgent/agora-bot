import { nip19 } from 'nostr-tools';

/** Build an agora.spot URL from campaign parameters. */
export function buildAgoraUrl(
  pubkey: string,
  identifier: string,
  kind = 33863,
  relays: string[] = ['wss://relay.ditto.pub/']
): { naddr: string; url: string } {
  const naddr = nip19.naddrEncode({
    kind,
    pubkey,
    identifier,
    relays,
  });
  return {
    naddr,
    url: `https://agora.spot/${naddr}`,
  };
}

/** Build the campaign coordinate string used in `a` tags. */
export function buildCoord(kind: number, pubkey: string, identifier: string): string {
  return `${kind}:${pubkey}:${identifier}`;
}

/** Parse a coordinate string "33863:<pubkey>:<d>" into parts. */
export function parseCoord(coord: string): { kind: number; pubkey: string; identifier: string } | null {
  const parts = coord.split(':');
  if (parts.length !== 3) return null;
  const kind = parseInt(parts[0], 10);
  if (isNaN(kind)) return null;
  return { kind, pubkey: parts[1], identifier: parts[2] };
}
