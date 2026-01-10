export const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "0 seconds";

  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0 && days === 0)
    parts.push(`${minutes} min${minutes > 1 ? "s" : ""}`); // Show minutes only if less than a day

  // If very short, show seconds? Or just default to <1 min? Let's show <1 min for simplicity.
  if (parts.length === 0 && totalSeconds > 0) return "< 1 minute";
  if (parts.length === 0) return "0 seconds"; // Should not happen if totalSeconds > 0

  return parts.join(", ");
};

export const truncateAddress = (address: string): string => {
  // Handle both addresses (0x...) and regular IDs
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
