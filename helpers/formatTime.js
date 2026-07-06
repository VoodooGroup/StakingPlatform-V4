export function formatTime(seconds) {
  if (seconds <= 0) return '0d 0h 0m 0s';
  const d = Math.floor(seconds / 86400);
  seconds %= 86400;
  const h = Math.floor(seconds / 3600);
  seconds %= 3600;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

export function formatActiveSince(startDate) {
  const now = new Date();
  let diff = Math.floor((now - startDate) / 1000);
  const days = Math.floor(diff / 86400);
  diff %= 86400;
  const hours = Math.floor(diff / 3600);
  diff %= 3600;
  const mins = Math.floor(diff / 60);
  return `${days} days, ${hours} hours, ${mins} mins`;
}