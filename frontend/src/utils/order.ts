export type EntityOrName = string | { name?: unknown };

export function entityName(v: EntityOrName | undefined | null, fallback?: string): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') return v.name;
  return fallback || '';
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}
