import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import ActivitiesPage from './ActivitiesPage';

const mockLoadActivitiesForExport = vi.fn();
const mockLoadActivitiesPage = vi.fn();
const mockLoadActivitiesSummary = vi.fn();
const mockListConsultants = vi.fn();

vi.mock('@/features/activities/controller', () => ({
  loadActivitiesForExport: (...args: unknown[]) => mockLoadActivitiesForExport(...args),
  loadActivitiesPage: (...args: unknown[]) => mockLoadActivitiesPage(...args),
  loadActivitiesSummary: (...args: unknown[]) => mockLoadActivitiesSummary(...args),
  toFiltersWithDatePreset: (f: unknown) => f,
}));

vi.mock('@/features/activities/repository', () => ({
  listConsultants: (...args: unknown[]) => mockListConsultants(...args),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      get: (path: string) => {
        const dict: Record<string, string> = {
          'cpc.activities.title': 'Gestão de Atividades',
          'cpc.activities.subtitle': 'Crie e gerencie atividades para migrantes',
          'cpc.activities.export.button': 'Exportar',
          'cpc.activities.export.csv': 'Exportar CSV',
          'cpc.activities.export.pdf': 'Exportar PDF',
          'cpc.activities.list.empty': 'Sem atividades',
          'cpc.activities.list.showing_none': 'A mostrar 0 resultados',
          'cpc.activities.pagination.prev': 'Anterior',
          'cpc.activities.pagination.next': 'Seguinte',
          'cpc.activities.table.activity': 'Atividade',
          'cpc.activities.table.type': 'Tipo',
          'cpc.activities.table.date_time': 'Data/Hora',
          'cpc.activities.table.consultants': 'Consultores',
          'cpc.activities.table.location': 'Local',
          'cpc.activities.table.status': 'Estado',
          'cpc.activities.filters.search.label': 'Pesquisar',
          'cpc.activities.filters.search.placeholder': 'Pesquisar por título ou tema',
          'cpc.activities.filters.search.action': 'Aplicar',
          'cpc.activities.filters.search.hint': 'Dica pesquisa',
          'cpc.activities.filters.search.disabled_hint': 'Pesquisa desativada',
          'cpc.activities.filters.type': 'Tipo',
          'cpc.activities.filters.all_types': 'Todos os tipos',
          'cpc.activities.filters.status': 'Estado',
          'cpc.activities.filters.any_status': 'Qualquer estado',
          'cpc.activities.filters.format': 'Formato',
          'cpc.activities.filters.all_formats': 'Todos os formatos',
          'cpc.activities.filters.date': 'Período',
          'cpc.activities.filters.date_this_month': 'Este mês',
          'cpc.activities.filters.date_next_30': 'Próximos 30 dias',
          'cpc.activities.filters.date_all': 'Todos',
          'cpc.activities.filters.consultant.label': 'Consultor',
          'cpc.activities.filters.consultant.disabled_hint': 'Filtro desativado',
          'cpc.activities.filters.any_consultant': 'Qualquer consultor',
          'cpc.activities.filters.topic.label': 'Temática',
          'cpc.activities.filters.topic.disabled_hint': 'Filtro desativado',
          'cpc.activities.filters.any_topic': 'Qualquer temática',
          'cpc.activities.filters.hints_title': 'Dica',
          'cpc.activities.filters.hints_body': 'Texto',
          'common.error': 'Ocorreu um erro',
          'common.cancel': 'Cancelar',
        };
        return dict[path] ?? path;
      },
    },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u-admin' }, profile: { role: 'admin' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('ActivitiesPage - exportação', () => {
  beforeEach(() => {
    mockLoadActivitiesForExport.mockReset();
    mockLoadActivitiesPage.mockReset();
    mockLoadActivitiesSummary.mockReset();
    mockListConsultants.mockReset().mockResolvedValue([]);
  });

  it('exporta CSV com cabeçalho e linhas esperadas', async () => {
    mockLoadActivitiesSummary.mockResolvedValue({ total: 0 });
    mockLoadActivitiesPage.mockResolvedValue({ rows: [], nextCursor: null });
    mockLoadActivitiesForExport.mockResolvedValue([
      {
        id: 'a1',
        title: 'Workshop Integração',
        activityType: 'workshop',
        format: 'presencial',
        status: 'agendada',
        date: '2026-03-23',
        startTime: '10:00',
        endTime: '11:30',
        startAt: '2026-03-23T10:00:00',
        endAt: '2026-03-23T11:30:00',
        durationMinutes: 90,
        location: 'CPC Faro',
        topics: ['Emprego'],
        consultantIds: ['c1'],
        consultantNames: ['Ana Silva'],
        participantMigrantIds: [],
        participantCompanyIds: [],
        participantConsultantIds: [],
        searchTokens: [],
      },
    ]);

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
    // @ts-expect-error override for test
    globalThis.Blob = MockBlob as unknown as typeof Blob;

    let capturedBlob: Blob | null = null;
    if (!('createObjectURL' in URL)) {
      // @ts-expect-error add polyfill for test
      URL.createObjectURL = () => 'blob:test';
    }
    if (!('revokeObjectURL' in URL)) {
      // @ts-expect-error add polyfill for test
      URL.revokeObjectURL = () => {};
    }
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    });
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <ActivitiesPage />
      </MemoryRouter>
    );

    await screen.findByText('Gestão de Atividades');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    await user.click(await screen.findByText('Exportar CSV'));

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();
    const csvText = await (capturedBlob as unknown as { text: () => Promise<string> }).text();

    expect(csvText).toContain('Nome,Tipo,Formato,Estado,Data,Início,Fim,Duração,Consultores,Temáticas,Local/Link');
    expect(csvText).toContain('Workshop Integração');
    expect(csvText).toContain('Workshop');
    expect(csvText).toContain('Presencial');
    expect(csvText).toContain('Publicado');
    expect(csvText).toContain('2026-03-23');
    expect(csvText).toContain('10:00');
    expect(csvText).toContain('11:30');
    expect(csvText).toContain('1h 30m');
    expect(csvText).toContain('Ana Silva');
    expect(csvText).toContain('Emprego');
    expect(csvText).toContain('CPC Faro');

    createObjectURLSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
    // @ts-expect-error restore
    globalThis.Blob = OriginalBlob;
  });

  it('abre janela imprimível para Exportar PDF contendo cabeçalho e tabela', async () => {
    mockLoadActivitiesSummary.mockResolvedValue({ total: 0 });
    mockLoadActivitiesPage.mockResolvedValue({ rows: [], nextCursor: null });
    mockLoadActivitiesForExport.mockResolvedValue([
      {
        id: 'a1',
        title: 'Focus Group Saúde',
        activityType: 'focus_group',
        format: 'online',
        status: 'concluida',
        date: '2026-03-20',
        startTime: '14:00',
        endTime: '15:00',
        startAt: '2026-03-20T14:00:00',
        endAt: '2026-03-20T15:00:00',
        durationMinutes: 60,
        location: 'https://meet.example.com',
        topics: ['Saúde'],
        consultantIds: ['c2'],
        consultantNames: ['Bruno Dias'],
        participantMigrantIds: [],
        participantCompanyIds: [],
        participantConsultantIds: [],
        searchTokens: [],
      },
    ]);

    let writtenHtml = '';
    const mockWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
      },
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(mockWindow);

    render(
      <MemoryRouter>
        <ActivitiesPage />
      </MemoryRouter>
    );

    await screen.findByText('Gestão de Atividades');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    await user.click(await screen.findByText('Exportar PDF'));

    expect(openSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(writtenHtml).toContain('<h1>Gestão de Atividades</h1>');
    });
    expect(writtenHtml).toMatch(/<table\s[^>]*class="[^"]*doc-branding-print-header/);
    expect(writtenHtml).toContain('<th>Nome</th>');
    expect(writtenHtml).toContain('Focus Group');
    expect(writtenHtml).toContain('Online');
    expect(writtenHtml).toContain('Concluída');

    openSpy.mockRestore();
  });
});
