import { addDocument, deleteDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { getCalendarDateIsoInTimeZone } from '@/lib/appCalendar';
import { CATEGORY_SERVICE_ID, CATEGORY_SESSION_TYPE } from '@/lib/cpcSpecialists';
import { notifyMigrantSessionScheduled } from '@/lib/migrantSessionNotifications';

export const SUPPORT_REQUESTS_COLLECTION = 'support_requests';

export const SUPPORT_REQUEST_TYPES = ['juridico', 'psicologico', 'habitacional', 'necessidades'] as const;
export type SupportRequestType = (typeof SUPPORT_REQUEST_TYPES)[number];

export const SUPPORT_REQUEST_STATUSES = ['submetido', 'aprovado', 'em_analise', 'resolvido', 'cancelado'] as const;
export type SupportRequestStatus = (typeof SUPPORT_REQUEST_STATUSES)[number];

export type SupportRequestAgendaCategory = 'legal' | 'psychology' | 'mediation';

export type SupportRequestDoc = {
  id: string;
  migrant_id: string;
  type: SupportRequestType;
  description: string;
  status: SupportRequestStatus | string;
  created_at: string;
  updated_at?: string | null;
  migrant_name?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  specialist_id?: string | null;
  specialist_name?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  session_id?: string | null;
};

export type LegacyLocalSupportRequest = {
  id: string;
  type: SupportRequestType;
  description: string;
  status: string;
  date: string;
};

export type SupportScheduleDraft = {
  dateIso: string;
  timeLabel: string;
  specialistId: string;
  specialistName: string;
};

export const SUPPORT_REQUEST_APPROVAL_TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let minutes = 8 * 60; minutes < 19 * 60; minutes += 30) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
})();

export function isSupportRequestType(value: string): value is SupportRequestType {
  return (SUPPORT_REQUEST_TYPES as readonly string[]).includes(value);
}

export function isPendingSupportRequestStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').toLowerCase().trim();
  return normalized === 'submetido' || normalized === 'pending' || normalized === 'pendente';
}

export function isApprovedSupportRequestStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').toLowerCase().trim();
  return normalized === 'aprovado' || normalized === 'approved';
}

export function isRejectedSupportRequestStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').toLowerCase().trim();
  return normalized === 'cancelado' || normalized === 'recusado' || normalized === 'rejected' || normalized === 'cancelled' || normalized === 'canceled';
}

export function shouldShowSupportRequestOnMigrantCard(status: string | null | undefined): boolean {
  return !isRejectedSupportRequestStatus(status);
}

export const SUPPORT_REQUEST_HISTORY_STATUS = 'recusado';

export type MigrantSupportHistorySession = {
  id: string;
  session_type: 'mediador' | 'jurista' | 'psicologa' | 'coletiva';
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  service_id?: string;
  service_label?: string;
  specialist_name?: string;
  support_request_id: string;
};

export function resolveSupportRequestDisplayDateIso(request: SupportRequestDoc): string {
  const scheduled = request.scheduled_date?.trim();
  if (scheduled && /^\d{4}-\d{2}-\d{2}$/.test(scheduled)) return scheduled;

  for (const value of [request.updated_at, request.created_at]) {
    const raw = value?.trim();
    if (!raw) continue;
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return getCalendarDateIsoInTimeZone(new Date(parsed));
    }
  }

  return getCalendarDateIsoInTimeZone(new Date());
}

export function supportRequestToMigrantHistorySession(request: SupportRequestDoc): MigrantSupportHistorySession | null {
  if (!isRejectedSupportRequestStatus(request.status) || !isSupportRequestType(request.type)) return null;

  const category = supportRequestTypeToAgendaCategory(request.type);
  const sessionType = CATEGORY_SESSION_TYPE[category] as MigrantSupportHistorySession['session_type'];

  return {
    id: `support-request:${request.id}`,
    session_type: sessionType,
    scheduled_date: resolveSupportRequestDisplayDateIso(request),
    scheduled_time: request.scheduled_time?.trim() || '—',
    status: SUPPORT_REQUEST_HISTORY_STATUS,
    service_id: CATEGORY_SERVICE_ID[category],
    specialist_name: request.specialist_name?.trim() || undefined,
    support_request_id: request.id,
  };
}

