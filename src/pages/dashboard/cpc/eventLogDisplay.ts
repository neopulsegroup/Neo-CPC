import { getDocument } from '@/integrations/firebase/firestore';

type UserDoc = { name?: string | null; email?: string | null; role?: string | null };

type TranslateFn = { get: (key: string) => string };

const ACTOR_FETCH_CHUNK = 25;

export type EventLogScope = 'all' | 'migrant' | 'company' | 'cpc';

export type EventLogListFilters = {
  search: string;
  actorId: string;
  dateFrom: string;
  dateTo: string;
  scope: EventLogScope;
};

export type EventLogFilterableRow = {
  actorId: string;
  action: string;
  actionLabel: string;
  actorLabel: string;
  context: string;
  targetId: string;
  createdAtMs: number;
  scope: EventLogScope;
};

export type ActorMeta = {
  displayName: string;
  role: string;
};

export function getEventLogActionDescription(action: string, t: TranslateFn): string {
  if (!action || action === '—') return '—';
  const key = `cpc.pages.eventLog.actions.${action}`;
  const label = t.get(key);
  return label === key ? action : label;
}

export function resolveActorDisplayName(
  actorId: string,
  actorMetaById: Record<string, ActorMeta>,
  t: TranslateFn
): string {
  if (!actorId || actorId === '—') return '—';
  const resolved = actorMetaById[actorId]?.displayName;
  if (resolved) return resolved;
  return t.get('cpc.pages.eventLog.unknownActor');
}

export function localDateKeyFromMs(ms: number): string {
  if (!ms || Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function filterEventLogRows<T extends EventLogFilterableRow>(rows: T[], filters: EventLogListFilters): T[] {
  const q = filters.search.trim().toLowerCase();
  const byScope = filters.scope === 'all' ? rows : rows.filter((row) => row.scope === filters.scope);

  return byScope.filter((row) => {
    if (filters.actorId !== 'all' && row.actorId !== filters.actorId) return false;

    if (filters.dateFrom || filters.dateTo) {
      const rowDay = localDateKeyFromMs(row.createdAtMs);
      if (!rowDay) return false;
      if (filters.dateFrom && rowDay < filters.dateFrom) return false;
      if (filters.dateTo && rowDay > filters.dateTo) return false;
    }

    if (!q) return true;
    const haystack = [row.action, row.actionLabel, row.actorId, row.actorLabel, row.context, row.targetId]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function getEventLogScope(actorRole: string, context: string): EventLogScope {
  const normalizedRole = actorRole.trim().toLowerCase();
  if (normalizedRole === 'migrant') return 'migrant';
  if (normalizedRole === 'company') return 'company';

  const normalizedContext = context.trim().toLowerCase();
  if (normalizedContext.includes('migrant')) return 'migrant';
  if (normalizedContext.includes('company')) return 'company';

  return 'cpc';
}

export async function loadActorMetaById(actorIds: string[]): Promise<Record<string, ActorMeta>> {
  const unique = [...new Set(actorIds.filter((id) => id && id !== '—'))];
  const result: Record<string, ActorMeta> = {};

  for (let i = 0; i < unique.length; i += ACTOR_FETCH_CHUNK) {
    const chunk = unique.slice(i, i + ACTOR_FETCH_CHUNK);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const doc = await getDocument<UserDoc>('users', id);
          const name = typeof doc?.name === 'string' ? doc.name.trim() : '';
          const email = typeof doc?.email === 'string' ? doc.email.trim() : '';
          const role = typeof doc?.role === 'string' ? doc.role.trim().toLowerCase() : '';
          result[id] = { displayName: name || email || id, role };
        } catch {
          result[id] = { displayName: id, role: '' };
        }
      })
    );
  }

  return result;
}
