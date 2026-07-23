import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ptJson from '@/locales/pt.json';
import { resetAuditLogCachesForTests } from '@/lib/auditLog';

import CPCDashboard from './CPCDashboard';

const mockQueryDocuments = vi.fn();
const mockCountDocuments = vi.fn();
const mockGetDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockAddDocument = vi.fn();
const mockServerTimestamp = vi.fn();

let authState: { profile: { name?: string; role?: string; email?: string }; user?: { uid?: string; email?: string; displayName?: string } } = {
  profile: { name: 'Ana', role: 'admin', email: 'ana@teste.com' },
  user: { uid: 'u-admin', email: 'ana@teste.com', displayName: 'Ana' },
};

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

// Mock LanguageContext devolvendo traduções reais do pt.json via t.get(...).
// Substitui dict hardcoded incompleto (faltava cpc.pages.trails.title, entre outras).
vi.mock('@/contexts/LanguageContext', () => {
  function tGet(path: string, params?: Record<string, string | number>): string {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, ptJson);
    const template = typeof value === 'string' ? value : path;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
  }
  return {
    useLanguage: () => ({
      language: 'pt',
      setLanguage: vi.fn(),
      t: { get: tGet },
    }),
  };
});

vi.mock('@/integrations/firebase/auth', () => ({
  registerUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
  subscribeQuery: () => () => {},
  subscribeDocument: () => () => {},
}));

