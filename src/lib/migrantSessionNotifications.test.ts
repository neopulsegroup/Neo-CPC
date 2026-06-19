import { describe, expect, it, vi } from 'vitest';

import { notifyMigrantSessionScheduled, sessionScheduledNotificationId, isSessionScheduledNotificationVisible } from './migrantSessionNotifications';

const mockSetDocument = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  setDocument: (...args: unknown[]) => mockSetDocument(...args),
  serverTimestamp: () => ({ __type: 'serverTimestamp' }),
}));

describe('migrantSessionNotifications', () => {
  it('usa id determinístico por sessão', () => {
    expect(sessionScheduledNotificationId('abc123')).toBe('session_notify_abc123');
  });

  it('cria notificação in-app para o migrante', async () => {
    mockSetDocument.mockResolvedValueOnce(undefined);

    await notifyMigrantSessionScheduled({
      migrantId: 'm1',
      sessionId: 's1',
      serviceLabel: 'Aconselhamento jurídico',
      scheduledDateIso: '2026-07-15',
      scheduledTime: '10:00',
      specialistName: 'Dra. Ana',
      createdBy: 'cpc-user',
    });

    expect(mockSetDocument).toHaveBeenCalledWith(
      'notifications',
      'session_notify_s1',
      expect.objectContaining({
        recipient_id: 'm1',
        title: 'Sessão marcada: Aconselhamento jurídico',
        body: expect.stringContaining('Dra. Ana'),
        type: 'session_scheduled',
        href: '/dashboard/migrante/sessoes',
        created_by: 'cpc-user',
      })
    );
  });

  it('oculta notificação quando a sessão já passou', () => {
    const beforeSession = new Date('2026-06-17T13:30:00.000Z'); // 14:30 em Lisboa
    const afterSession = new Date('2026-06-17T14:30:00.000Z'); // 15:30 em Lisboa
    expect(
      isSessionScheduledNotificationVisible(
        { id: 'session_notify_s1', type: 'session_scheduled' },
        [{ id: 's1', status: 'Agendada', scheduled_date: '2026-06-17', scheduled_time: '15:00' }],
        beforeSession
      )
    ).toBe(true);
    expect(
      isSessionScheduledNotificationVisible(
        { id: 'session_notify_s1', type: 'session_scheduled' },
        [{ id: 's1', status: 'Agendada', scheduled_date: '2026-06-17', scheduled_time: '15:00' }],
        afterSession
      )
    ).toBe(false);
    expect(isSessionScheduledNotificationVisible({ id: 'other', type: 'info' }, [], beforeSession)).toBe(true);
  });
});
