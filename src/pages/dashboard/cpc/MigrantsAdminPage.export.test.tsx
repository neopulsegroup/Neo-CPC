import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import MigrantsAdminPage from './MigrantsAdminPage';

const mockQueryDocuments = vi.fn();
const mockGetDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockAddDocument = vi.fn();
const mockServerTimestamp = vi.fn();
const mockToast = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
}));

let mockRole: string = 'admin';
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { role: mockRole, email: 'admin@test.com', name: 'Admin' } }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      get: (path: string, params?: Record<string, string | number>) => {
        const dict: Record<string, string> = {
          'cpc.migrantsAdmin.title': 'Migrantes',
          'cpc.migrantsAdmin.subtitle': 'Lista completa com filtros e acesso ao perfil',
          'cpc.migrantsAdmin.export.button': 'Exportar Lista',
          'cpc.migrantsAdmin.export.formats.csv': 'CSV',
          'cpc.migrantsAdmin.export.formats.xlsx': 'XLSX',
          'cpc.migrantsAdmin.export.columns.name': 'Nome',
          'cpc.migrantsAdmin.export.columns.email': 'Email',
          'cpc.migrantsAdmin.export.columns.birth_date': 'Data de nascimento',
          'cpc.migrantsAdmin.export.columns.nationality': 'Nacionalidade',
          'cpc.migrantsAdmin.export.columns.legal_status': 'Status migratório',
          'cpc.migrantsAdmin.export.columns.arrival_date': 'Data de entrada',
          'cpc.migrantsAdmin.fallback_migrant': 'Migrante',
          'cpc.migrantsAdmin.actions.delete': 'Excluir',
          'cpc.migrantsAdmin.delete.confirm.title': 'Confirmar exclusão',
          'cpc.migrantsAdmin.delete.confirm.description': 'Vai excluir permanentemente o cadastro de {name} e todos os registos associados. Esta ação é irreversível.',
          'cpc.migrantsAdmin.delete.buttons.confirm': 'Confirmar',
          'cpc.migrantsAdmin.delete.buttons.cancel': 'Cancelar',
          'cpc.migrantsAdmin.delete.no_permission.title': 'Sem permissão',
          'cpc.migrantsAdmin.delete.no_permission.description': 'O seu utilizador não tem permissões para excluir migrantes.',
          'cpc.migrantsAdmin.delete.success.title': 'Migrante excluído',
          'cpc.migrantsAdmin.delete.success.description': 'O cadastro de {name} foi excluído com sucesso.',
          'cpc.migrantsAdmin.delete.error.title': 'Erro na exclusão',
          'cpc.migrantsAdmin.delete.error.generic': 'Não foi possível excluir o cadastro do migrante.',
          'cpc.migrantsAdmin.list.sortLabel': 'Ordenar por nome',
          'cpc.migrantsAdmin.list.sortAsc': 'A–Z',
          'cpc.migrantsAdmin.list.sortDesc': 'Z–A',
          'cpc.migrantsAdmin.list.pageSizeLabel': 'Por página',
          'cpc.migrantsAdmin.list.pageSize10': '10',
          'cpc.migrantsAdmin.list.pageSize20': '20',
          'cpc.migrantsAdmin.list.pageSize50': '50',
          'cpc.migrantsAdmin.list.showing': '{from}-{to} de {total}',
          'cpc.migrantsAdmin.list.pageOf': 'Pág {page}/{pages}',
          'cpc.migrantsAdmin.list.prev': 'Anterior',
          'cpc.migrantsAdmin.list.next': 'Seguinte',
          'common.yes': 'Sim',
          'common.no': 'Não',
        };
        const template = dict[path] ?? path;
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
      },
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

