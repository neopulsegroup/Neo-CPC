import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import TrailEditorPage from './TrailEditorPage';

const mockGetDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockUpdateDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockQueryPendingTrailComments = vi.fn();
const mockQueryApprovedTrailComments = vi.fn();
const mockQueryTrailModules = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u-admin' }, profile: { role: 'admin', name: 'Admin' } }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pt',
    t: { get: (k: string) => k },
  }),
}));

vi.mock('@/hooks/useAppDateTime', () => ({
  useAppDateTime: () => ({
    formatDate: (v: string) => v,
    formatDateTime: (v: string) => v,
  }),
}));

vi.mock('@/integrations/firebase/client', () => ({
  storage: {},
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
  addDocument: vi.fn(),
}));

vi.mock('@/lib/trailModules', () => ({
  queryTrailModules: (...args: unknown[]) => mockQueryTrailModules(...args),
}));

vi.mock('@/lib/moduleComments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/moduleComments')>('@/lib/moduleComments');
  return {
    ...actual,
    queryPendingTrailComments: (...args: unknown[]) => mockQueryPendingTrailComments(...args),
    queryApprovedTrailComments: (...args: unknown[]) => mockQueryApprovedTrailComments(...args),
  };
});

describe('TrailEditorPage - comentários publicados', () => {
  beforeEach(() => {
    mockGetDocument.mockReset().mockResolvedValue({
      id: 't1',
      title: 'Trilha Teste',
      description: 'Desc',
      category: 'work',
      difficulty: 'beginner',
      duration_minutes: 10,
      modules_count: 1,
      is_active: true,
    });
    mockQueryTrailModules.mockReset().mockResolvedValue([
      { id: 'm1', title: 'Módulo 1', content_type: 'text', content_text: 'x', order_index: 1, duration_minutes: 5 },
    ]);
    mockQueryPendingTrailComments.mockReset().mockResolvedValue([]);
    mockQueryApprovedTrailComments.mockReset().mockResolvedValue([
      {
        id: 'c1',
        trail_id: 't1',
        module_id: 'm1',
        user_id: 'u1',
        user_name: 'Ana Migrante',
        content: 'Comentário já aprovado',
        status: 'approved',
        created_at: '2026-01-02T10:00:00.000Z',
      },
    ]);
    mockDeleteDocument.mockReset().mockResolvedValue(undefined);
    mockUpdateDocument.mockReset().mockResolvedValue(undefined);
    mockQueryDocuments.mockReset().mockResolvedValue([]);
  });

  it('lista comentários publicados e elimina após confirmação', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/trilhas/t1/editar']}>
        <Routes>
          <Route path="/dashboard/cpc/trilhas/:trailId/editar" element={<TrailEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Editar Trilha')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Comentários/ })).toBeInTheDocument();
    expect(screen.getByText('Comentário já aprovado')).toBeInTheDocument();
    expect(screen.getByText('Ana Migrante')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar comentário de Ana Migrante' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/Tem a certeza de que deseja eliminar o comentário publicado/)).toBeInTheDocument();

    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledWith('trail_module_comments', 'c1');
    });
    expect(screen.queryByText('Comentário já aprovado')).toBeNull();
  });
});
