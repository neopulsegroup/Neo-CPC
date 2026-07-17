import { describe, expect, it } from 'vitest';
import {
  countPendingAgendaItems,
  countPendingCompanies,
  countPendingOffers,
  formatPendingBadgeLabel,
  pendingCountForMenuPath,
} from './cpcMenuPending';

describe('cpcMenuPending', () => {
  it('soma pedidos de apoio e sessões em aprovação para a Agenda', () => {
    expect(
      countPendingAgendaItems({
        pendingSupportCount: 2,
        sessions: [{ status: 'pending_approval' }, { status: 'Agendada' }, { status: 'pending_approval' }],
      })
    ).toBe(4);
  });

  it('conta apenas empresas pendentes de verificação', () => {
    expect(
      countPendingCompanies([
        { verified: true },
        { rejected: true },
        {},
        { verified: false, rejected: false },
      ])
    ).toBe(2);
  });

  it('conta apenas ofertas em pending_review', () => {
    expect(
      countPendingOffers([
        { status: 'pending_review' },
        { status: 'active' },
        { status: 'pending_review' },
        { status: null },
      ])
    ).toBe(2);
  });

  it('mapeia path do menu para a contagem correta', () => {
    const counts = { agenda: 3, companies: 1, offers: 5 };
    expect(pendingCountForMenuPath('/dashboard/cpc/agenda', counts)).toBe(3);
    expect(pendingCountForMenuPath('/dashboard/cpc/empresas', counts)).toBe(1);
    expect(pendingCountForMenuPath('/dashboard/cpc/ofertas', counts)).toBe(5);
    expect(pendingCountForMenuPath('/dashboard/cpc/migrantes', counts)).toBe(0);
  });

  it('formata badge com limite 99+', () => {
    expect(formatPendingBadgeLabel(0)).toBe('');
    expect(formatPendingBadgeLabel(7)).toBe('7');
    expect(formatPendingBadgeLabel(100)).toBe('99+');
  });
});