function setupFirestoreMocks(users: Array<{ id: string; name: string; email: string }>, profiles: Record<string, unknown> = {}) {
  mockQueryDocuments.mockImplementation(async (collection: string, filters?: Array<{ field: string; operator: string; value: unknown }>) => {
    if (collection === 'users') {
      return users.map((u) => ({ ...u, role: 'migrant' }));
    }
    if (collection === 'sessions') {
      if (Array.isArray(filters) && filters.some((f) => f.field === 'migrant_id')) return [];
      return [];
    }
    if (collection === 'user_trail_progress') {
      if (Array.isArray(filters) && filters.some((f) => f.field === 'user_id')) return [];
      return [];
    }
    if (collection === 'job_applications') {
      if (Array.isArray(filters) && filters.some((f) => f.field === 'applicant_id')) return [];
      return [];
    }
    return [];
  });

  mockGetDocument.mockImplementation(async (collection: string, docId: string) => {
    if (collection === 'profiles') return (profiles[docId] as unknown) ?? { name: null, email: null };
    if (collection === 'triage') return { legal_status: 'regular', answers: {} };
    return null;
  });
}

describe('MigrantsAdminPage - exportação (Email)', () => {
  beforeEach(() => {
    mockQueryDocuments.mockReset();
    mockGetDocument.mockReset();
    mockUpdateDocument.mockReset();
    mockDeleteDocument.mockReset();
    mockAddDocument.mockReset();
    mockServerTimestamp.mockReset().mockReturnValue('ts');
    mockToast.mockReset();
    mockRole = 'admin';
  });

  it('exporta CSV com header Email e emails normalizados', async () => {
    setupFirestoreMocks(
      [
        { id: 'u1', name: 'Pessoa 1', email: 'Pessoa1@Email.Com ' },
        { id: 'u2', name: 'Pessoa 2', email: 'invalido' },
      ],
      {
        u1: { name: 'Pessoa 1', email: 'Pessoa1@Email.Com ' },
        u2: { name: 'Pessoa 2', email: 'invalido' },
      }
    );

    const OriginalBlob = globalThis.Blob;
    class MockBlob {
      private readonly _text: string;
      readonly size: number;
      readonly type: string;
      constructor(parts: unknown[] = [], options?: { type?: string }) {
        this._text = parts.map((p) => String(p)).join('');
        this.size = this._text.length;
        this.type = options?.type ?? '';
      }
      text() {
        return Promise.resolve(this._text);
      }
    }
    (globalThis as unknown as { Blob: unknown }).Blob = MockBlob as unknown as typeof Blob;

    let capturedBlob: Blob | null = null;
    if (!('createObjectURL' in URL)) {
      (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:test';
    }
    if (!('revokeObjectURL' in URL)) {
      (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    }
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    });
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <MigrantsAdminPage />
      </MemoryRouter>
    );

    await screen.findByText('Migrantes');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Exportar Lista' }));
    await user.click(await screen.findByText('CSV'));

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();

    const csvText = await (capturedBlob as unknown as { text: () => Promise<string> }).text();
    expect(csvText).toContain('Nome,Email,Data de nascimento,Nacionalidade,Status migratório,Data de entrada');
    expect(csvText).toContain('Pessoa 1,pessoa1@email.com');
    expect(csvText).toContain('Pessoa 2,—');

    createObjectURLSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
    (globalThis as unknown as { Blob: typeof Blob }).Blob = OriginalBlob;
  });

  it('exporta CSV usando email do perfil quando o user não tem email e trata email vazio como ausente', async () => {
    setupFirestoreMocks(
      [
        { id: 'u1', name: 'Pessoa 1', email: '' },
        { id: 'u2', name: 'Pessoa 2', email: '' },
      ],
      {
        u1: { name: 'Pessoa 1', email: '  TESTE@EXEMPLO.COM ' },
        u2: { name: 'Pessoa 2', email: '' },
      }
    );

    const OriginalBlob = globalThis.Blob;
    class MockBlob {
      private readonly _text: string;
      readonly size: number;
      readonly type: string;
      constructor(parts: unknown[] = [], options?: { type?: string }) {
        this._text = parts.map((p) => String(p)).join('');
        this.size = this._text.length;
        this.type = options?.type ?? '';
      }
      text() {
        return Promise.resolve(this._text);
      }
    }
    (globalThis as unknown as { Blob: unknown }).Blob = MockBlob as unknown as typeof Blob;

    let capturedBlob: Blob | null = null;
    if (!('createObjectURL' in URL)) {
      (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:test';
    }
    if (!('revokeObjectURL' in URL)) {
      (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    }
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    });
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <MigrantsAdminPage />
      </MemoryRouter>
    );

    await screen.findByText('Migrantes');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Exportar Lista' }));
    await user.click(await screen.findByText('CSV'));

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();

    const csvText = await (capturedBlob as unknown as { text: () => Promise<string> }).text();
    expect(csvText).toContain('Pessoa 1,teste@exemplo.com');
    expect(csvText).toContain('Pessoa 2,—');

    createObjectURLSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
    (globalThis as unknown as { Blob: typeof Blob }).Blob = OriginalBlob;
  });

  it('exclui cadastro do migrante e remove o card da listagem sem refresh', async () => {
    const users = [
      { id: 'u1', name: 'Pessoa 1', email: 'p1@exemplo.com' },
      { id: 'u2', name: 'Pessoa 2', email: 'p2@exemplo.com' },
    ];

    mockQueryDocuments.mockImplementation(async (collection: string, filters?: Array<{ field: string; operator: string; value: unknown }>) => {
      if (collection === 'users') return users.map((u) => ({ ...u, role: 'migrant' }));
      if (collection === 'sessions') {
        if (Array.isArray(filters) && filters.some((f) => f.field === 'migrant_id' && f.value === 'u1')) return [{ id: 's1' }, { id: 's2' }];
        return [];
      }
      if (collection === 'user_trail_progress') {
        if (Array.isArray(filters) && filters.some((f) => f.field === 'user_id' && f.value === 'u1')) return [{ id: 'p1' }];
        return [];
      }
      if (collection === 'job_applications') {
        if (Array.isArray(filters) && filters.some((f) => f.field === 'applicant_id' && f.value === 'u1')) return [{ id: 'a1' }];
        return [];
      }
      return [];
    });

    mockGetDocument.mockImplementation(async (collection: string, docId: string) => {
      if (collection === 'profiles') return { name: docId === 'u1' ? 'Pessoa 1' : 'Pessoa 2', email: `${docId}@exemplo.com` };
      if (collection === 'triage') return { legal_status: 'regular', answers: {} };
      return null;
    });

    mockDeleteDocument.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <MigrantsAdminPage />
      </MemoryRouter>
    );

    await screen.findByText('Migrantes');
    await screen.findByText('Pessoa 1');
    await screen.findByText('Pessoa 2');

    const user = userEvent.setup();
    const deleteButtons = screen.getAllByRole('button', { name: 'Excluir' });
    await user.click(deleteButtons[0]);

    await screen.findByText('Confirmar exclusão');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(screen.queryByText('Pessoa 1')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Pessoa 2')).toBeInTheDocument();

    expect(mockDeleteDocument).toHaveBeenCalledWith('sessions', 's1');
    expect(mockDeleteDocument).toHaveBeenCalledWith('sessions', 's2');
    expect(mockDeleteDocument).toHaveBeenCalledWith('user_trail_progress', 'p1');
    expect(mockDeleteDocument).toHaveBeenCalledWith('job_applications', 'a1');
    expect(mockDeleteDocument).toHaveBeenCalledWith('triage', 'u1');
    expect(mockDeleteDocument).toHaveBeenCalledWith('profiles', 'u1');
    expect(mockDeleteDocument).toHaveBeenCalledWith('users', 'u1');
  });

  it('bloqueia exclusão para utilizadores sem permissão', async () => {
    mockRole = 'mediator';
    setupFirestoreMocks([{ id: 'u1', name: 'Pessoa 1', email: 'p1@exemplo.com' }], { u1: { name: 'Pessoa 1', email: 'p1@exemplo.com' } });

    render(
      <MemoryRouter>
        <MigrantsAdminPage />
      </MemoryRouter>
    );

    await screen.findByText('Migrantes');
    await screen.findByText('Pessoa 1');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await screen.findByText('Confirmar exclusão');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(mockDeleteDocument).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sem permissão',
        variant: 'destructive',
      })
    );
  });
});
