import { describe, expect, it } from 'vitest';

import {
  canMigrantDeleteSupportRequest,
  isApprovedSupportRequestStatus,
  isPendingSupportRequestStatus,
  isRejectedSupportRequestStatus,
  isSupportRequestType,
  isSupportScheduleDraftComplete,
  mergeRejectedSupportRequestsIntoMigrantHistory,
  shouldShowSupportRequestOnMigrantCard,
  sortSupportRequestsNewestFirst,
  supportRequestSessionLabelKey,
  supportRequestStatusBadgeClass,
  supportRequestStatusLabelKey,
  supportRequestToMigrantHistorySession,
  supportRequestTypeLabelKey,
  supportRequestTypeToAgendaCategory,
  type SupportRequestDoc,
} from './supportRequests';

describe('supportRequests', () => {
  it('valida tipos de pedido', () => {
    expect(isSupportRequestType('juridico')).toBe(true);
    expect(isSupportRequestType('outro')).toBe(false);
  });

  it('identifica pedidos pendentes, aprovados e recusados', () => {
    expect(isPendingSupportRequestStatus('submetido')).toBe(true);
    expect(isApprovedSupportRequestStatus('aprovado')).toBe(true);
    expect(isRejectedSupportRequestStatus('cancelado')).toBe(true);
    expect(shouldShowSupportRequestOnMigrantCard('submetido')).toBe(true);
    expect(shouldShowSupportRequestOnMigrantCard('cancelado')).toBe(false);
    expect(canMigrantDeleteSupportRequest('submetido')).toBe(true);
    expect(canMigrantDeleteSupportRequest('aprovado')).toBe(false);
  });

  it('converte pedidos recusados para histórico de sessões', () => {
    const history = supportRequestToMigrantHistorySession({
      id: 'sr1',
      migrant_id: 'm1',
      type: 'juridico',
      description: 'Pedido recusado',
      status: 'cancelado',
      created_at: '2026-06-10T10:00:00.000Z',
      updated_at: '2026-06-11T12:00:00.000Z',
    });

    expect(history).toMatchObject({
      id: 'support-request:sr1',
      status: 'recusado',
      service_id: 'legal',
      support_request_id: 'sr1',
    });

    const merged = mergeRejectedSupportRequestsIntoMigrantHistory([], [
      {
        id: 'sr1',
        migrant_id: 'm1',
        type: 'juridico',
        description: 'Pedido recusado',
        status: 'cancelado',
        created_at: '2026-06-10T10:00:00.000Z',
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe('recusado');
  });

  it('valida rascunho completo de marcação', () => {
    expect(
      isSupportScheduleDraftComplete({
        dateIso: '2026-06-20',
        timeLabel: '10:00',
        specialistId: 'sp1',
        specialistName: 'Dr. Ana',
      })
    ).toBe(true);
    expect(
      isSupportScheduleDraftComplete({
        dateIso: '2026-06-20',
        timeLabel: '10:00',
        specialistId: '',
        specialistName: 'Dr. Ana',
      })
    ).toBe(false);
  });

  it('mapeia tipos para categorias da agenda', () => {
    expect(supportRequestTypeToAgendaCategory('juridico')).toBe('legal');
    expect(supportRequestTypeToAgendaCategory('psicologico')).toBe('psychology');
    expect(supportRequestTypeToAgendaCategory('habitacional')).toBe('mediation');
    expect(supportRequestTypeToAgendaCategory('necessidades')).toBe('mediation');
  });

  it('expõe chave de sessão por tipo de pedido', () => {
    expect(supportRequestSessionLabelKey('juridico')).toBe('cpc.agenda.sessionTypes.legal');
    expect(supportRequestSessionLabelKey('psicologico')).toBe('cpc.agenda.sessionTypes.psychology');
    expect(supportRequestSessionLabelKey('necessidades')).toBe('cpc.agenda.sessionTypes.mediation');
  });

  it('ordena pedidos do mais recente para o mais antigo', () => {
    const rows: SupportRequestDoc[] = [
      {
        id: '1',
        migrant_id: 'm1',
        type: 'juridico',
        description: 'A',
        status: 'submetido',
        created_at: '2026-01-01T10:00:00.000Z',
      },
      {
        id: '2',
        migrant_id: 'm1',
        type: 'psicologico',
        description: 'B',
        status: 'submetido',
        created_at: '2026-06-01T10:00:00.000Z',
      },
    ];
    expect(sortSupportRequestsNewestFirst(rows).map((row) => row.id)).toEqual(['2', '1']);
  });

  it('expõe chaves i18n e classes de estado', () => {
    expect(supportRequestTypeLabelKey('habitacional')).toBe('dashboard.support_types.habitacional');
    expect(supportRequestStatusLabelKey('submetido')).toBe('dashboard.support_request_status.em_aprovacao');
    expect(supportRequestStatusLabelKey('aprovado')).toBe('dashboard.support_request_status.aprovado');
    expect(supportRequestStatusLabelKey('cancelado')).toBe('dashboard.support_request_status.recusado');
    expect(supportRequestStatusBadgeClass('aprovado')).toContain('emerald');
    expect(supportRequestStatusBadgeClass('submetido')).toContain('amber');
    expect(supportRequestStatusBadgeClass('cancelado')).toContain('rose');
  });
});
