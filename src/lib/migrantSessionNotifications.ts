import { setDocument, serverTimestamp } from '@/integrations/firebase/firestore';

export function sessionScheduledNotificationId(sessionId: string): string {
  return `session_notify_${sessionId}`;
}

function formatSessionDateTimePt(dateIso: string, time: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso.trim());
  if (!match) return `${dateIso} ${time}`.trim();
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const datePart = date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
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
