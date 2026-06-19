import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import TrailsPage from './TrailsPage';

const mockQueryDocuments = vi.fn();
const stableUser = { uid: 'u-m1' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: stableUser, profile: { name: 'Ana' } }),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
}));

describe('TrailsPage (migrante)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryDocuments.mockImplementation(async (collection: string) => {
      if (collection === 'trails') {
        return [
          {
            id: 't1',
            title: 'Trilha Ativa',
            description: 'Desc',
            category: 'work',
            difficulty: 'beginner',
            duration_minutes: 10,
            modules_count: 2,
            is_active: true,
            created_at: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 't2',
            title: 'Trilha Inativa',
            description: 'Desc',
            category: 'health',
            difficulty: 'beginner',
            duration_minutes: 5,
            modules_count: 1,
            is_active: false,
            created_at: '2025-01-02T00:00:00.000Z',
          },
        ];
      }
      if (collection === 'user_trail_progress') return [];
      return [];
    });
  });

  it('mostra apenas trilhas ativas', async () => {
    render(
      <MemoryRouter>
        <TrailsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Trilha Ativa')).toBeInTheDocument();
    expect(screen.queryByText('Trilha Inativa')).toBeNull();
  });

  it('continua a mostrar trilhas se falhar o progresso', async () => {
    mockQueryDocuments.mockImplementation(async (collection: string) => {
      if (collection === 'trails') {
        return [
          {
            id: 't1',
            title: 'Trilha Ativa',
            description: 'Desc',
            category: 'work',
            difficulty: 'beginner',
            duration_minutes: 10,
            modules_count: 2,
            is_active: true,
            created_at: '2025-01-01T00:00:00.000Z',
          },
        ];
      }
      if (collection === 'user_trail_progress') throw new Error('progress failed');
      return [];
    });

    render(
      <MemoryRouter>
        <TrailsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Trilha Ativa')).toBeInTheDocument();
    expect(screen.queryByText('Ocorreu um problema')).toBeNull();
  });

  it('mostra erro quando falha a carga de trilhas', async () => {
    mockQueryDocuments.mockImplementation(async (collection: string) => {
      if (collection === 'trails') throw new Error('trails failed');
      return [];
    });

    render(
      <MemoryRouter>
        <TrailsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Ocorreu um problema')).toBeInTheDocument();

    mockQueryDocuments.mockImplementation(async (collection: string) => {
      if (collection === 'trails') {
        return [
          {
            id: 't1',
            title: 'Trilha Ativa',
            description: 'Desc',
            category: 'work',
            difficulty: 'beginner',
            duration_minutes: 10,
            modules_count: 2,
            is_active: true,
            created_at: '2025-01-01T00:00:00.000Z',
          },
        ];
      }
      if (collection === 'user_trail_progress') return [];
      return [];
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => {
      expect(screen.getByText('Trilha Ativa')).toBeInTheDocument();
    });
  });
});
