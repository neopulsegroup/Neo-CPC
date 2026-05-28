import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import StatisticsPage from './StatisticsPage';

const mockQueryDocuments = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pt',
    t: {
      get: (path: string, params?: Record<string, string | number>) => {
        const dict: Record<string, string> = {
          'cpc.pages.statistics.title': 'Estatísticas',
          'cpc.pages.statistics.subtitle': 'Indicadores',
          'cpc.pages.statistics.loading': 'A carregar dados…',
          'cpc.pages.statistics.migrantList.title': 'Listagem de Migrantes',
          'cpc.pages.statistics.migrantList.count': '{count} migrante(s)',
          'cpc.pages.statistics.migrantList.empty': 'Nenhum migrante',
          'cpc.pages.statistics.migrantList.viewProfile': 'Ver perfil',
          'cpc.pages.statistics.migrantList.columns.name': 'Nome',
          'cpc.pages.statistics.migrantList.columns.email': 'Email',
          'cpc.pages.statistics.migrantList.columns.region': 'Região',
          'cpc.pages.statistics.migrantList.columns.registeredAt': 'Inscrição',
          'cpc.pages.statistics.migrantList.columns.started': 'Início plano',
          'cpc.pages.statistics.migrantList.columns.completed': 'Conclusão',
          'cpc.pages.statistics.migrantList.columns.trails': 'Trilhas concluídas',
          'cpc.pages.statistics.migrantList.columns.actions': 'Ações',
          'cpc.pages.statistics.export.button': 'Exportar',
          'cpc.migrantsAdmin.region.norte': 'Norte',
          'cpc.migrantsAdmin.region.lisboa': 'Lisboa',
          'cpc.migrantsAdmin.fallback_migrant': 'Migrante',
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
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  LineChart: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  Line: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  BarChart: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  Bar: () => null,
}));

function setupMocks() {
  const createdAt = new Date().toISOString();

  mockQueryDocuments.mockImplementation(async (collectionName: string) => {
    if (collectionName === 'users') {
      return [
        { id: 'u1', role: 'migrant', name: 'Ana Norte', email: 'ana@exemplo.com', createdAt },
        { id: 'u2', role: 'migrant', name: 'Bruno Lisboa', email: 'bruno@exemplo.com', createdAt },
      ];
    }
    if (collectionName === 'user_trail_progress') return [];
    return [];
  });

  mockGetDocument.mockImplementation(async (collectionName: string, docId: string) => {
    if (collectionName === 'profiles') {
      if (docId === 'u1') return { region: 'Norte', name: 'Ana Norte', email: 'ana@exemplo.com' };
      if (docId === 'u2') return { currentLocation: 'Lisboa', name: 'Bruno Lisboa', email: 'bruno@exemplo.com' };
    }
    return null;
  });
}

describe('StatisticsPage (dashboard/cpc/estatisticas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('usa a região do perfil (profiles.region) no Detalhamento Regional', async () => {
    render(<StatisticsPage />);

    const heading = await screen.findByRole('heading', { name: 'Detalhamento Regional' });
    const card = heading.closest('.p-4');
    expect(card).toBeTruthy();
    const table = within(card as HTMLElement).getByRole('table');
    const rows = within(table).getAllByRole('row');

    const norteRow = rows.find((r) => within(r).queryByText('Norte'));
    expect(norteRow).toBeTruthy();
    expect(within(norteRow as HTMLElement).getByText('1')).toBeInTheDocument();

    const lisboaRow = rows.find((r) => within(r).queryByText('Lisboa'));
    expect(lisboaRow).toBeTruthy();
    expect(within(lisboaRow as HTMLElement).getByText('1')).toBeInTheDocument();
  });

  it('exibe Listagem de Migrantes conforme filtros', async () => {
    render(<StatisticsPage />);

    await screen.findByRole('heading', { name: 'Listagem de Migrantes' });
    expect(screen.getByText('2 migrante(s)')).toBeInTheDocument();
    expect(screen.getByText('Ana Norte')).toBeInTheDocument();
    expect(screen.getByText('Bruno Lisboa')).toBeInTheDocument();
  });

  it('filtra a listagem de migrantes por região', async () => {
    const user = userEvent.setup();
    render(<StatisticsPage />);

    await screen.findByText('Ana Norte');
    await screen.findByText('Bruno Lisboa');

    const regionTrigger = screen.getAllByRole('combobox')[2];
    await user.click(regionTrigger);
    await user.click(await screen.findByRole('option', { name: 'Norte' }));

    expect(screen.getByText('Ana Norte')).toBeInTheDocument();
    expect(screen.queryByText('Bruno Lisboa')).not.toBeInTheDocument();
    expect(screen.getByText('1 migrante(s)')).toBeInTheDocument();
  });
});
