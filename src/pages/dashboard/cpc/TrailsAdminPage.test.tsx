import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import ptJson from '@/locales/pt.json';

import TrailsAdminPage from './TrailsAdminPage';

const mockQueryDocuments = vi.fn();
const mockAddDocument = vi.fn();
const mockUpdateDocument = vi.fn();

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock LanguageContext devolvendo traduções reais do pt.json via t.get(...).
// Os testes asseguram texto específico em PT; mock simples (return key) falharia.
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

describe('TrailsAdminPage (CPC) - conteúdos de demonstração', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
    mockQueryDocuments.mockReset();
    mockAddDocument.mockReset();
    mockUpdateDocument.mockReset();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('permite alternar a exibição de conteúdos de demonstração', async () => {
    mockQueryDocuments.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    // TASK-TESTS: título do header migrou para chave i18n cpc.pages.trails.title = "Trilhas".
    // O texto original ("Gerir Trilhas Formativas") foi substituído ao migrar para i18n; teste atualizado.
    await screen.findByRole('heading', { level: 1, name: 'Trilhas' });
    await screen.findByText('Nenhuma trilha criada ainda.');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mostrar demonstração' }));

    expect(await screen.findByText('Conteúdos de demonstração')).toBeInTheDocument();
    expect(screen.getAllByText('Demo').length).toBeGreaterThan(0);
    expect(screen.getByText('Direitos Laborais em Portugal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ocultar demonstração' }));
    await waitFor(() => {
      expect(screen.queryByText('Conteúdos de demonstração')).toBeNull();
    });
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

  it('exibe erro e permite alternar para demonstração quando falha a carga', async () => {
    mockQueryDocuments.mockRejectedValueOnce(new Error('fail'));

    render(
      <MemoryRouter>
        <TrailsAdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Ocorreu um problema')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ver demonstração' }));

    expect(await screen.findByText('Conteúdos de demonstração')).toBeInTheDocument();
    expect(screen.getByText('Direitos Laborais em Portugal')).toBeInTheDocument();
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
