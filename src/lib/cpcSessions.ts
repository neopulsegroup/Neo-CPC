import {
  addCalendarDaysIso,
  getCalendarDateIsoInTimeZone,
  monthStartEndIsoInAppTimeZone,
  todayIsoAppCalendar,
  weekStartEndIsoMondayInAppCalendar,
} from '@/lib/appCalendar';
import { CATEGORY_SERVICE_ID, CATEGORY_SESSION_TYPE, type AgendaCategory } from '@/lib/cpcSpecialists';
import { CPC_TEAM_ROLES, normalizeCpcTeamRole, type CpcTeamRole } from '@/lib/cpcRoles';
import {
  isApprovedSupportRequestStatus,
  isRejectedSupportRequestStatus,
  isSupportRequestType,
  resolveSupportRequestDisplayDateIso,
  supportRequestTypeToAgendaCategory,
  type SupportRequestDoc,
} from '@/lib/supportRequests';
import {
  isSessionCancelledStatus,
  isSessionPendingApproval,
  isSessionScheduledInPast,
  isSessionScheduledNotYetPassed,
} from '@/lib/sessionApproval';

export type CpcSessionDoc = {
  id: string;
  migrant_id?: string | null;
  session_type?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  status?: string | null;
  service_id?: string | null;
  service_label?: string | null;
  specialist_id?: string | null;
  specialist_name?: string | null;
  professional_id?: string | null;
  consultant_uid?: string | null;
  created_by?: string | null;
  requested_by?: string | null;
  created_at?: string | null;
  support_request_id?: string | null;
};

export type CpcSessionsPeriodFilter = 'all' | 'upcoming' | 'past' | 'today' | 'week' | 'month';
export type CpcSessionsUrgencyFilter = 'all' | 'pending' | 'support_urgent' | 'normal';
export type CpcSessionsStatusFilter = 'all' | CpcSessionTableStatus;

export const CPC_SESSION_CANCELLED_STATUS = 'Cancelada';
export const CPC_SESSION_TABLE_STATUSES = [
  'Agendada',
  'Concluída',
  'Não compareceu',
  CPC_SESSION_CANCELLED_STATUS,
] as const;
export type CpcSessionTableStatus = (typeof CPC_SESSION_TABLE_STATUSES)[number];

export type CpcSessionsFilters = {
  migrantName: string;
  sessionType: 'all' | AgendaCategory;
  date: string;
  period: CpcSessionsPeriodFilter;
  cpcUserId: 'all' | string;
  urgency: CpcSessionsUrgencyFilter;
  status: CpcSessionsStatusFilter;
};

export function resolveSessionCategory(
  sessionType?: string | null,
  serviceId?: string | null
): AgendaCategory {
  const type = (sessionType ?? '').toLowerCase();
  const service = (serviceId ?? '').toLowerCase();
  if (service === 'legal' || type === 'jurista' || type === 'lawyer') return 'legal';
  if (service === 'psychology' || type === 'psicologa' || type === 'psychologist') return 'psychology';
  if (service === 'mediation' || type === 'mediador' || type === 'mediator') return 'mediation';
  return 'collective';
}

export function sessionCpcUserIds(session: CpcSessionDoc): string[] {
  return [session.specialist_id, session.professional_id, session.consultant_uid, session.created_by]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
}

