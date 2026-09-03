export function formatAccessCount(rawCount: number): string {
  const count = Math.max(0, Math.floor(rawCount));
  if (count <= 25) return String(count);
  if (count < 50) return '+25';
  if (count < 100) return '+50';
  if (count < 500) return '+100';
  if (count < 1000) return '+500';
  if (count < 5000) return '+1k';
  if (count < 10000) return '+5k';
  if (count < 50000) return '+10k';
  if (count < 100000) return '+50k';
  if (count < 1000000) return '+100k';
  return '+1M';
}
