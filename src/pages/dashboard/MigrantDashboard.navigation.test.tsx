import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import MigrantDashboard from './MigrantDashboard';

const stableUser = { uid: 'u1' };
let authState: { user?: { uid: string } | null; profile?: { name?: string; role?: string } } = { user: stableUser, profile: { name: 'Ana', role: 'migrant' } };

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pt',
    t: {
      dashboard: {
        overview: 'Visão geral',
        needs_profile: 'Perfil de necessidades',
        urgencies: 'Urgências',
        interests: 'Interesses',
        overall_progress: 'Progresso Geral',
        trails: 'Trilhas',
        sessions: 'Sessões',
        activities: 'Atividades',
        profile: 'Perfil',
        book_session_action: 'Marcar sessão',
        start_trail_action: '',
        complete_cv_action: '',
        submit: '',
        description: '',
        notifications: 'Notificações',
        no_notifications: 'Sem notificações',
        view_all: 'Ver todas',
        employment_area: 'Área de Emprego',
        session_types: { mediador: 'Mediador', jurista: 'Jurista', psicologa: 'Psicóloga' },
        support_types: { juridico: 'Jurídico', psicologico: 'Psicológico', habitacional: 'Habitacional', necessidades: 'Necessidades' },
      },
      common: {
        languages: {
          pt: 'Português',
          en: 'English',
          es: 'Español',
        },
      },
      get: (k: string) => {
        const dict: Record<string, string> = {
          'dashboard.overview': 'Visão geral',
          'dashboard.sessions': 'Sessões',
          'dashboard.activities': 'Atividades',
          'dashboard.employment': 'Emprego',
          'dashboard.trails': 'Trilhas',
          'dashboard.profile': 'Perfil',
          'dashboard.curriculum': 'Currículo',
          'dashboard.applications': 'Candidaturas',
          'dashboard.messages': 'Mensagens',
          'dashboard.triage': 'Situação Inicial',
          'migrant.menu.title': 'Menu Migrante',
          'cpc.menu.user_fallback': 'Utilizador',
          'sidebar.sections.settings': 'Definições',
          'sidebar.sections.messages': 'Mensagens',
          'dashboard.welcome': 'Bem-vindo(a)',
          'dashboard.overview_desc': 'Resumo personalizado da sua integração',
          'auth.roles.migrant': 'Pessoa Migrante',
          'dashboard.activities_empty': 'O migrante ainda não participou em nenhuma atividade.',
        };
        return dict[k] ?? k;
      },
    },
  }),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div>Calendar</div>,
}));

const mockAddDocument = vi.fn();
const mockGetDocument = vi.fn();
const mockQueryDocuments = vi.fn().mockResolvedValue([]);
const mockSubscribeDocument = vi.fn();
const mockSubscribeQuery = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  subscribeDocument: (...args: unknown[]) => mockSubscribeDocument(...args),
  subscribeQuery: (...args: unknown[]) => mockSubscribeQuery(...args),
}));

vi.mock('./migrant/TrailsPage', () => ({ default: () => <div>Trails</div> }));
vi.mock('./migrant/TrailDetailPage', () => ({ default: () => <div>TrailDetail</div> }));
vi.mock('./migrant/ModuleViewerPage', () => ({ default: () => <div>ModuleViewer</div> }));
vi.mock('./migrant/JobsPage', () => ({ default: () => <div>Jobs</div> }));
vi.mock('./migrant/JobDetailPage', () => ({ default: () => <div>JobDetail</div> }));
vi.mock('./migrant/ProfilePage', () => ({ default: () => <div>Profile</div> }));
vi.mock('./migrant/CurriculumPage', () => ({ default: () => <div>Curriculum</div> }));
vi.mock('./migrant/SessionsPage', () => ({ default: () => <div>Sessions</div> }));
vi.mock('./migrant/MessagesPage', () => ({ default: () => <div>Messages</div> }));
vi.mock('./migrant/MigrantActivitiesListPage', () => ({ default: () => <div>MigrantActivities</div> }));
vi.mock('./migrant/MigrantActivityDetailPage', () => ({ default: () => <div>MigrantActivityDetail</div> }));