describe('CPCDashboard - navegação (inclui Trilhas)', () => {
  beforeEach(() => {
    resetAuditLogCachesForTests();
    authState = {
      profile: { name: 'Ana', role: 'admin', email: 'ana@teste.com' },
      user: { uid: 'u-admin', email: 'ana@teste.com', displayName: 'Ana' },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ip: '203.0.113.10' }),
    }));
    vi.stubGlobal('navigator', { userAgent: 'vitest-agent' });
    mockQueryDocuments.mockReset().mockResolvedValue([]);
    mockCountDocuments.mockReset().mockResolvedValue(0);
    mockGetDocument.mockReset().mockResolvedValue(null);
    mockUpdateDocument.mockReset().mockResolvedValue(undefined);
    mockDeleteDocument.mockReset().mockResolvedValue(undefined);
    mockAddDocument.mockReset().mockResolvedValue('log1');
    mockServerTimestamp.mockReset().mockReturnValue('ts');
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra o nome do utilizador no "Bem-vindo(a)" (fallback para email se o nome for genérico)', async () => {
    authState = {
      profile: { name: 'CPC', role: 'admin', email: 'testeb@teste.com' },
      user: { uid: 'u-testeb', email: 'testeb@teste.com', displayName: 'CPC' },
    };

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Bem-vindo(a), Testeb' })).toBeInTheDocument();
  });

  it('em /equipa esconde ações de escrita para utilizadores não Admin e registra auditoria', async () => {
    authState = {
      profile: { name: 'Maria', role: 'mediator', email: 'maria@teste.com' },
      user: { uid: 'u-maria', email: 'maria@teste.com', displayName: 'Maria' },
    };

    mockQueryDocuments.mockImplementation((collection: unknown) => {
      if (collection === 'users') {
        return Promise.resolve([{ id: 'u2', name: 'João', email: 'joao@teste.com', role: 'mediator', active: true }]);
      }
      return Promise.resolve([]);
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/equipa']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('João')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Adicionar novo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockAddDocument).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'unauthorized_attempt',
          actor_id: 'u-maria',
          context: 'cpc.team.page_access',
          ip_address: expect.any(String),
          user_agent: expect.any(String),
          createdAt: 'ts',
        })
      );
    });
  });

  it('em /equipa permite desativar e excluir utilizador apenas quando o perfil é Admin', async () => {
    authState = {
      profile: { name: 'Ana', role: 'admin', email: 'ana@teste.com' },
      user: { uid: 'u-admin', email: 'ana@teste.com', displayName: 'Ana' },
    };

    mockQueryDocuments.mockImplementation((collection: unknown) => {
      if (collection === 'users') {
        return Promise.resolve([{ id: 'u2', name: 'João', email: 'joao@teste.com', role: 'mediator', active: true }]);
      }
      return Promise.resolve([]);
    });
    mockDeleteDocument.mockResolvedValue(undefined);
    mockGetDocument.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/equipa']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('João')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Desativar' }));

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'users',
        'u2',
        expect.objectContaining({
          active: false,
        })
      );
    });

    await waitFor(() => {
      expect(mockAddDocument).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'user.deactivated',
          actor_id: 'u-admin',
          target_id: 'u2',
          ip_address: expect.any(String),
          user_agent: expect.any(String),
          createdAt: 'ts',
        })
      );
    });

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByRole('heading', { name: 'Excluir utilizador' })).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: 'Excluir' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledWith('profiles', 'u2');
      expect(mockDeleteDocument).toHaveBeenCalledWith('users', 'u2');
    });

    await waitFor(() => {
      expect(mockAddDocument).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'user.deleted',
          actor_id: 'u-admin',
          target_id: 'u2',
          context: 'cpc_team',
          createdAt: 'ts',
        })
      );
    });
  });

  it('marca "Trilhas" como ativo e permite navegar para "Equipa"', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/trilhas']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    // TASK-TESTS: título "Gerir Trilhas Formativas" foi substituído pela chave i18n
    // cpc.pages.trails.title = "Trilhas" quando o header migrou para o seletor i18n.
    expect(await screen.findByRole('heading', { level: 1, name: 'Trilhas' })).toBeInTheDocument();
    const trilhasLink = screen.getByRole('link', { name: 'Trilhas' });
    expect(trilhasLink.className).toContain('bg-primary');

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Equipa' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Equipa' }).className).toContain('bg-primary');
    });
    expect(screen.getByRole('link', { name: 'Trilhas' }).className).not.toContain('bg-primary');
  });

  it('mantém "Perfil" e "Configurações" no final da secção Definições (sem Mensagens no menu)', async () => {
    const setWidth = (value: number) => {
      Object.defineProperty(window, 'innerWidth', { value, writable: true, configurable: true });
      window.dispatchEvent(new Event('resize'));
    };

    setWidth(375);
    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard/cpc']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Administração')).toBeInTheDocument();
    expect(await screen.findByText('Definições')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mensagens' })).not.toBeInTheDocument();

    const nav = screen.getByRole('navigation');
    const links = Array.from(nav.querySelectorAll('a'))
      .map((a) => a.textContent?.trim() ?? '')
      .filter(Boolean);
    expect(links.at(-3)).toBe('Logs de Auditoria');
    expect(links.at(-2)).toBe('Perfil');
    expect(links.at(-1)).toBe('Configurações');

    unmount();

    setWidth(1280);
    render(
      <MemoryRouter initialEntries={['/dashboard/cpc']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Administração')).toBeInTheDocument();
    expect(await screen.findByText('Definições')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mensagens' })).not.toBeInTheDocument();
    const nav2 = screen.getByRole('navigation');
    const links2 = Array.from(nav2.querySelectorAll('a'))
      .map((a) => a.textContent?.trim() ?? '')
      .filter(Boolean);
    expect(links2.at(-3)).toBe('Logs de Auditoria');
    expect(links2.at(-2)).toBe('Perfil');
    expect(links2.at(-1)).toBe('Configurações');
  });

  it('não mostra a secção Administração para utilizadores não Admin', async () => {
    authState = {
      profile: { name: 'Maria', role: 'mediator', email: 'maria@teste.com' },
      user: { uid: 'u-maria', email: 'maria@teste.com', displayName: 'Maria' },
    };

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Definições')).toBeInTheDocument();
    expect(screen.queryByText('Administração')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Logs de Auditoria' })).not.toBeInTheDocument();
  });

  it('redireciona não Admin que acede diretamente a /log-eventos', async () => {
    authState = {
      profile: { name: 'Maria', role: 'mediator', email: 'maria@teste.com' },
      user: { uid: 'u-maria', email: 'maria@teste.com', displayName: 'Maria' },
    };

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/log-eventos']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /Bem-vindo/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Logs de Auditoria' })).not.toBeInTheDocument();
  });

  it('inclui "Atividades" imediatamente após "Migrantes" no menu principal', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
    window.dispatchEvent(new Event('resize'));

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Definições')).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    const links = Array.from(nav.querySelectorAll('a'))
      .map((a) => a.textContent?.trim() ?? '')
      .filter(Boolean);

    const migrantsIndex = links.indexOf('Migrantes');
    const activitiesIndex = links.indexOf('Atividades');
    expect(migrantsIndex).toBeGreaterThanOrEqual(0);
    expect(activitiesIndex).toBeGreaterThan(migrantsIndex);
    // SCAS fica entre Migrantes e Atividades no menu principal.
    expect(activitiesIndex).toBe(migrantsIndex + 2);
  });

  it('mantém "Trilhas" como ativo ao abrir o editor /trilhas/:trailId', async () => {
    mockGetDocument.mockResolvedValueOnce({
      id: 't1',
      title: 'Trilha 1',
      description: 'Descrição',
      category: 'work',
      difficulty: 'beginner',
      duration_minutes: 0,
      modules_count: 0,
      is_active: true,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/trilhas/t1']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Editar Trilha')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trilhas' }).className).toContain('bg-primary');
  });
});
