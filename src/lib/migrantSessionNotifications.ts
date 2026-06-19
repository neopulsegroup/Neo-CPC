import { setDocument, serverTimestamp } from '@/integrations/firebase/firestore';

import { formatAppDateLong } from '@/lib/appDateTime';
import { getCalendarDateIsoInTimeZone } from '@/lib/appCalendar';
import { isMigrantUpcomingSession } from '@/lib/sessionApproval';

export function sessionScheduledNotificationId(sessionId: string): string {
  return `session_notify_${sessionId}`;
}

export function extractSessionIdFromScheduledNotificationId(notificationId: string): string | null {
  const prefix = 'session_notify_';
  if (!notificationId.startsWith(prefix)) return null;
  const sessionId = notificationId.slice(prefix.length).trim();
  return sessionId || null;
}

type SessionScheduleRef = {
  id: string;
  status: string | null;
  scheduled_date: string;
  scheduled_time: string;
};

/** Notificações de sessão agendada deixam de aparecer após a data/hora da sessão. */
export function isSessionScheduledNotificationVisible(
  notification: { id: string; type?: string },
  sessions: SessionScheduleRef[],
  now: Date = new Date()
): boolean {
  const sessionId = extractSessionIdFromScheduledNotificationId(notification.id);
  const isSessionNotification = notification.type === 'session_scheduled' || sessionId != null;
  if (!isSessionNotification) return true;
  if (!sessionId) return false;
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return false;
  const todayIso = getCalendarDateIsoInTimeZone(now);
  return isMigrantUpcomingSession(
    session.status,
    session.scheduled_date,
    todayIso,
    session.scheduled_time,
    now
  );
}

function formatSessionDateTimePt(dateIso: string, time: string): string {
  const datePart = formatAppDateLong(dateIso, { day: 'numeric' });
  return `${datePart}, ${time}`;
}

/** Notificação in-app para o migrante quando a equipa CPC agenda uma sessão. */
export async function notifyMigrantSessionScheduled(args: {
  migrantId: string;
  sessionId: string;
  serviceLabel: string;
  scheduledDateIso: string;
  scheduledTime: string;
  specialistName?: string | null;
  createdBy: string;
}): Promise<void> {
  const dateTimeLabel = formatSessionDateTimePt(args.scheduledDateIso, args.scheduledTime);
  const specialist = args.specialistName?.trim() || 'Equipa CPC';

  await setDocument('notifications', sessionScheduledNotificationId(args.sessionId), {
    recipient_id: args.migrantId,
    title: `Sessão marcada: ${args.serviceLabel}`,
    body: `Agendada para ${dateTimeLabel} com ${specialist}.`,
    type: 'session_scheduled',
    href: '/dashboard/migrante/sessoes',
    created_by: args.createdBy,
    created_at: serverTimestamp(),
  });
}
