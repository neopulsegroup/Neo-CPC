import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import EventLogPage from './EventLogPage';

const mockQueryDocuments = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'admin-1', email: 'admin@teste.com' },
    profile: { role: 'admin', name: 'Admin', email: 'admin@teste.com' },
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pt',
    setLanguage: vi.fn(),
    t: {
      get: (key: string) => {
        const map: Record<string, string> = {
          'cpc.pages.eventLog.title': 'Logs de Auditoria',
          'cpc.pages.eventLog.loadError': 'Não foi possível carregar os logs de auditoria.',
          'cpc.pages.eventLog.empty': 'Sem registos de auditoria.',
          'cpc.pages.eventLog.actions.user.blocked': 'Utilizador bloqueado',
          'cpc.pages.eventLog.actionKinds.update': 'Atualização',
        };
        return map[key] ?? key;
      },
    },
  }),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

describe('EventLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocument.mockResolvedValue({
      name: 'Admin',
      email: 'admin@teste.com',
      role: 'admin',
    });
  });

  it('carrega logs de auditoria sem erro quando createdAt é Timestamp-like', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
      {
        id: 'log-1',
        action: 'user.blocked',
        actor_id: 'admin-1',
        context: 'cpc.users',
        createdAt: {
          toDate: () => new Date('2026-06-10T12:00:00.000Z'),
        },
      },
    ]);

    render(
      <MemoryRouter>
        <EventLogPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Não foi possível carregar os logs de auditoria.')).not.toBeInTheDocument();
    });

    expect(mockQueryDocuments).toHaveBeenCalledWith('audit_logs', [], undefined, 400);
    expect(screen.queryByText('Sem registos de auditoria.')).not.toBeInTheDocument();
  });
});
