import { APP_TIME_ZONE, getCalendarDateIsoInTimeZone } from '@/lib/appCalendar';
import { normalizeCpcTeamRole } from '@/lib/cpcRoles';

export function parseSessionScheduledTime(value?: string | null): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})/.exec((value ?? '').trim());
  if (!match) return { hour: 0, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, Number(match[1]))),
    minute: Math.min(59, Math.max(0, Number(match[2]))),
  };
}

function appTimeHourMinute(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { hour: hour === 24 ? 0 : hour, minute };
}

/** Verdadeiro enquanto o instante agendado (Lisboa) ainda não foi ultrapassado. */
export function isSessionScheduledNotYetPassed(
  scheduledDateIso: string,
  scheduledTime?: string | null,
  now: Date = new Date()
): boolean {
  if (!scheduledDateIso) return false;
  const todayIso = getCalendarDateIsoInTimeZone(now);
  if (scheduledDateIso < todayIso) return false;
  if (scheduledDateIso > todayIso) return true;
  const { hour, minute } = parseSessionScheduledTime(scheduledTime);
  const { hour: nowHour, minute: nowMinute } = appTimeHourMinute(now);
  return hour * 60 + minute >= nowHour * 60 + nowMinute;
}

export const SESSION_STATUS_PENDING_APPROVAL = 'pending_approval';
export const SESSION_STATUS_SCHEDULED = 'Agendada';
export const SESSION_STATUS_REJECTED = 'rejected';
export const SESSION_STATUS_COMPLETED = 'Concluída';
export const SESSION_STATUS_RESCHEDULED = 'Reagendada';
export const SESSION_STATUS_NO_SHOW = 'Não compareceu';

export const PAST_SESSION_CLOSURE_STATUSES = [
  SESSION_STATUS_COMPLETED,
  SESSION_STATUS_RESCHEDULED,
  SESSION_STATUS_NO_SHOW,
] as const;

export type PastSessionClosureStatus = (typeof PAST_SESSION_CLOSURE_STATUSES)[number];

export function isSessionPendingApproval(status: string | null | undefined): boolean {
  const normalized = (status ?? '').toLowerCase().trim();
  if (!normalized) return false;
  if (normalized === SESSION_STATUS_PENDING_APPROVAL) return true;
  if (normalized.includes('pending') && normalized.includes('approval')) return true;
  if (normalized.includes('pend') && (normalized.includes('aprov') || normalized.includes('approval'))) return true;
  return normalized === 'em aprovação' || normalized === 'em aprovacao';
}

export function isSessionCancelledStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').toLowerCase().trim();
  if (!normalized) return false;
  return normalized.includes('cancel') || normalized === 'canceled' || normalized === 'cancelled';
}

export function isSessionRejectedStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').toLowerCase().trim();
  if (!normalized) return false;
  return normalized === SESSION_STATUS_REJECTED || normalized.includes('recus') || normalized.includes('reject');
}

export function isSessionCompletedStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').toLowerCase().trim();
  if (!normalized) return false;
  return normalized.includes('compl') || normalized.includes('concl') || normalized.includes('done');
}

export function isSessionRescheduledStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').toLowerCase().trim();
  if (!normalized) return false;
  return normalized.includes('reagend') || normalized.includes('reschedul');
}

export function isSessionNoShowStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').toLowerCase().trim();
  if (!normalized) return false;
  return (
    normalized.includes('compareceu') ||
    normalized.includes('no_show') ||
    normalized.includes('noshow') ||
    normalized.includes('faltou') ||
    normalized.includes('missed')
  );
}

/** Sessão com data/hora de marcação já ultrapassada (Lisboa). */
export function isSessionScheduledInPast(
  scheduledDateIso: string,
  scheduledTime?: string | null,
  now: Date = new Date()
): boolean {
  if (!scheduledDateIso) return false;
  return !isSessionScheduledNotYetPassed(scheduledDateIso, scheduledTime, now);
}

export function shouldShowSessionOnAgenda(status: string | null | undefined): boolean {
  if (isSessionPendingApproval(status)) return false;
  if (isSessionCancelledStatus(status)) return false;
  if (isSessionRejectedStatus(status)) return false;
  return true;
}

/** Sessões visíveis no card Agendamentos / Minhas próximas sessões. */
export function isMigrantUpcomingSession(
  status: string | null | undefined,
  scheduledDateIso: string,
  todayIso: string,
  scheduledTime?: string | null,
  now: Date = new Date()
): boolean {
  if (!scheduledDateIso) return false;
  if (isSessionCancelledStatus(status)) return false;
  if (isSessionRejectedStatus(status)) return false;
  if (isSessionCompletedStatus(status)) return false;
  if (scheduledTime != null && String(scheduledTime).trim()) {
    return isSessionScheduledNotYetPassed(scheduledDateIso, scheduledTime, now);
  }
  if (scheduledDateIso < todayIso) return false;
  return true;
}

export function isMigrantHistorySession(
  status: string | null | undefined,
  scheduledDateIso: string,
  todayIso: string,
  scheduledTime?: string | null,
  now: Date = new Date()
): boolean {
  return !isMigrantUpcomingSession(status, scheduledDateIso, todayIso, scheduledTime, now);
}

/** Super Admin, Admin (manager) ou Consultor (consultant). */
export function canApproveSessionRequests(role: string | null | undefined): boolean {
  const normalized = normalizeCpcTeamRole(role);
  return normalized === 'admin' || normalized === 'manager' || normalized === 'consultant';
}
