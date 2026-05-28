import { addDocument, countDocuments, deleteDocument, getDocument, queryDocuments, serverTimestamp, updateDocument } from '@/integrations/firebase/firestore';
import type { ActivityDoc, ActivityStatus, ActivityType, ActivityUpsertInput } from './model';
import { buildSearchTokens, computeDurationMinutes, toStartAt } from './model';

type UserDoc = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  active?: boolean | null;
};

export type ConsultantOption = { id: string; name: string; role: string };
export type MigrantOption = { id: string; name: string; email: string };

function normalizeRole(value?: string | null): string {
  return (value || '').toLowerCase().trim();
}

export async function listConsultants(): Promise<ConsultantOption[]> {
  const users = await queryDocuments<UserDoc>('users', []);
  const allowed = new Set(['admin', 'manager', 'coordinator', 'mediator', 'lawyer', 'psychologist', 'trainer']);
  return users
    .filter((u) => u.active !== false)
    .map((u) => ({ id: u.id, name: u.name || u.email || '—', role: normalizeRole(u.role) }))
    .filter((u) => allowed.has(u.role))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listMigrants(): Promise<MigrantOption[]> {
  const migrants = await queryDocuments<UserDoc>('users', [{ field: 'role', operator: 'in', value: ['migrant', 'Migrant', 'MIGRANT'] }]);
  return migrants
    .map((u) => ({ id: u.id, name: u.name || u.email || '—', email: u.email || '—' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type ActivitiesListFilters = {
  type: ActivityType | 'all';
  status: ActivityStatus | 'all';
  format: 'presencial' | 'online' | 'hibrido' | 'all';
  consultantId: string | 'all';
  topic: string | 'all';
  startAtMin: string | null;
  startAtMax: string | null;
  /** Até 10 tokens; Firestore `array-contains-any` (documento contém qualquer um). */
  searchTokensAny: string[] | null;
};

function buildFirestoreFilters(filters: ActivitiesListFilters) {
  const out: Array<{ field: string; operator: Parameters<typeof queryDocuments>[1][number]['operator']; value: unknown }> = [];
  if (filters.type !== 'all') out.push({ field: 'activityType', operator: '==', value: filters.type });
  if (filters.status !== 'all') out.push({ field: 'status', operator: '==', value: filters.status });
  if (filters.format !== 'all') out.push({ field: 'format', operator: '==', value: filters.format });
  if (filters.consultantId !== 'all') out.push({ field: 'consultantIds', operator: 'array-contains', value: filters.consultantId });
  if (filters.topic !== 'all') out.push({ field: 'topics', operator: 'array-contains', value: filters.topic });
  if (filters.searchTokensAny && filters.searchTokensAny.length > 0) {
    out.push({ field: 'searchTokens', operator: 'array-contains-any', value: filters.searchTokensAny });
  }
  if (filters.startAtMin) out.push({ field: 'startAt', operator: '>=', value: filters.startAtMin });
  if (filters.startAtMax) out.push({ field: 'startAt', operator: '<=', value: filters.startAtMax });
  return out;
}

/**
 * Firestore permite no máximo um filtro `array-contains` / `array-contains-any` por consulta.
 * Com pesquisa + temática + consultor ativos em simultâneo, mantém-se no servidor o de maior prioridade
 * (pesquisa → consultor → temática) e aplicam-se os restantes em memória após ler os documentos.
 */
function planActivitiesQuery(filters: ActivitiesListFilters): {
  serverFilters: ReturnType<typeof buildFirestoreFilters>;
  clientPredicate: (doc: ActivityDoc) => boolean;
  needsBufferedScan: boolean;
} {
  const hasSearch = !!(filters.searchTokensAny && filters.searchTokensAny.length > 0);
  const hasTopic = filters.topic !== 'all';
  const hasConsultant = filters.consultantId !== 'all';
  const arrayCount = (hasSearch ? 1 : 0) + (hasTopic ? 1 : 0) + (hasConsultant ? 1 : 0);

  if (arrayCount <= 1) {
    return {
      serverFilters: buildFirestoreFilters(filters),
      clientPredicate: () => true,
      needsBufferedScan: false,
    };
  }

  const server: ActivitiesListFilters = {
    type: filters.type,
    status: filters.status,
    format: filters.format,
    consultantId: 'all',
    topic: 'all',
    searchTokensAny: null,
    startAtMin: filters.startAtMin,
    startAtMax: filters.startAtMax,
  };

  let clientTopic = false;
  let clientConsultant = false;

  if (hasSearch) {
    server.searchTokensAny = filters.searchTokensAny;
    clientTopic = hasTopic;
    clientConsultant = hasConsultant;
  } else if (hasConsultant) {
    server.consultantId = filters.consultantId;
    clientTopic = hasTopic;
  } else if (hasTopic) {
    server.topic = filters.topic;
  }

  const topicValue = filters.topic;
  const consultantValue = filters.consultantId;

  const clientPredicate = (row: ActivityDoc): boolean => {
    if (clientTopic && topicValue !== 'all' && !(row.topics || []).includes(topicValue)) return false;
    if (clientConsultant && consultantValue !== 'all' && !(row.consultantIds || []).includes(consultantValue)) return false;
    return true;
  };

  return {
    serverFilters: buildFirestoreFilters(server),
    clientPredicate,
    needsBufferedScan: true,
  };
}

export async function countActivities(filters: ActivitiesListFilters): Promise<number> {
  const planned = planActivitiesQuery(filters);
  if (!planned.needsBufferedScan) {
    return countDocuments('activities', planned.serverFilters);
  }

  let firestoreCursor: string | null = null;
  let total = 0;
  const batchSize = 200;
  let guard = 0;
  while (guard < 500) {
    guard += 1;
    const batch = await queryDocuments<ActivityDoc>(
      'activities',
      planned.serverFilters,
      { field: 'startAt', direction: 'desc' },
      batchSize,
      firestoreCursor ? [firestoreCursor] : undefined
    );
    if (batch.length === 0) break;
    for (const doc of batch) {
      if (planned.clientPredicate(doc)) total += 1;
    }
    firestoreCursor = batch[batch.length - 1]?.startAt ?? null;
    if (batch.length < batchSize || !firestoreCursor) break;
  }
  return total;
}

export type ListActivitiesPageResult = { rows: ActivityDoc[]; nextCursor: string | null };

export async function listActivitiesPage(args: {
  filters: ActivitiesListFilters;
  limit: number;
  cursorStartAfterStartAt?: string | null;
}): Promise<ListActivitiesPageResult> {
  const { filters, limit: limitCount, cursorStartAfterStartAt } = args;
  const planned = planActivitiesQuery(filters);

  if (!planned.needsBufferedScan) {
    const rows = await queryDocuments<ActivityDoc>(
      'activities',
      planned.serverFilters,
      { field: 'startAt', direction: 'desc' },
      limitCount,
      cursorStartAfterStartAt ? [cursorStartAfterStartAt] : undefined
    );
    return {
      rows,
      nextCursor: rows.length === limitCount ? rows[rows.length - 1]?.startAt ?? null : null,
    };
  }

  const batchSize = Math.max(80, limitCount * 3);
  let firestoreCursor: string | null = cursorStartAfterStartAt ?? null;
  const out: ActivityDoc[] = [];
  let lastReadStartAt: string | null = null;
  let iterations = 0;
  let serverExhausted = false;

  while (out.length < limitCount && iterations < 400) {
    iterations += 1;
    const batch = await queryDocuments<ActivityDoc>(
      'activities',
      planned.serverFilters,
      { field: 'startAt', direction: 'desc' },
      batchSize,
      firestoreCursor ? [firestoreCursor] : undefined
    );
    if (batch.length === 0) {
      serverExhausted = true;
      break;
    }

    for (const doc of batch) {
      lastReadStartAt = doc.startAt;
      if (planned.clientPredicate(doc)) {
        out.push(doc);
        if (out.length >= limitCount) break;
      }
    }

    const lastInBatch = batch[batch.length - 1]?.startAt ?? null;
    firestoreCursor = lastInBatch;
    if (batch.length < batchSize) serverExhausted = true;
    if (out.length >= limitCount) break;
    if (!firestoreCursor) break;
  }

  return {
    rows: out,
    nextCursor: out.length === limitCount && !serverExhausted && lastReadStartAt ? lastReadStartAt : null,
  };
}

export async function getActivity(activityId: string): Promise<ActivityDoc | null> {
  return getDocument<ActivityDoc>('activities', activityId);
}

function normalizeParticipantIdToken(id: string): string {
  const t = id.trim();
  if (t.includes('@')) return t.toLowerCase();
  return t;
}

function toPersistedDoc(input: ActivityUpsertInput): Omit<ActivityDoc, 'id'> {
  const duration = computeDurationMinutes(input.startTime, input.endTime);
  if (!duration) throw new Error('Intervalo de horário inválido.');
  const startAt = toStartAt(input.date, input.startTime);
  const endAt = toStartAt(input.date, input.endTime);
  const consultantNames = input.consultantNames.map((n) => n.trim()).filter(Boolean);
  const topics = input.topics.map((t) => t.trim()).filter(Boolean);
  return {
    title: input.title.trim(),
    activityType: input.activityType as ActivityDoc['activityType'],
    format: input.format as ActivityDoc['format'],
    status: input.status as ActivityDoc['status'],
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    startAt,
    endAt,
    durationMinutes: duration,
    location: input.location.trim(),
    topics,
    consultantIds: Array.from(new Set(input.consultantIds)),
    consultantNames,
    participantMigrantIds: Array.from(new Set(input.participantMigrantIds.map(normalizeParticipantIdToken).filter(Boolean))),
    participantCompanyIds: Array.from(new Set(input.participantCompanyIds)),
    participantConsultantIds: Array.from(new Set(input.participantConsultantIds)),
    searchTokens: buildSearchTokens({
      title: input.title,
      location: input.location,
      topics,
      consultantNames,
    }),
  };
}

function compactActivityForAudit(doc: Omit<ActivityDoc, 'id'> | ActivityDoc) {
  return {
    title: doc.title,
    activityType: doc.activityType,
    format: doc.format,
    status: doc.status,
    date: doc.date,
    startTime: doc.startTime,
    endTime: doc.endTime,
    durationMinutes: doc.durationMinutes,
    location: doc.location,
    topics: doc.topics,
    consultantIds: doc.consultantIds,
    participantMigrantIds: doc.participantMigrantIds,
    participantCompanyIds: doc.participantCompanyIds,
    participantConsultantIds: doc.participantConsultantIds,
  };
}

export async function createActivity(args: { input: ActivityUpsertInput; actorId: string }): Promise<string> {
  const persisted = toPersistedDoc(args.input);
  const id = await addDocument('activities', {
    ...persisted,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: args.actorId,
    updatedBy: args.actorId,
    deletedAt: null,
    deletedBy: null,
  });

  await addDocument('audit_logs', {
    action: 'activities.create',
    actor_id: args.actorId,
    entity_type: 'activity',
    entity_id: id,
    before: null,
    after: compactActivityForAudit(persisted),
    createdAt: serverTimestamp(),
  });

  return id;
}

export async function updateActivity(args: { activityId: string; input: ActivityUpsertInput; actorId: string }): Promise<void> {
  const existing = await getActivity(args.activityId);
  const persisted = toPersistedDoc(args.input);
  await updateDocument('activities', args.activityId, {
    ...persisted,
    updatedBy: args.actorId,
  });

  await addDocument('audit_logs', {
    action: 'activities.update',
    actor_id: args.actorId,
    entity_type: 'activity',
    entity_id: args.activityId,
    before: existing ? compactActivityForAudit(existing) : null,
    after: compactActivityForAudit(persisted),
    createdAt: serverTimestamp(),
  });
}

export async function deleteActivity(args: { activityId: string; actorId: string }): Promise<void> {
  const existing = await getActivity(args.activityId);
  await deleteDocument('activities', args.activityId);
  await addDocument('audit_logs', {
    action: 'activities.delete',
    actor_id: args.actorId,
    entity_type: 'activity',
    entity_id: args.activityId,
    before: existing ? compactActivityForAudit(existing) : null,
    after: null,
    createdAt: serverTimestamp(),
  });
}
