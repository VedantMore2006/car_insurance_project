export function formatConfidence(confidence: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  return `${pct}%`;
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return 'Unknown size';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDetectionCount(count: number): string {
  if (count === 0) {
    return 'No damage detected';
  }
  return count === 1
    ? '1 damage area detected'
    : `${count} damage areas detected`;
}
