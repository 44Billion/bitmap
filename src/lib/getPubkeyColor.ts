/**
 * Generate a consistent color based on a pubkey string
 * Uses a simple hash function to convert the pubkey to a hue value
 */
export function getPubkeyColor(pubkey: string): string {
  if (!pubkey) return '#6b7280'; // Default gray color
  
  // Simple hash function to generate a number from the string
  let hash = 0;
  for (let i = 0; i < pubkey.length; i++) {
    const char = pubkey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to a hue value (0-360)
  const hue = Math.abs(hash) % 360;
  
  // Use medium saturation and lightness for good visibility
  return `hsl(${hue}, 70%, 60%)`;
}