export function mergeRejectedSupportRequestsIntoMigrantHistory<T extends { support_request_id?: string }>(
  historySessions: T[],
  rejectedRequests: SupportRequestDoc[]
): Array<T | MigrantSupportHistorySession> {
  const coveredSupportRequestIds = new Set(
    historySessions
      .map((session) => session.support_request_id?.trim())
      .filter((value): value is string => Boolean(value))
  );

  const fromRequests = rejectedRequests
    .map((request) => supportRequestToMigrantHistorySession(request))
    .filter((session): session is MigrantSupportHistorySession => session !== null)
    .filter((session) => !coveredSupportRequestIds.has(session.support_request_id));

  return [...historySessions, ...fromRequests];
}

export function canMigrantDeleteSupportRequest(status: string | null | undefined): boolean {
  return isPendingSupportRequestStatus(status);
}

export function isSupportScheduleDraftComplete(draft: SupportScheduleDraft | null | undefined): boolean {
  if (!draft) return false;
  return Boolean(
    draft.dateIso &&
      /^\d{4}-\d{2}-\d{2}$/.test(draft.dateIso) &&
      draft.timeLabel.trim() &&
      draft.specialistId.trim() &&
      draft.specialistName.trim()
  );
}

export function supportRequestTypeToAgendaCategory(type: SupportRequestType): 'legal' | 'psychology' | 'mediation' {
  if (type === 'juridico') return 'legal';
  if (type === 'psicologico') return 'psychology';
  return 'mediation';
}

export function supportRequestSessionLabelKey(type: SupportRequestType): string {
  const category = supportRequestTypeToAgendaCategory(type);
  return `cpc.agenda.sessionTypes.${category}`;
}

export function supportRequestTypeLabelKey(type: SupportRequestType): string {
  return `dashboard.support_types.${type}`;
}

export function supportRequestStatusLabelKey(status: string | null | undefined): string {
  const normalized = (status ?? '').toLowerCase().trim();
  if (isApprovedSupportRequestStatus(normalized)) {
    return 'dashboard.support_request_status.aprovado';
  }
  if (isRejectedSupportRequestStatus(normalized)) {
    return 'dashboard.support_request_status.recusado';
  }
  if (normalized === 'em_analise' || normalized === 'em analise' || normalized === 'in_review') {
    return 'dashboard.support_request_status.em_analise';
  }
  if (normalized === 'resolvido' || normalized === 'resolved' || normalized === 'concluido') {
    return 'dashboard.support_request_status.resolvido';
  }
  return 'dashboard.support_request_status.em_aprovacao';
}

export function supportRequestStatusBadgeClass(status: string | null | undefined): string {
  if (isApprovedSupportRequestStatus(status)) {
    return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
  }
  if (isRejectedSupportRequestStatus(status)) {
    return 'bg-rose-100 text-rose-800 ring-1 ring-rose-200';
  }
  if (isPendingSupportRequestStatus(status)) {
    return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
  }
  return 'bg-muted text-muted-foreground ring-1 ring-border';
}

