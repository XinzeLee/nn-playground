export const RECENT_EPOCHS = 200;

// The recent view holds its span fixed; full history intentionally fits the whole run.
export function chartWindow(lastEpoch, mode) {
  const last = Math.max(0, Number.isFinite(lastEpoch) ? lastEpoch : 0);
  if (mode === 'full') return { start: 0, end: Math.max(1, last) };
  const start = Math.max(0, last - RECENT_EPOCHS);
  return { start, end: start + RECENT_EPOCHS };
}

export function chartHasOutOfRange(points, keys, start, end, min, max) {
  return points.some(p => p.epoch >= start && p.epoch <= end &&
    keys.some(key => Number.isFinite(p[key]) && (p[key] < min || p[key] > max)));
}