describe('MigrantDashboard - navegação', () => {
  beforeEach(() => {
    authState = { user: stableUser, profile: { name: 'Ana', role: 'migrant' } };
    localStorage.clear();
    vi.clearAllMocks();

    mockSubscribeDocument.mockImplementation((args: unknown) => {
      const a = args as { collectionName: string; onNext: (doc: unknown) => void };
      a.onNext(null);
      return () => {};
    });
    mockSubscribeQuery.mockImplementation((args: unknown) => {
      const a = args as { onNext: (docs: unknown[]) => void };
      a.onNext([]);
      return () => {};
    });
  });

  it('mostra "Perfil" e "Currículo" na secção Definições para migrantes (sem link Mensagens no menu)', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/migrante/perfil']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Definições')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Currículo' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mensagens' })).not.toBeInTheDocument();
  });

  it('não mostra item "Mensagens" para utilizadores não migrantes', async () => {
    authState = { user: stableUser, profile: { name: 'Empresa', role: 'company' } };

    render(
      <MemoryRouter initialEntries={['/dashboard/migrante/perfil']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: 'Mensagens' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Perfil' })).not.toBeInTheDocument();
  });

  it('regressão visual (estrutura + active/hover): classNames do menu em /mensagens (rota ainda acessível)', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/migrante/mensagens']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation');
    const links = Array.from(nav.querySelectorAll('a')).map((a) => ({ label: a.textContent?.trim() ?? '', className: a.className }));

    expect(links).toMatchInlineSnapshot(`
      [
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Visão geral",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Sessões",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Atividades",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Emprego",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Candidaturas",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Trilhas",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Perfil",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Currículo",
        },
      ]
    `);
  });

  it('exibe alerta de cadastro incompleto nas Notificações quando faltam campos obrigatórios', async () => {
    mockSubscribeDocument.mockImplementation((args: unknown) => {
      const a = args as { collectionName: string; onNext: (doc: unknown) => void };
      if (a.collectionName === 'triage') {
        a.onNext({ completed: false, urgencies: [], interests: [] });
        return () => {};
      }
      if (a.collectionName === 'profiles') {
        a.onNext({
          name: 'Ana',
          phone: '',
          birthDate: null,
          nationality: '',
          address: '',
          addressNumber: '',
          cep: '',
          region: null,
          professionalTitle: '',
          professionalExperience: '',
          skills: '',
          languagesList: '',
          mainNeeds: '',
        });
        return () => {};
      }
      a.onNext(null);
      return () => {};
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/migrante']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Notificações')).toBeInTheDocument();
    expect(await screen.findByText('Complete o seu cadastro')).toBeInTheDocument();
    expect(screen.getByText(/Informação Pessoal:/)).toBeInTheDocument();
    expect(screen.getByText(/Perfil Profissional:/)).toBeInTheDocument();
  });

  it('não exibe alerta de cadastro incompleto quando campos obrigatórios estão preenchidos', async () => {
    mockSubscribeDocument.mockImplementation((args: unknown) => {
      const a = args as { collectionName: string; onNext: (doc: unknown) => void };
      if (a.collectionName === 'triage') {
        a.onNext({ completed: true, urgencies: [], interests: [] });
        return () => {};
      }
      if (a.collectionName === 'profiles') {
        a.onNext({
          name: 'Ana',
          phone: '+351900000000',
          birthDate: '1990-02-03',
          nationality: 'Brasil',
          address: 'Rua Exemplo, 123, Lisboa',
          addressNumber: '10',
          cep: '1000-001',
          region: 'Lisboa',
          regionOther: null,
          professionalTitle: 'Operadora',
          professionalExperience: 'Experiência profissional suficiente.',
          skills: 'Atendimento, Organização',
          languagesList: 'Português, Inglês',
          mainNeeds: 'Apoio na integração',
        });
        return () => {};
      }
      a.onNext(null);
      return () => {};
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/migrante']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Notificações')).toBeInTheDocument();
    expect(screen.queryByText('Complete o seu cadastro')).toBeNull();
    expect(await screen.findByText('Sem notificações')).toBeInTheDocument();
  });

  it('lê dinamicamente urgências e interesses da triagem no card Visão Geral', async () => {
    mockSubscribeDocument.mockImplementation((args: unknown) => {
      const a = args as { collectionName: string; onNext: (doc: unknown) => void };
      if (a.collectionName === 'triage') {
        a.onNext({ completed: true, urgencies: ['legal'], interests: ['it'] });
        return () => {};
      }
      if (a.collectionName === 'profiles') {
        a.onNext({ name: 'Ana', phone: '+351900000000', birthDate: '1990-02-03', nationality: 'Brasil', address: 'Rua Exemplo, 123, Lisboa', addressNumber: '10', cep: '1000-001', region: 'Lisboa', professionalTitle: 'Operadora', professionalExperience: 'Experiência profissional suficiente.', skills: 'Atendimento', languagesList: 'Português', mainNeeds: 'Apoio' });
        return () => {};
      }
      a.onNext(null);
      return () => {};
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/migrante']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument();
    expect(await screen.findByText(/Urgências:/)).toBeInTheDocument();
    expect(await screen.findByText(/Interesses:/)).toBeInTheDocument();
  });

  it('recalcula Progresso Geral com base em trilhas, sessões, perfil e triagem', async () => {
    mockSubscribeDocument.mockImplementation((args: unknown) => {
      const a = args as { collectionName: string; onNext: (doc: unknown) => void };
      if (a.collectionName === 'triage') {
        a.onNext({ completed: true, urgencies: [], interests: [] });
        return () => {};
      }
      if (a.collectionName === 'profiles') {
        a.onNext({
          name: 'Ana',
          phone: '+351900000000',
          birthDate: '1990-02-03',
          nationality: 'Brasil',
          address: 'Rua Exemplo, 123, Lisboa',
          addressNumber: '10',
          cep: '1000-001',
          region: 'Lisboa',
          professionalTitle: 'Operadora',
          professionalExperience: 'Experiência profissional suficiente.',
          skills: 'Atendimento, Organização',
          languagesList: 'Português, Inglês',
          mainNeeds: 'Apoio na integração',
        });
        return () => {};
      }
      a.onNext(null);
      return () => {};
    });

    mockSubscribeQuery.mockImplementation((args: unknown) => {
      const a = args as { collectionName: string; onNext: (docs: unknown[]) => void };
      if (a.collectionName === 'sessions') {
        a.onNext([
          { id: 's1', session_type: 'mediador', scheduled_date: '2026-01-01', scheduled_time: '10:00', status: 'completed' },
          { id: 's2', session_type: 'jurista', scheduled_date: '2026-01-10', scheduled_time: '10:00', status: 'pending' },
        ]);
        return () => {};
      }
      if (a.collectionName === 'user_trail_progress') {
        a.onNext([
          { id: 'p1', trail_id: 't1', progress_percent: 50, modules_completed: 1, completed_at: null },
          { id: 'p2', trail_id: 't2', progress_percent: 100, modules_completed: 3, completed_at: '2026-02-01' },
        ]);
        return () => {};
      }
      a.onNext([]);
      return () => {};
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/migrante']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    const overviewHeading = await screen.findByRole('heading', { name: 'Visão geral' });
    const overviewCard = overviewHeading.closest('.cpc-card');
    expect(overviewCard).not.toBeNull();

    const expectCircle = (label: string, pct: number) => {
      const candidates = within(overviewCard as HTMLElement).getAllByText(label);
      const match = candidates.find((el) => el.parentElement?.textContent?.includes(`${pct}%`));
      expect(match).toBeTruthy();
    };

    expectCircle('Trilhas', 75);
    expectCircle('Sessões', 50);
    expectCircle('Perfil', 100);
    expectCircle('Situação Inicial', 100);
  });

  it('não exibe botões de ação no card Visão Geral (Completar CV, Iniciar trilha formativa, Marcar sessão)', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/migrante']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    const overviewHeading = await screen.findByRole('heading', { name: 'Visão geral' });
    const overviewCard = overviewHeading.closest('.cpc-card');
    expect(overviewCard).not.toBeNull();

    expect(within(overviewCard as HTMLElement).queryByRole('button', { name: 'Completar CV' })).toBeNull();
    expect(within(overviewCard as HTMLElement).queryByRole('button', { name: 'Iniciar trilha formativa' })).toBeNull();
    expect(within(overviewCard as HTMLElement).queryByRole('button', { name: 'Marcar sessão' })).toBeNull();
  });
});
