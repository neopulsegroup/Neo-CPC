import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import ptJson from '@/locales/pt.json';

import TrailsAdminPage from './TrailsAdminPage';

const mockQueryDocuments = vi.fn();
const mockAddDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockNavigate = vi.fn();
const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u-admin', email: 'admin@teste.com' } }),
}));

vi.mock('@/integrations/firebase/client', () => ({
  storage: {},
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/LanguageContext', () => {
  function tGet(path: string): string {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, ptJson);
    return typeof value === 'string' ? value : path;
  }
  return {
    useLanguage: () => ({
      language: 'pt',
      setLanguage: vi.fn(),
      t: { get: tGet },
    }),
  };
});

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
}));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('TrailsAdminPage (CPC)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
    mockQueryDocuments.mockReset();
    mockAddDocument.mockReset();
    mockUpdateDocument.mockReset().mockResolvedValue(undefined);
    mockNavigate.mockReset();
    mockUploadBytes.mockReset().mockResolvedValue(undefined);
    mockGetDownloadURL.mockReset().mockResolvedValue('https://example.com/cover.jpg');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('não mostra opções de demonstração', async () => {
    mockQueryDocuments.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { level: 1, name: 'Trilhas' });
    expect(screen.queryByRole('button', { name: 'Criar trilhas demo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mostrar demonstração' })).toBeNull();
    expect(screen.queryByText('Conteúdos de demonstração')).toBeNull();
    expect(screen.queryByText('Nova Trilha')).toBeNull();
    expect(screen.getByRole('button', { name: 'Criar Trilha' })).toBeInTheDocument();
  });

  it('abre popup de criação com os campos necessários', async () => {
    mockQueryDocuments.mockResolvedValueOnce([]);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { level: 1, name: 'Trilhas' });
    await user.click(screen.getByRole('button', { name: 'Criar Trilha' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Imagem de capa *')).toBeInTheDocument();
    expect(screen.getByLabelText('Título *')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Nível')).toBeInTheDocument();
  });

  it('oculta trilhas de demonstração vindas da base de dados', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
      {
        id: 'real-1',
        title: 'Integração Profissional no Algarve',
        description: 'Real',
        category: 'work',
        difficulty: 'beginner',
        duration_minutes: 10,
        modules_count: 1,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        image_url: null,
      },
      {
        id: 'demo-1',
        title: 'Situação Legal',
        description: 'Demo',
        category: 'rights',
        difficulty: 'beginner',
        duration_minutes: 10,
        modules_count: 1,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        image_url: null,
      },
    ]);

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Integração Profissional no Algarve')).toBeInTheDocument();
    expect(screen.queryByText('Situação Legal')).toBeNull();
  });

  it('usa cache local para renderizar rapidamente e atualiza em background', async () => {
    localStorage.setItem(
      'cpc-trails-cache:v1',
      JSON.stringify({
        ts: Date.now(),
        data: [
          {
            id: 't1',
            title: 'Trilha Cache',
            description: 'Cache',
            category: 'work',
            difficulty: 'beginner',
            duration_minutes: 10,
            modules_count: 1,
            is_active: true,
            created_at: '2025-01-01T00:00:00.000Z',
            image_url: null,
          },
        ],
      })
    );

    const d = deferred<unknown[]>();
    mockQueryDocuments.mockReturnValueOnce(d.promise);

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Trilha Cache')).toBeInTheDocument();
    expect(screen.getByText('Atualizando…')).toBeInTheDocument();

    d.resolve([]);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma trilha criada ainda.')).toBeInTheDocument();
    });
  });

  it('alterna trilha entre ativa e inativa', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
      {
        id: 't1',
        title: 'Trilha 1',
        description: 'Descrição',
        category: 'work',
        difficulty: 'beginner',
        duration_minutes: 10,
        modules_count: 1,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        image_url: null,
      },
    ]);

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Trilha 1')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: 'Desativar trilha' }));

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('trails', 't1', { is_active: false });
    });
    expect(screen.getByText('Inativa')).toBeInTheDocument();
  });

  it('exibe erro e permite tentar novamente quando falha a carga', async () => {
    mockQueryDocuments.mockRejectedValueOnce(new Error('fail'));

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Ocorreu um problema')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver demonstração' })).toBeNull();

    const user = userEvent.setup();
    mockQueryDocuments.mockResolvedValueOnce([]);
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => {
      expect(screen.getByText('Nenhuma trilha criada ainda.')).toBeInTheDocument();
    });
  });
});

describe('TrailsAdminPage (CPC) - alternância de visualização', () => {
  beforeEach(() => {
    localStorage.clear();
    mockQueryDocuments.mockReset();
  });

  it('renderiza em grade por padrão e alterna para lista', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
      {
        id: 't1',
        title: 'Trilha 1',
        description: 'Descrição',
        category: 'work',
        difficulty: 'beginner',
        duration_minutes: 10,
        modules_count: 1,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        image_url: null,
      },
    ]);

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Trilha 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Trilhas existentes - grade')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Ver em lista' }));

    expect(screen.getByLabelText('Trilhas existentes - lista')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar' })).toBeInTheDocument();
    expect(localStorage.getItem('cpc-trails:viewMode')).toBe('list');
  });

  it('mantém a preferência de visualização após recarregar', async () => {
    localStorage.setItem('cpc-trails:viewMode', 'list');

    mockQueryDocuments.mockResolvedValueOnce([
      {
        id: 't1',
        title: 'Trilha 1',
        description: 'Descrição',
        category: 'work',
        difficulty: 'beginner',
        duration_minutes: 10,
        modules_count: 1,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        image_url: null,
      },
    ]);

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Trilha 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Trilhas existentes - lista')).toBeInTheDocument();
  });
});
