import { normalizeCpcTeamRole } from '@/lib/cpcRoles';

export const SESSION_STATUS_PENDING_APPROVAL = 'pending_approval';
export const SESSION_STATUS_SCHEDULED = 'Agendada';
export const SESSION_STATUS_REJECTED = 'rejected';

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
  todayIso: string
): boolean {
  if (!scheduledDateIso || scheduledDateIso < todayIso) return false;
  if (isSessionCancelledStatus(status)) return false;
  if (isSessionRejectedStatus(status)) return false;
  if (isSessionCompletedStatus(status)) return false;
  return true;
}

export function isMigrantHistorySession(
  status: string | null | undefined,
  scheduledDateIso: string,
  todayIso: string
): boolean {
  return !isMigrantUpcomingSession(status, scheduledDateIso, todayIso);
}

/** Super Admin, Admin (manager) ou Consultor (consultant). */
export function canApproveSessionRequests(role: string | null | undefined): boolean {
  const normalized = normalizeCpcTeamRole(role);
  return normalized === 'admin' || normalized === 'manager' || normalized === 'consultant';
}
