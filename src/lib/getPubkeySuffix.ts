/**
 * Extract the last 4 characters of a pubkey for subtle identification
 */
export function getPubkeySuffix(pubkey: string): string {
  if (!pubkey || pubkey.length < 4) {
    return '';
  }
  return pubkey.slice(-4);
}