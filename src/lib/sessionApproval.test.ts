import { describe, expect, it } from 'vitest';
import {
  canApproveSessionRequests,
  isMigrantHistorySession,
  isMigrantUpcomingSession,
  isSessionPendingApproval,
  isSessionScheduledNotYetPassed,
  parseSessionScheduledTime,
  shouldShowSessionOnAgenda,
} from './sessionApproval';

describe('sessionApproval', () => {
  it('identifica pedidos pendentes de aprovação', () => {
    expect(isSessionPendingApproval('pending_approval')).toBe(true);
    expect(isSessionPendingApproval('Em aprovação')).toBe(true);
    expect(isSessionPendingApproval('Agendada')).toBe(false);
  });

  it('oculta pedidos pendentes do calendário', () => {
    expect(shouldShowSessionOnAgenda('pending_approval')).toBe(false);
    expect(shouldShowSessionOnAgenda('Agendada')).toBe(true);
    expect(shouldShowSessionOnAgenda('cancelled')).toBe(false);
  });

  it('permite aprovação apenas a consultor, admin e super admin', () => {
    expect(canApproveSessionRequests('consultant')).toBe(true);
    expect(canApproveSessionRequests('manager')).toBe(true);
    expect(canApproveSessionRequests('admin')).toBe(true);
    expect(canApproveSessionRequests('mediator')).toBe(false);
    expect(canApproveSessionRequests('lawyer')).toBe(false);
  });

  it('filtra sessões próximas vs histórico do migrante', () => {
    const today = '2026-06-17';

    expect(isMigrantUpcomingSession('Agendada', '2026-06-20', today)).toBe(true);
    expect(isMigrantUpcomingSession('pending_approval', '2026-06-20', today)).toBe(true);
    expect(isMigrantUpcomingSession('Agendada', '2026-06-10', today)).toBe(false);
    expect(isMigrantUpcomingSession('Cancelada', '2026-06-20', today)).toBe(false);
    expect(isMigrantUpcomingSession('rejected', '2026-06-20', today)).toBe(false);
    expect(isMigrantUpcomingSession('Concluída', '2026-06-20', today)).toBe(false);

    expect(isMigrantHistorySession('Agendada', '2026-06-10', today)).toBe(true);
    expect(isMigrantHistorySession('Cancelada', '2026-06-20', today)).toBe(true);
    expect(isMigrantHistorySession('Agendada', '2026-06-20', today)).toBe(false);
  });

  it('considera hora do agendamento no mesmo dia civil', () => {
    const today = '2026-06-17';
    const beforeSession = new Date('2026-06-17T13:30:00.000Z'); // 14:30 em Lisboa (WEST)
    const afterSession = new Date('2026-06-17T14:30:00.000Z'); // 15:30 em Lisboa

    expect(isSessionScheduledNotYetPassed('2026-06-17', '15:00', beforeSession)).toBe(true);
    expect(isSessionScheduledNotYetPassed('2026-06-17', '15:00', afterSession)).toBe(false);
    expect(isMigrantUpcomingSession('Agendada', '2026-06-17', today, '15:00', beforeSession)).toBe(true);
    expect(isMigrantUpcomingSession('Agendada', '2026-06-17', today, '15:00', afterSession)).toBe(false);
    expect(parseSessionScheduledTime('15:20')).toEqual({ hour: 15, minute: 20 });
  });
});
