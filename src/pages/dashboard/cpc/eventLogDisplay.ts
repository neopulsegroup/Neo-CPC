import { getDocument } from '@/integrations/firebase/firestore';

type UserDoc = { name?: string | null; email?: string | null; role?: string | null };

type TranslateFn = { get: (key: string) => string };

const ACTOR_FETCH_CHUNK = 25;

export type EventLogScope = 'all' | 'migrant' | 'company' | 'cpc';
export type AuditLogCriticality = 'low' | 'medium' | 'high';
export type AuditLogResult = 'success' | 'error' | 'warning';
export type AuditLogOrigin = 'app' | 'http' | 'function';

export type EventLogListFilters = {
  search: string;
  actorId: string;
  dateFrom: string;
  dateTo: string;
  scope: EventLogScope;
  action: string;
  criticality: string;
  result: string;
  origin: string;
};

export type EventLogFilterableRow = {
  actorId: string;
  actorEmail: string;
  action: string;
  actionLabel: string;
  actionKind: string;
  actorLabel: string;
  context: string;
  targetId: string;
  createdAtMs: number;
  scope: EventLogScope;
  criticality: AuditLogCriticality;
  result: AuditLogResult;
  origin: AuditLogOrigin;
  requestLabel: string;
  httpStatus: number;
};

export type ActorMeta = {
  displayName: string;
  email: string;
  role: string;
};

export type AuditLogRawDoc = {
  entity_type?: string | null;
  entity_id?: string | null;
  target_id?: string | null;
  context?: string | null;
  detail?: unknown;
  before?: unknown;
  after?: unknown;
  duration_ms?: number | null;
  ip_address?: string | null;
  user_agent?: string | null;
  http_method?: string | null;
  http_path?: string | null;
  http_status?: number | null;
  request_id?: string | null;
  origin?: string | null;
  company_id?: string | null;
  criticality?: string | null;
  result?: string | null;
};

export function getEventLogActionDescription(action: string, t: TranslateFn): string {
  if (!action || action === '—') return '—';
  const key = `cpc.pages.eventLog.actions.${action}`;
  const label = t.get(key);
  return label === key ? action : label;
}

export function getAuditLogActionKind(action: string, t: TranslateFn): string {
  if (!action || action === '—') return '—';
  const normalized = action.toLowerCase();
  let kindKey = 'other';
  if (normalized.includes('unauthorized')) kindKey = 'access';
  else if (normalized.includes('.delete') || normalized.includes('deleted') || normalized.includes('cleared')) kindKey = 'delete';
  else if (normalized.includes('.create') || normalized.includes('created')) kindKey = 'create';
  else if (
    normalized.includes('.update') ||
    normalized.includes('updated') ||
    normalized.includes('blocked') ||
    normalized.includes('unblocked') ||
    normalized.includes('deactivated') ||
    normalized.includes('reactivated') ||
    normalized.includes('.set')
  ) {
    kindKey = 'update';
  } else if (normalized.includes('smtp') || normalized.includes('mail') || normalized.includes('test')) kindKey = 'execute';
  else if (normalized.includes('.read') || normalized.startsWith('read')) kindKey = 'read';

  const label = t.get(`cpc.pages.eventLog.actionKinds.${kindKey}`);
  return label === `cpc.pages.eventLog.actionKinds.${kindKey}` ? kindKey : label;
}

export function inferAuditLogCriticality(action: string, raw?: string | null): AuditLogCriticality {
  const normalizedRaw = String(raw ?? '').trim().toLowerCase();
  if (normalizedRaw === 'low' || normalizedRaw === 'medium' || normalizedRaw === 'high') {
    return normalizedRaw;
  }
  const normalized = action.toLowerCase();
  if (normalized.includes('unauthorized') || normalized.includes('blocked')) return 'high';
  if (normalized.includes('error') || normalized.includes('settings_updated')) return 'medium';
  return 'low';
}

export function inferAuditLogResult(action: string, httpStatus?: number | null, raw?: string | null): AuditLogResult {
  const normalizedRaw = String(raw ?? '').trim().toLowerCase();
  if (normalizedRaw === 'success' || normalizedRaw === 'error' || normalizedRaw === 'warning') {
    return normalizedRaw;
  }
  if (typeof httpStatus === 'number' && !Number.isNaN(httpStatus)) {
    if (httpStatus >= 500) return 'error';
    if (httpStatus >= 400) return 'warning';
    return 'success';
  }
  const normalized = action.toLowerCase();
  if (normalized.includes('error') || normalized.includes('unauthorized')) return 'error';
  if (normalized.includes('warning')) return 'warning';
  return 'success';
}

export function inferAuditLogOrigin(context: string, raw?: string | null): AuditLogOrigin {
  const normalizedRaw = String(raw ?? '').trim().toLowerCase();
  if (normalizedRaw === 'app' || normalizedRaw === 'http' || normalizedRaw === 'function') {
    return normalizedRaw;
  }
  const normalizedContext = context.trim().toLowerCase();
  if (normalizedContext.includes('http') || normalizedContext.includes('api')) return 'http';
  if (normalizedContext.includes('function') || normalizedContext.includes('mail')) return 'function';
  return 'app';
}

