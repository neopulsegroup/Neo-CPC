import { describe, expect, it } from 'vitest';

import {
  canManagePastSessionClosure,
  filterCpcSessions,
  isSupportRequestOnlySessionRow,
  isSupportUrgentSession,
  mergeApprovedSupportRequestsIntoSessions,
  mergeCancelledSupportRequestsIntoSessions,
  dedupeSessionsByAppointment,
  resolveCpcSessionTableStatus,
  resolveSessionCategory,
  sortCpcSessionsNewestFirst,
  supportRequestToCpcSessionDoc,
  type CpcSessionDoc,
} from './cpcSessions';
import type { SupportRequestDoc } from './supportRequests';

describe('cpcSessions', () => {
  const migrantNames = new Map<string, string>([['m1', 'Ana Silva']]);

  const baseSession: CpcSessionDoc = {
    id: 's1',
    migrant_id: 'm1',
    session_type: 'jurista',
    service_id: 'legal',
    scheduled_date: '2026-06-18',
    scheduled_time: '10:00',
    status: 'Agendada',
    specialist_id: 'lawyer-1',
    specialist_name: 'Dra. Maria',
  };

  it('resolve categorias de sessão', () => {
    expect(resolveSessionCategory('jurista', 'legal')).toBe('legal');
    expect(resolveSessionCategory('psicologa', 'psychology')).toBe('psychology');
    expect(resolveSessionCategory('coletiva', null)).toBe('collective');
  });

  it('filtra por nome do migrante e utilizador CPC', () => {
    const rows = filterCpcSessions({
      sessions: [baseSession],
      migrantNames,
      filters: {
        migrantName: 'ana',
        sessionType: 'all',
        date: '',
        period: 'all',
        cpcUserId: 'lawyer-1',
        urgency: 'all',
        status: 'all',
      },
    });
    expect(rows).toHaveLength(1);

    const empty = filterCpcSessions({
      sessions: [baseSession],
      migrantNames,
      filters: {
        migrantName: 'joão',
        sessionType: 'all',
        date: '',
        period: 'all',
        cpcUserId: 'all',
        urgency: 'all',
        status: 'all',
      },
    });
    expect(empty).toHaveLength(0);
  });

  it('filtra pedidos em aprovação como urgência', () => {
    const pending: CpcSessionDoc = { ...baseSession, id: 's2', status: 'pending_approval' };
    const rows = filterCpcSessions({
      sessions: [baseSession, pending],
      migrantNames,
      filters: {
        migrantName: '',
        sessionType: 'all',
        date: '',
        period: 'all',
        cpcUserId: 'all',
        urgency: 'pending',
        status: 'all',
      },
    });
    expect(rows.map((row) => row.id)).toEqual(['s2']);
  });

  it('filtra sessões de apoio urgente', () => {
    const urgent: CpcSessionDoc = { ...baseSession, id: 's3', support_request_id: 'sr1' };
    const rows = filterCpcSessions({
      sessions: [baseSession, urgent],
      migrantNames,
      filters: {
        migrantName: '',
        sessionType: 'all',
        date: '',
        period: 'all',
        cpcUserId: 'all',
        urgency: 'support_urgent',
        status: 'all',
      },
    });
    expect(rows.map((row) => row.id)).toEqual(['s3']);
  });

  it('filtra por estado da sessão', () => {
    const completed: CpcSessionDoc = { ...baseSession, id: 's-done', status: 'Concluída' };
    const cancelled: CpcSessionDoc = { ...baseSession, id: 's-cancel', status: 'Cancelada' };
    const rows = filterCpcSessions({
      sessions: [baseSession, completed, cancelled],
      migrantNames,
      filters: {
        migrantName: '',
        sessionType: 'all',
        date: '',
        period: 'all',
        cpcUserId: 'all',
        urgency: 'all',
        status: 'Cancelada',
      },
    });
    expect(rows.map((row) => row.id)).toEqual(['s-cancel']);
  });

  it('resolve estado da tabela CPC', () => {
    expect(resolveCpcSessionTableStatus('Agendada')).toBe('Agendada');
    expect(resolveCpcSessionTableStatus('Concluída')).toBe('Concluída');
    expect(resolveCpcSessionTableStatus('Não compareceu')).toBe('Não compareceu');
    expect(resolveCpcSessionTableStatus('Cancelada')).toBe('Cancelada');
    expect(resolveCpcSessionTableStatus('cancelled')).toBe('Cancelada');
  });

  it('inclui pedidos urgentes cancelados sem documento de sessão', () => {
    const cancelledRequest: SupportRequestDoc = {
      id: 'sr-cancel',
      migrant_id: 'm1',
      type: 'juridico',
      description: 'Pedido cancelado',
      status: 'cancelado',
      created_at: '2026-06-12T10:00:00.000Z',
    };

    const merged = mergeCancelledSupportRequestsIntoSessions([], [cancelledRequest]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe('Cancelada');
    expect(merged[0]?.support_request_id).toBe('sr-cancel');
  });

  it('marca sessão existente como cancelada quando o pedido urgente é recusado', () => {
    const sessions: CpcSessionDoc[] = [
      {
        ...baseSession,
        id: 's2',
        support_request_id: 'sr1',
      },
    ];
    const cancelledRequest: SupportRequestDoc = {
      id: 'sr1',
      migrant_id: 'm1',
      type: 'juridico',
      description: 'Pedido',
      status: 'cancelado',
      created_at: '2026-06-01T10:00:00.000Z',
      session_id: 's2',
    };

    const merged = mergeCancelledSupportRequestsIntoSessions(sessions, [cancelledRequest]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe('Cancelada');
  });

  it('identifica sessões de apoio urgente', () => {
    expect(isSupportUrgentSession({ support_request_id: 'sr1' })).toBe(true);
    expect(isSupportUrgentSession({ support_request_id: '' })).toBe(false);
    expect(isSupportUrgentSession({ support_request_id: null })).toBe(false);
  });

  it('inclui pedidos urgentes aprovados sem documento de sessão', () => {
    const approvedRequest: SupportRequestDoc = {
      id: 'sr1',
      migrant_id: 'm1',
      migrant_name: 'Ana Silva',
      type: 'juridico',
      description: '123123123123123',
      status: 'aprovado',
      created_at: '2026-06-01T10:00:00.000Z',
      scheduled_date: '2026-06-22',
      scheduled_time: '10:00',
      specialist_id: 'sp1',
      specialist_name: 'Group NeoPulse',
    };

    const merged = mergeApprovedSupportRequestsIntoSessions([], [approvedRequest]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('sr1');
    expect(merged[0]?.support_request_id).toBe('sr1');
    expect(isSupportRequestOnlySessionRow(merged[0]!)).toBe(true);
    expect(supportRequestToCpcSessionDoc(approvedRequest)?.service_id).toBe('legal');
  });

  it('remove sessões duplicadas com a mesma marcação', () => {
    const duplicateSessions: CpcSessionDoc[] = [
      {
        ...baseSession,
        id: 's-old',
        scheduled_date: '2026-06-22',
        scheduled_time: '10:00',
        specialist_name: 'Group NeoPulse',
      },
      {
        ...baseSession,
        id: 's-new',
        scheduled_date: '2026-06-22',
        scheduled_time: '10:00',
        specialist_name: 'Group NeoPulse',
        support_request_id: 'sr1',
      },
    ];

    const deduped = dedupeSessionsByAppointment(duplicateSessions);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe('s-new');
  });

  it('não duplica pedidos urgentes já ligados a sessões', () => {
    const approvedRequest: SupportRequestDoc = {
      id: 'sr1',
      migrant_id: 'm1',
      type: 'juridico',
      description: 'Pedido',
      status: 'aprovado',
      created_at: '2026-06-01T10:00:00.000Z',
      scheduled_date: '2026-06-22',
      scheduled_time: '10:00',
      session_id: 's2',
    };
    const sessions: CpcSessionDoc[] = [
      {
        ...baseSession,
        id: 's2',
        support_request_id: 'sr1',
      },
    ];

    expect(mergeApprovedSupportRequestsIntoSessions(sessions, [approvedRequest])).toHaveLength(1);
  });

  it('permite encerramento apenas a admin e responsáveis do tipo', () => {
    expect(canManagePastSessionClosure('admin', 'legal')).toBe(true);
    expect(canManagePastSessionClosure('manager', 'psychology')).toBe(true);
    expect(canManagePastSessionClosure('lawyer', 'legal')).toBe(true);
    expect(canManagePastSessionClosure('lawyer', 'psychology')).toBe(false);
    expect(canManagePastSessionClosure('psychologist', 'mediation')).toBe(false);
    expect(canManagePastSessionClosure('mediator', 'mediation')).toBe(true);
  });
});
