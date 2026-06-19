import { describe, expect, it } from 'vitest';

import {
  mapNotificationDoc,
  parseNotificationCreatedAtMs,
  sortDashboardNotificationsNewestFirst,
  type DashboardNotificationDoc,
} from './dashboardNotifications';

describe('dashboardNotifications', () => {
  it('parseia timestamps ISO e Firestore', () => {
    expect(parseNotificationCreatedAtMs('2026-06-18T15:20:00.000Z')).toBeGreaterThan(0);
    expect(parseNotificationCreatedAtMs({ seconds: 1_700_000_000 })).toBe(1_700_000_000_000);
  });

  it('mapeia documento para vista do dashboard', () => {
    const view = mapNotificationDoc({
      id: 'n1',
      title: ' Nova sessão ',
      body: ' Detalhe ',
      type: 'session_scheduled',
      href: '/dashboard/cpc/agenda',
      created_at: '2026-06-18T15:20:00.000Z',
    });
    expect(view.title).toBe('Nova sessão');
    expect(view.body).toBe('Detalhe');
    expect(view.href).toBe('/dashboard/cpc/agenda');
  });

  it('ordena notificações da mais recente para a mais antiga', () => {
    const docs: DashboardNotificationDoc[] = [
      { id: '1', created_at: '2026-01-01T10:00:00.000Z' },
      { id: '2', created_at: '2026-06-01T10:00:00.000Z' },
    ];
    expect(sortDashboardNotificationsNewestFirst(docs).map((row) => row.id)).toEqual(['2', '1']);
  });
});
