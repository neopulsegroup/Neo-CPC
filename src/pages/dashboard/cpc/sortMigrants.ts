export type SortOption = 'name_asc' | 'name_desc' | 'created_at_desc' | 'created_at_asc';

export const SORT_STORAGE_KEY = 'cpc.migrants.sort';

export const SORT_OPTIONS: ReadonlyArray<SortOption> = [
  'created_at_desc',
  'created_at_asc',
  'name_asc',
  'name_desc',
];

export function isSortOption(value: unknown): value is SortOption {
  return typeof value === 'string' && (SORT_OPTIONS as ReadonlyArray<string>).includes(value);
}

export function getTime(ts: unknown): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: unknown }).toDate === 'function') {
    try {
      return ((ts as { toDate(): Date }).toDate()).getTime();
    } catch {
      return 0;
    }
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts && typeof (ts as { seconds: unknown }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  if (typeof ts === 'string') {
    const v = new Date(ts).getTime();
    return Number.isFinite(v) ? v : 0;
  }
  if (typeof ts === 'number') return ts;
  return 0;
}

export interface SortableMigrant {
  first_name?: string | null;
  name?: string | null;
  created_at?: unknown;
}

export function sortMigrants<T extends SortableMigrant>(migrants: T[], sortBy: SortOption): T[] {
  const copy = [...migrants];
  const getName = (m: SortableMigrant) => (m.first_name ?? m.name ?? '') as string;
  switch (sortBy) {
    case 'name_asc':
      return copy.sort((a, b) => getName(a).localeCompare(getName(b), 'pt'));
    case 'name_desc':
      return copy.sort((a, b) => getName(b).localeCompare(getName(a), 'pt'));
    case 'created_at_desc':
      return copy.sort((a, b) => getTime(b.created_at) - getTime(a.created_at));
    case 'created_at_asc': {
      return copy.sort((a, b) => {
        const ta = getTime(a.created_at);
        const tb = getTime(b.created_at);
        // Sem created_at vai para o fim em ambas as direções
        if (ta === 0 && tb !== 0) return 1;
        if (tb === 0 && ta !== 0) return -1;
        return ta - tb;
      });
    }
  }
}
