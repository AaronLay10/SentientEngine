/**
 * Format timestamp as HH:MM:SS.mmm
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format timestamp as relative time (e.g., "2s ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) {
    return 'just now';
  }

  if (diff < 60000) {
    const seconds = Math.floor(diff / 1000);
    return `${seconds}s ago`;
  }

  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  const hours = Math.floor(diff / 3600000);
  return `${hours}h ago`;
}

/**
 * Format event rate as string
 */
export function formatEventRate(rate: number): string {
  if (rate < 0.1) {
    return '< 0.1/s';
  }
  return `${rate.toFixed(1)}/s`;
}