export function sortSupportRequestsNewestFirst(rows: SupportRequestDoc[]): SupportRequestDoc[] {
  return [...rows].sort((a, b) => {
    const tb = Date.parse(b.created_at || '');
    const ta = Date.parse(a.created_at || '');
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

export async function querySupportRequestsForMigrant(migrantId: string): Promise<SupportRequestDoc[]> {
  const docs = await queryDocuments<SupportRequestDoc>(SUPPORT_REQUESTS_COLLECTION, [
    { field: 'migrant_id', operator: '==', value: migrantId },
  ]);
  return sortSupportRequestsNewestFirst(docs ?? []);
}

export async function queryPendingSupportRequests(): Promise<SupportRequestDoc[]> {
  const docs = await queryDocuments<SupportRequestDoc>(SUPPORT_REQUESTS_COLLECTION, [
    { field: 'status', operator: '==', value: 'submetido' },
  ]);
  return sortSupportRequestsNewestFirst(docs ?? []);
}

export async function queryCancelledSupportRequests(): Promise<SupportRequestDoc[]> {
  const [cancelado, recusado, cancelled, rejected] = await Promise.all([
    queryDocuments<SupportRequestDoc>(SUPPORT_REQUESTS_COLLECTION, [
      { field: 'status', operator: '==', value: 'cancelado' },
    ]),
    queryDocuments<SupportRequestDoc>(SUPPORT_REQUESTS_COLLECTION, [
      { field: 'status', operator: '==', value: 'recusado' },
    ]),
    queryDocuments<SupportRequestDoc>(SUPPORT_REQUESTS_COLLECTION, [
      { field: 'status', operator: '==', value: 'cancelled' },
    ]),
    queryDocuments<SupportRequestDoc>(SUPPORT_REQUESTS_COLLECTION, [
      { field: 'status', operator: '==', value: 'rejected' },
    ]),
  ]);
  const byId = new Map<string, SupportRequestDoc>();
  for (const doc of [...(cancelado ?? []), ...(recusado ?? []), ...(cancelled ?? []), ...(rejected ?? [])]) {
    byId.set(doc.id, doc);
  }
  return sortSupportRequestsNewestFirst(Array.from(byId.values()));
}

export async function queryApprovedSupportRequests(): Promise<SupportRequestDoc[]> {
  const [aprovado, approved] = await Promise.all([
    queryDocuments<SupportRequestDoc>(SUPPORT_REQUESTS_COLLECTION, [
      { field: 'status', operator: '==', value: 'aprovado' },
    ]),
    queryDocuments<SupportRequestDoc>(SUPPORT_REQUESTS_COLLECTION, [
      { field: 'status', operator: '==', value: 'approved' },
    ]),
  ]);
  const byId = new Map<string, SupportRequestDoc>();
  for (const doc of [...(aprovado ?? []), ...(approved ?? [])]) {
    byId.set(doc.id, doc);
  }
  return sortSupportRequestsNewestFirst(Array.from(byId.values()));
}

function buildSupportRequestSessionPayload(args: {
  request: Pick<SupportRequestDoc, 'id' | 'migrant_id' | 'type'>;
  scheduledDate: string;
  scheduledTime: string;
  specialistId: string;
  specialistName: string;
  approvedBy: string;
  serviceLabel?: string | null;
}): Record<string, unknown> {
  const category = supportRequestTypeToAgendaCategory(args.request.type);
  return {
    migrant_id: args.request.migrant_id,
    session_type: CATEGORY_SESSION_TYPE[category],
    scheduled_date: args.scheduledDate,
    scheduled_time: args.scheduledTime,
    status: 'Agendada',
    service_label: args.serviceLabel?.trim() || null,
    requested_by: 'cpc',
    created_by: args.approvedBy,
    support_request_id: args.request.id,
    specialist_id: args.specialistId,
    specialist_name: args.specialistName,
    consultant_uid: args.specialistId,
    professional_id: args.specialistId,
    service_id: CATEGORY_SERVICE_ID[category],
  };
}

async function findExistingSessionForSupportRequest(
  request: Pick<
    SupportRequestDoc,
    'id' | 'migrant_id' | 'scheduled_date' | 'scheduled_time' | 'specialist_id' | 'session_id'
  >
): Promise<string | null> {
  const linkedSessionId = request.session_id?.trim();
  if (linkedSessionId) return linkedSessionId;

  const bySupportRequest = await queryDocuments<{ id: string }>('sessions', [
    { field: 'support_request_id', operator: '==', value: request.id },
  ]);
  if (bySupportRequest?.[0]?.id) return bySupportRequest[0].id;

  const migrantId = request.migrant_id?.trim();
  const scheduledDate = request.scheduled_date?.trim();
  const scheduledTime = request.scheduled_time?.trim();
  const specialistId = request.specialist_id?.trim();
  if (!migrantId || !scheduledDate || !scheduledTime) return null;

  const sameDaySessions = await queryDocuments<{
    id: string;
    scheduled_time?: string | null;
    specialist_id?: string | null;
    status?: string | null;
  }>('sessions', [
    { field: 'migrant_id', operator: '==', value: migrantId },
    { field: 'scheduled_date', operator: '==', value: scheduledDate },
  ]);

  const match = (sameDaySessions ?? []).find((session) => {
    const status = (session.status ?? '').toLowerCase();
    if (status.includes('cancel') || status === 'rejected' || status === 'recusado') return false;
    if ((session.scheduled_time ?? '').trim() !== scheduledTime) return false;
    if (!specialistId) return true;
    return (session.specialist_id ?? '').trim() === specialistId;
  });

  return match?.id ?? null;
}

async function linkSupportRequestToExistingSession(requestId: string, sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDocument('sessions', sessionId, { support_request_id: requestId });
  await updateDocument(SUPPORT_REQUESTS_COLLECTION, requestId, {
    session_id: sessionId,
    updated_at: now,
  });
}

export async function ensureSessionForApprovedSupportRequest(
  request: SupportRequestDoc
): Promise<string | null> {
  if (!isApprovedSupportRequestStatus(request.status)) return null;

  const scheduledDate = request.scheduled_date?.trim();
  const scheduledTime = request.scheduled_time?.trim();
  const specialistId = request.specialist_id?.trim();
  const specialistName = request.specialist_name?.trim();
  if (!scheduledDate || !scheduledTime || !specialistId || !specialistName) return null;

  const existingSessionId = await findExistingSessionForSupportRequest(request);
  if (existingSessionId) {
    await linkSupportRequestToExistingSession(request.id, existingSessionId);
    return existingSessionId;
  }

  const now = new Date().toISOString();
  const sessionPayload = buildSupportRequestSessionPayload({
    request,
    scheduledDate,
    scheduledTime,
    specialistId,
    specialistName,
    approvedBy: request.approved_by?.trim() || specialistId,
  });

  const sessionId = await addDocument('sessions', sessionPayload);
  await updateDocument(SUPPORT_REQUESTS_COLLECTION, request.id, {
    session_id: sessionId,
    updated_at: now,
  });
  return sessionId;
}

export async function countPendingSupportRequests(): Promise<number> {
  const docs = await queryPendingSupportRequests();
  return docs.length;
}

export async function createSupportRequest(args: {
  migrantId: string;
  migrantName?: string | null;
  type: SupportRequestType;
  description: string;
}): Promise<string> {
  const description = args.description.trim();
  const now = new Date().toISOString();
  return addDocument(SUPPORT_REQUESTS_COLLECTION, {
    migrant_id: args.migrantId,
    migrant_name: args.migrantName?.trim() || null,
    type: args.type,
    description,
    status: 'submetido' satisfies SupportRequestStatus,
    created_at: now,
    updated_at: now,
  });
}

export async function approveSupportRequestWithSession(args: {
  request: Pick<SupportRequestDoc, 'id' | 'migrant_id' | 'type'>;
  scheduledDate: string;
  scheduledTime: string;
  specialistId: string;
  specialistName: string;
  approvedBy: string;
  serviceLabel: string;
}): Promise<string> {
  const now = new Date().toISOString();
  const existingSessionId = await findExistingSessionForSupportRequest({
    id: args.request.id,
    migrant_id: args.request.migrant_id,
    scheduled_date: args.scheduledDate,
    scheduled_time: args.scheduledTime,
    specialist_id: args.specialistId,
    session_id: null,
  });

  if (existingSessionId) {
    await updateDocument('sessions', existingSessionId, {
      support_request_id: args.request.id,
      specialist_id: args.specialistId,
      specialist_name: args.specialistName,
      consultant_uid: args.specialistId,
      professional_id: args.specialistId,
      service_label: args.serviceLabel,
      status: 'Agendada',
    });
    await updateDocument(SUPPORT_REQUESTS_COLLECTION, args.request.id, {
      status: 'aprovado',
      scheduled_date: args.scheduledDate,
      scheduled_time: args.scheduledTime,
      specialist_id: args.specialistId,
      specialist_name: args.specialistName,
      approved_at: now,
      approved_by: args.approvedBy,
      updated_at: now,
      session_id: existingSessionId,
    });

    try {
      await notifyMigrantSessionScheduled({
        migrantId: args.request.migrant_id,
        sessionId: existingSessionId,
        serviceLabel: args.serviceLabel,
        scheduledDateIso: args.scheduledDate,
        scheduledTime: args.scheduledTime,
        specialistName: args.specialistName,
        createdBy: args.approvedBy,
      });
    } catch (notificationError) {
      console.error('Erro ao notificar migrante sobre sessão de apoio urgente', notificationError);
    }

    return existingSessionId;
  }

  const sessionPayload = buildSupportRequestSessionPayload({
    request: args.request,
    scheduledDate: args.scheduledDate,
    scheduledTime: args.scheduledTime,
    specialistId: args.specialistId,
    specialistName: args.specialistName,
    approvedBy: args.approvedBy,
    serviceLabel: args.serviceLabel,
  });

  const sessionId = await addDocument('sessions', sessionPayload);

  await updateDocument(SUPPORT_REQUESTS_COLLECTION, args.request.id, {
    status: 'aprovado',
    scheduled_date: args.scheduledDate,
    scheduled_time: args.scheduledTime,
    specialist_id: args.specialistId,
    specialist_name: args.specialistName,
    approved_at: now,
    approved_by: args.approvedBy,
    updated_at: now,
    session_id: sessionId,
  });

  try {
    await notifyMigrantSessionScheduled({
      migrantId: args.request.migrant_id,
      sessionId,
      serviceLabel: args.serviceLabel,
      scheduledDateIso: args.scheduledDate,
      scheduledTime: args.scheduledTime,
      specialistName: args.specialistName,
      createdBy: args.approvedBy,
    });
  } catch (notificationError) {
    console.error('Erro ao notificar migrante sobre sessão de apoio urgente', notificationError);
  }

  return sessionId;
}

export async function cancelSupportRequest(requestId: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDocument(SUPPORT_REQUESTS_COLLECTION, requestId, {
    status: 'cancelado',
    updated_at: now,
  });
}

export async function deleteSupportRequestByMigrant(requestId: string): Promise<void> {
  await deleteDocument(SUPPORT_REQUESTS_COLLECTION, requestId);
}

export async function migrateLegacySupportRequestsFromLocalStorage(migrantId: string): Promise<number> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(`urgentRequests:${migrantId}`);
  } catch {
    return 0;
  }
  if (!raw) return 0;

  let parsed: LegacyLocalSupportRequest[] = [];
  try {
    parsed = JSON.parse(raw) as LegacyLocalSupportRequest[];
  } catch {
    localStorage.removeItem(`urgentRequests:${migrantId}`);
    return 0;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    localStorage.removeItem(`urgentRequests:${migrantId}`);
    return 0;
  }

  const existing = await querySupportRequestsForMigrant(migrantId);
  if (existing.length > 0) {
    localStorage.removeItem(`urgentRequests:${migrantId}`);
    return 0;
  }

  let migrated = 0;
  for (const item of parsed) {
    if (!item?.description?.trim() || !isSupportRequestType(item.type)) continue;
    await addDocument(SUPPORT_REQUESTS_COLLECTION, {
      migrant_id: migrantId,
      migrant_name: null,
      type: item.type,
      description: item.description.trim(),
      status: isPendingSupportRequestStatus(item.status) ? 'submetido' : 'resolvido',
      created_at: item.date || new Date().toISOString(),
      updated_at: item.date || new Date().toISOString(),
    });
    migrated += 1;
  }

  localStorage.removeItem(`urgentRequests:${migrantId}`);
  return migrated;
}
