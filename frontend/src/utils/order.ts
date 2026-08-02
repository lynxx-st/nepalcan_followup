export type EntityOrName = string | { name?: unknown };

export function entityName(v: EntityOrName | undefined | null, fallback?: string): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') return v.name;
  return fallback || '';
}