export function canManagePastSessionClosure(
  role: string | null | undefined,
  category: AgendaCategory
): boolean {
  const normalized = normalizeCpcTeamRole(role);
  if (!normalized) return false;
  if (normalized === 'admin' || normalized === 'manager') return true;
  if (category === 'legal' && normalized === 'lawyer') return true;
  if (category === 'psychology' && normalized === 'psychologist') return true;
  if (category === 'mediation' && normalized === 'mediator') return true;
  return false;
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesPeriod(
  scheduledDateIso: string,
  scheduledTime: string | null | undefined,
  period: CpcSessionsPeriodFilter,
  now: Date
): boolean {
  if (period === 'all') return true;
  const todayIso = todayIsoAppCalendar();
  if (period === 'today') return scheduledDateIso === todayIso;
  if (period === 'upcoming') {
    return isSessionScheduledNotYetPassed(scheduledDateIso, scheduledTime, now);
  }
  if (period === 'past') {
    return isSessionScheduledInPast(scheduledDateIso, scheduledTime, now);
  }
  if (period === 'week') {
    const { weekStart, weekEnd } = weekStartEndIsoMondayInAppCalendar(todayIso);
    return scheduledDateIso >= weekStart && scheduledDateIso <= weekEnd;
  }
  if (period === 'month') {
    const { monthStart, monthEnd } = monthStartEndIsoInAppTimeZone(now);
    return scheduledDateIso >= monthStart && scheduledDateIso <= monthEnd;
  }
  return true;
}

export function filterCpcSessions(args: {
  sessions: CpcSessionDoc[];
  migrantNames: Map<string, string>;
  filters: CpcSessionsFilters;
  now?: Date;
}): CpcSessionDoc[] {
  const { sessions, migrantNames, filters } = args;
  const now = args.now ?? new Date();
  const migrantQuery = normalizeSearch(filters.migrantName);

  return sessions.filter((session) => {
    const scheduledDate = (session.scheduled_date ?? '').trim();
    const scheduledTime = (session.scheduled_time ?? '').trim();
    if (!scheduledDate) return false;

    if (filters.date && scheduledDate !== filters.date) return false;

    if (!matchesPeriod(scheduledDate, scheduledTime, filters.period, now)) return false;

    if (filters.sessionType !== 'all') {
      const category = resolveSessionCategory(session.session_type, session.service_id);
      if (category !== filters.sessionType) return false;
    }

    if (filters.cpcUserId !== 'all') {
      const ids = sessionCpcUserIds(session);
      if (!ids.includes(filters.cpcUserId)) return false;
    }

    if (filters.urgency === 'pending' && !isSessionPendingApproval(session.status)) return false;
    if (filters.urgency === 'support_urgent' && !isSupportUrgentSession(session)) return false;
    if (
      filters.urgency === 'normal' &&
      (isSessionPendingApproval(session.status) || isSupportUrgentSession(session))
    ) {
      return false;
    }

    if (filters.status !== 'all') {
      const tableStatus = resolveCpcSessionTableStatus(session.status);
      if (tableStatus !== filters.status) return false;
    }

    if (migrantQuery) {
      const migrantId = session.migrant_id ?? '';
      const migrantName = normalizeSearch(migrantNames.get(migrantId) ?? '');
      if (!migrantName.includes(migrantQuery)) return false;
    }

    return true;
  });
}

export function sortCpcSessionsNewestFirst(sessions: CpcSessionDoc[]): CpcSessionDoc[] {
  return [...sessions].sort((a, b) => {
    const byDate = (b.scheduled_date ?? '').localeCompare(a.scheduled_date ?? '');
    if (byDate !== 0) return byDate;
    return (b.scheduled_time ?? '').localeCompare(a.scheduled_time ?? '');
  });
}

export function isCpcTeamRole(value: string | null | undefined): value is CpcTeamRole {
  const normalized = normalizeCpcTeamRole(value);
  return normalized != null && (CPC_TEAM_ROLES as readonly string[]).includes(normalized);
}

export function isSupportUrgentSession(session: Pick<CpcSessionDoc, 'support_request_id'>): boolean {
  return typeof session.support_request_id === 'string' && session.support_request_id.trim().length > 0;
}

export function supportRequestToCancelledCpcSessionDoc(request: SupportRequestDoc): CpcSessionDoc | null {
  if (!isRejectedSupportRequestStatus(request.status) || !isSupportRequestType(request.type)) return null;

  const category = supportRequestTypeToAgendaCategory(request.type);
  const sessionId = request.session_id?.trim();

  return {
    id: sessionId || request.id,
    migrant_id: request.migrant_id,
    session_type: CATEGORY_SESSION_TYPE[category],
    service_id: CATEGORY_SERVICE_ID[category],
    scheduled_date: resolveSupportRequestDisplayDateIso(request),
    scheduled_time: request.scheduled_time?.trim() || '—',
    status: CPC_SESSION_CANCELLED_STATUS,
    specialist_id: request.specialist_id ?? null,
    specialist_name: request.specialist_name ?? null,
    professional_id: request.specialist_id ?? null,
    consultant_uid: request.specialist_id ?? null,
    support_request_id: request.id,
    created_at: request.updated_at ?? request.created_at,
  };
}

export function mergeCancelledSupportRequestsIntoSessions(
  sessions: CpcSessionDoc[],
  cancelledRequests: SupportRequestDoc[]
): CpcSessionDoc[] {
  const bySupportRequestId = new Map<string, CpcSessionDoc>();
  const bySessionId = new Map<string, CpcSessionDoc>();

  for (const session of sessions) {
    bySessionId.set(session.id, session);
    const supportRequestId = session.support_request_id?.trim();
    if (supportRequestId) bySupportRequestId.set(supportRequestId, session);
  }

  const merged = [...sessions];

  for (const request of cancelledRequests) {
    const existing = bySupportRequestId.get(request.id);
    if (existing) {
      if (!isSessionCancelledStatus(existing.status)) {
        const index = merged.findIndex((row) => row.id === existing.id);
        if (index >= 0) {
          merged[index] = { ...merged[index], status: CPC_SESSION_CANCELLED_STATUS };
          bySessionId.set(existing.id, merged[index]);
          bySupportRequestId.set(request.id, merged[index]);
        }
      }
      continue;
    }

    const sessionId = request.session_id?.trim();
    if (sessionId && bySessionId.has(sessionId)) {
      const index = merged.findIndex((row) => row.id === sessionId);
      if (index >= 0) {
        merged[index] = { ...merged[index], status: CPC_SESSION_CANCELLED_STATUS, support_request_id: request.id };
        bySupportRequestId.set(request.id, merged[index]);
      }
      continue;
    }

    const synthetic = supportRequestToCancelledCpcSessionDoc(request);
    if (!synthetic) continue;

    merged.push(synthetic);
    bySessionId.set(synthetic.id, synthetic);
    bySupportRequestId.set(request.id, synthetic);
  }

  return merged;
}

export function supportRequestToCpcSessionDoc(request: SupportRequestDoc): CpcSessionDoc | null {
  if (!isApprovedSupportRequestStatus(request.status)) return null;

  const scheduledDate = request.scheduled_date?.trim();
  if (!scheduledDate) return null;

  const category = supportRequestTypeToAgendaCategory(request.type);
  const sessionId = request.session_id?.trim();

  return {
    id: sessionId || request.id,
    migrant_id: request.migrant_id,
    session_type: CATEGORY_SESSION_TYPE[category],
    service_id: CATEGORY_SERVICE_ID[category],
    scheduled_date: scheduledDate,
    scheduled_time: request.scheduled_time?.trim() || null,
    status: 'Agendada',
    specialist_id: request.specialist_id ?? null,
    specialist_name: request.specialist_name ?? null,
    professional_id: request.specialist_id ?? null,
    consultant_uid: request.specialist_id ?? null,
    support_request_id: request.id,
    created_at: request.approved_at ?? request.created_at,
  };
}

export function mergeApprovedSupportRequestsIntoSessions(
  sessions: CpcSessionDoc[],
  approvedRequests: SupportRequestDoc[]
): CpcSessionDoc[] {
  const bySupportRequestId = new Map<string, CpcSessionDoc>();
  const bySessionId = new Map<string, CpcSessionDoc>();

  for (const session of sessions) {
    bySessionId.set(session.id, session);
    const supportRequestId = session.support_request_id?.trim();
    if (supportRequestId) bySupportRequestId.set(supportRequestId, session);
  }

  const merged = [...sessions];

  for (const request of approvedRequests) {
    if (bySupportRequestId.has(request.id)) continue;

    const sessionId = request.session_id?.trim();
    if (sessionId && bySessionId.has(sessionId)) continue;

    const synthetic = supportRequestToCpcSessionDoc(request);
    if (!synthetic) continue;

    merged.push(synthetic);
    bySessionId.set(synthetic.id, synthetic);
    bySupportRequestId.set(request.id, synthetic);
  }

  return merged;
}

export function pickPreferredDuplicateSession<T extends CpcSessionDoc>(a: T, b: T): T {
  const isCancelled = (status: string | null | undefined) => {
    const normalized = (status ?? '').toLowerCase();
    return normalized.includes('cancel') || normalized === 'rejected' || normalized === 'recusado';
  };

  const aCancelled = isCancelled(a.status);
  const bCancelled = isCancelled(b.status);
  if (aCancelled !== bCancelled) return aCancelled ? a : b;

  const aHasSupport = Boolean(a.support_request_id?.trim());
  const bHasSupport = Boolean(b.support_request_id?.trim());
  if (aHasSupport !== bHasSupport) return aHasSupport ? a : b;

  return a.id.localeCompare(b.id) <= 0 ? a : b;
}

export function sessionAppointmentKey(session: {
  migrant_id?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  specialist_id?: string | null;
  specialist_name?: string | null;
  service_id?: string | null;
  session_type?: string | null;
}): string {
  const migrantId = session.migrant_id?.trim() || '';
  const date = session.scheduled_date?.trim() || '';
  const time = session.scheduled_time?.trim() || '';
  const specialist = session.specialist_id?.trim() || session.specialist_name?.trim() || '';
  const service = session.service_id?.trim() || session.session_type?.trim() || '';
  return `${migrantId}|${date}|${time}|${specialist}|${service}`;
}

export function dedupeSessionsByAppointment<T extends CpcSessionDoc>(sessions: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const session of sessions) {
    const key = sessionAppointmentKey(session);
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickPreferredDuplicateSession(existing, session) : session);
  }
  return Array.from(byKey.values());
}

export function isSupportRequestOnlySessionRow(session: CpcSessionDoc): boolean {
  const supportRequestId = session.support_request_id?.trim();
  return Boolean(supportRequestId && session.id === supportRequestId);
}

export function resolveCpcSessionTableStatus(status: string | null | undefined): CpcSessionTableStatus {
  const normalized = (status ?? '').toLowerCase().trim();
  if (
    normalized.includes('cancel') ||
    normalized === 'rejected' ||
    normalized === 'recusado'
  ) {
    return CPC_SESSION_CANCELLED_STATUS;
  }
  if (normalized.includes('concl') || normalized.includes('compl') || normalized.includes('done')) {
    return 'Concluída';
  }
  if (
    normalized.includes('compareceu') ||
    normalized.includes('no_show') ||
    normalized.includes('noshow') ||
    normalized.includes('faltou') ||
    normalized.includes('missed')
  ) {
    return 'Não compareceu';
  }
  return 'Agendada';
}

/** Útil para testes: data civil + N dias a partir de hoje em Lisboa. */
export function offsetTodayIso(days: number, now = new Date()): string {
  return addCalendarDaysIso(getCalendarDateIsoInTimeZone(now), days);
}
