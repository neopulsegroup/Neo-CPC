import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import MyApplicationsPage from './MyApplicationsPage';

const mockQueryDocuments = vi.fn();
const mockGetDocument = vi.fn();

let authState: { user?: { uid?: string }; profile?: { role?: string } } = {
  user: { uid: 'm1' },
  profile: { role: 'migrant' },
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

// Mock LanguageContext devolvendo traduções reais via Proxy ao pt.json (mesmo padrão de MessagesPage.test).
vi.mock('@/contexts/LanguageContext', async () => {
  const { getTranslationStringAtPath, interpolateTranslation } = await vi.importActual<typeof import('@/lib/i18n')>(
    '@/lib/i18n'
  );
  const get = (path: string, params?: Record<string, string | number>) => {
    const template = getTranslationStringAtPath('pt', path) ?? path;
    return interpolateTranslation(template, params);
  };
  const wrap = (prefix = ''): unknown =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === 'get') return get;
          if (typeof prop !== 'string') return undefined;
          const next = prefix ? `${prefix}.${prop}` : prop;
          const value = getTranslationStringAtPath('pt', next);
          if (typeof value === 'string') return value;
          return wrap(next);
        },
      }
    );
  return {
    useLanguage: () => ({
      language: 'pt',
      setLanguage: vi.fn(),
      t: wrap() as unknown as Record<string, unknown> & { get: typeof get },
    }),
  };
});

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

function setupOfferAndCompanyMocks(opts: {
  offers: Record<string, { id: string; title?: string; company_id?: string; location?: string | null } | null>;
  companies: Record<string, { id: string; company_name?: string } | null>;
}) {
  mockGetDocument.mockImplementation(async (collection: string, id: string) => {
    if (collection === 'job_offers') return opts.offers[id] ?? null;
    if (collection === 'companies') return opts.companies[id] ?? null;
    return null;
  });
}

describe('MyApplicationsPage (dashboard/migrante/candidaturas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: { uid: 'm1' }, profile: { role: 'migrant' } };
  });

  it('mostra empty state com CTA quando o migrante não tem candidaturas', async () => {
    mockQueryDocuments.mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <MyApplicationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Ainda não fez nenhuma candidatura')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /procurar vagas/i });
    expect(cta).toHaveAttribute('href', '/dashboard/migrante/emprego');
  });

  it('lista candidaturas ordenadas por created_at desc + enriquece com oferta e empresa', async () => {
    // 3 candidaturas em ordem cronológica crescente; esperamos ordem inversa no render.
    mockQueryDocuments.mockResolvedValueOnce([
      { id: 'a1', job_id: 'j1', applicant_id: 'm1', status: 'submitted', created_at: '2026-01-10T10:00:00.000Z' },
      { id: 'a2', job_id: 'j2', applicant_id: 'm1', status: 'accepted', created_at: '2026-02-15T10:00:00.000Z' },
      { id: 'a3', job_id: 'j3', applicant_id: 'm1', status: 'rejected', created_at: '2026-03-20T10:00:00.000Z' },
    ]);
    setupOfferAndCompanyMocks({
      offers: {
        j1: { id: 'j1', title: 'Carpinteiro', company_id: 'c1', location: 'Faro' },
        j2: { id: 'j2', title: 'Rececionista', company_id: 'c2', location: 'Albufeira' },
        j3: { id: 'j3', title: 'Cozinheiro', company_id: 'c1', location: 'Faro' },
      },
      companies: {
        c1: { id: 'c1', company_name: 'Construções Algarve' },
        c2: { id: 'c2', company_name: 'Hotel Marina' },
      },
    });

    render(
      <MemoryRouter>
        <MyApplicationsPage />
      </MemoryRouter>
    );

    // Aguarda render e confirma a ordem: Cozinheiro (mais recente) > Rececionista > Carpinteiro.
    const cozinheiroHeading = await screen.findByRole('heading', { name: 'Cozinheiro' });
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['Cozinheiro', 'Rececionista', 'Carpinteiro']);

    // Confirma empresa enriquecida.
    const cozinheiroCard = cozinheiroHeading.closest('article');
    expect(cozinheiroCard).not.toBeNull();
    if (cozinheiroCard) {
      expect(within(cozinheiroCard).getByText('Construções Algarve')).toBeInTheDocument();
    }
  });

  it('filtra por status (mostra só accepted)', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
      { id: 'a1', job_id: 'j1', applicant_id: 'm1', status: 'submitted', created_at: '2026-01-10T10:00:00.000Z' },
      { id: 'a2', job_id: 'j2', applicant_id: 'm1', status: 'accepted', created_at: '2026-02-15T10:00:00.000Z' },
    ]);
    setupOfferAndCompanyMocks({
      offers: {
        j1: { id: 'j1', title: 'Vaga Pendente', company_id: 'c1' },
        j2: { id: 'j2', title: 'Vaga Aceite', company_id: 'c1' },
      },
      companies: { c1: { id: 'c1', company_name: 'Empresa X' } },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MyApplicationsPage />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Vaga Aceite' });
    expect(screen.getByRole('heading', { name: 'Vaga Pendente' })).toBeInTheDocument();

    // Abre o Select e escolhe "Aceite".
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Aceite' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Vaga Pendente' })).toBeNull();
    });
    expect(screen.getByRole('heading', { name: 'Vaga Aceite' })).toBeInTheDocument();
  });

  it('botão "Ver oferta" navega para /dashboard/migrante/emprego/:jobId', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
      { id: 'a1', job_id: 'job-xyz', applicant_id: 'm1', status: 'reviewing', created_at: '2026-04-01T00:00:00.000Z' },
    ]);
    setupOfferAndCompanyMocks({
      offers: { 'job-xyz': { id: 'job-xyz', title: 'Eletricista', company_id: 'c9' } },
      companies: { c9: { id: 'c9', company_name: 'EletroCo' } },
    });

    render(
      <MemoryRouter>
        <MyApplicationsPage />
      </MemoryRouter>
    );

    const link = await screen.findByRole('link', { name: /ver oferta/i });
    expect(link).toHaveAttribute('href', '/dashboard/migrante/emprego/job-xyz');
  });

  it('usa fallbacks quando oferta ou empresa não existem', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
      { id: 'a1', job_id: 'job-removed', applicant_id: 'm1', status: 'submitted', created_at: '2026-05-01T00:00:00.000Z' },
    ]);
    // Oferta inexistente (getDocument devolve null para tudo).
    mockGetDocument.mockResolvedValue(null);

    render(
      <MemoryRouter>
        <MyApplicationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Oferta indisponível')).toBeInTheDocument();
    expect(screen.getByText('Empresa')).toBeInTheDocument();
  });
});