export function getAuditLogResource(entityType: string, context: string): string {
  if (entityType && entityType !== '—') return entityType;
  if (context && context !== '—') return context;
  return '—';
}

export function getAuditLogRequestLabel(
  context: string,
  action: string,
  httpMethod: string,
  httpPath: string
): string {
  if (httpMethod && httpPath) return `${httpMethod} ${httpPath}`;
  if (context && context !== '—') return `APP ${context}`;
  if (action && action !== '—') return action;
  return '—';
}

export function inferAuditLogHttpStatus(
  action: string,
  result: AuditLogResult,
  httpStatus: number | null
): number {
  if (typeof httpStatus === 'number' && !Number.isNaN(httpStatus)) return httpStatus;
  if (result === 'error') {
    return action.toLowerCase().includes('unauthorized') ? 403 : 500;
  }
  if (result === 'warning') return 400;
  return 200;
}

export function buildAuditLogMetadata(doc: AuditLogRawDoc): Record<string, unknown> | null {
  const metadata: Record<string, unknown> = {};
  if (doc.detail !== undefined && doc.detail !== null) metadata.detail = doc.detail;
  if (doc.before !== undefined && doc.before !== null) metadata.before = doc.before;
  if (doc.after !== undefined && doc.after !== null) metadata.after = doc.after;
  if (doc.context) metadata.context = doc.context;
  if (doc.target_id) metadata.target_id = doc.target_id;
  if (doc.entity_id) metadata.entity_id = doc.entity_id;
  return Object.keys(metadata).length > 0 ? metadata : null;
}

export function resolveActorDisplayName(
  actorId: string,
  actorMetaById: Record<string, ActorMeta>,
  t: TranslateFn
): string {
  if (!actorId || actorId === '—') return '—';
  const meta = actorMetaById[actorId];
  if (meta?.email) return meta.email;
  const resolved = meta?.displayName;
  if (resolved) return resolved;
  return t.get('cpc.pages.eventLog.unknownActor');
}

export function resolveActorEmail(actorId: string, actorMetaById: Record<string, ActorMeta>): string {
  if (!actorId || actorId === '—') return '—';
  return actorMetaById[actorId]?.email || '—';
}

export function localDateKeyFromMs(ms: number): string {
  if (!ms || Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateTimeFilter(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = new Date(trimmed).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function matchesDateFilter(createdAtMs: number, dateFrom: string, dateTo: string): boolean {
  if (!dateFrom && !dateTo) return true;
  if (!createdAtMs) return false;

  const fromMs = dateFrom
    ? dateFrom.includes('T')
      ? parseDateTimeFilter(dateFrom)
      : new Date(`${dateFrom}T00:00:00`).getTime()
    : null;
  const toMs = dateTo
    ? dateTo.includes('T')
      ? parseDateTimeFilter(dateTo)
      : new Date(`${dateTo}T23:59:59.999`).getTime()
    : null;

  if (fromMs !== null && createdAtMs < fromMs) return false;
  if (toMs !== null && createdAtMs > toMs) return false;
  return true;
}

export function filterEventLogRows<T extends EventLogFilterableRow>(rows: T[], filters: EventLogListFilters): T[] {
  const q = filters.search.trim().toLowerCase();
  const byScope = filters.scope === 'all' ? rows : rows.filter((row) => row.scope === filters.scope);

  return byScope.filter((row) => {
    if (filters.actorId !== 'all' && row.actorId !== filters.actorId) return false;
    if (filters.action !== 'all' && row.action !== filters.action) return false;
    if (filters.criticality !== 'all' && row.criticality !== filters.criticality) return false;
    if (filters.result !== 'all' && row.result !== filters.result) return false;
    if (filters.origin !== 'all' && row.origin !== filters.origin) return false;
    if (!matchesDateFilter(row.createdAtMs, filters.dateFrom, filters.dateTo)) return false;

    if (!q) return true;
    const haystack = [
      row.action,
      row.actionLabel,
      row.actionKind,
      row.actorId,
      row.actorLabel,
      row.actorEmail,
      row.context,
      row.targetId,
      row.requestLabel,
      row.criticality,
      row.result,
      row.origin,
      String(row.httpStatus),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function paginateRows<T>(rows: T[], pageIndex: number, pageSize: number): T[] {
  const safePageSize = Math.max(1, pageSize);
  const safePageIndex = Math.max(0, pageIndex);
  const start = safePageIndex * safePageSize;
  return rows.slice(start, start + safePageSize);
}

export function getUniqueActionCodes<T extends { action: string }>(rows: T[]): string[] {
  const codes = new Set<string>();
  for (const row of rows) {
    if (row.action && row.action !== '—') codes.add(row.action);
  }
  return [...codes].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
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
          result[id] = { displayName: name || email || id, email, role };
        } catch {
          result[id] = { displayName: id, email: '', role: '' };
        }
      })
    );
  }

  return result;
}
