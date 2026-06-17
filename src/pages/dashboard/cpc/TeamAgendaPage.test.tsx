import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TeamAgendaPage from './TeamAgendaPage';

let currentLanguage: 'pt' | 'en' | 'es' | 'fr' = 'pt';

const messages = {
  pt: {
    cpc: {
      agenda: {
        header: { today: 'Hoje', previous: 'Período anterior', next: 'Período seguinte', filterBy: 'Filtrar por', week: 'Semana', month: 'Mês', newSession: 'Nova sessão' },
        sessionTypes: { legal: 'Consulta Jurídica', psychology: 'Apoio Psicológico', mediation: 'Mediação', collective: 'Sessão Coletiva' },
        filter: { title: 'Categoria', all: 'Todas as categorias' },
        create: {
          title: 'Nova sessão',
          category: 'Categoria',
          migrant: 'Migrante',
          migrantSearch: 'Pesquisar migrante...',
          migrantPlaceholder: 'Selecione o migrante',
          loadingMigrants: 'A carregar migrantes...',
          noMigrants: 'Nenhum migrante encontrado',
          specialist: 'Especialista',
          specialistPlaceholder: 'Selecione o especialista',
          loadingSpecialists: 'A carregar especialistas...',
          noSpecialists: 'Nenhum especialista disponível nesta categoria',
          date: 'Data',
          time: 'Hora',
          cancel: 'Cancelar',
          submit: 'Criar sessão',
          success: 'Sessão criada com sucesso.',
          error: 'Não foi possível criar a sessão.',
          validation: 'Preencha todos os campos obrigatórios.',
        },
        weekdays: { mon: 'SEG', tue: 'TER', wed: 'QUA', thu: 'QUI', fri: 'SEX', sat: 'SÁB', sun: 'DOM' },
        pending: { title: 'Pedidos Pendentes', viewAll: 'Ver todos os pedidos', empty: 'Sem pedidos pendentes de aprovação.', requestSource: 'Pedido do migrante', noPermission: 'Apenas Consultores, Admins e Super Admins podem aprovar pedidos.', statusLabel: 'Em aprovação', approveSuccess: 'Pedido aprovado e sessão agendada.', approveError: 'Não foi possível aprovar o pedido.', declineSuccess: 'Pedido recusado.', declineError: 'Não foi possível recusar o pedido.' },
        actions: { approve: 'Aprovar', decline: 'Recusar', assignSlot: 'Atribuir horário', reschedule: 'Reagendar', cancel: 'Cancelar' },
        status: { approved: 'Aprovado', declined: 'Recusado', assigned: 'Horário atribuído' },
        eventModal: { close: 'Fechar' },
        sessionRecord: {
          open: 'Ver nota de sessão',
          breadcrumbs: { home: 'Início', migrants: 'Migrantes', record: 'Registo de Sessão' },
          header: { title: 'Registo de Sessão', dateTime: '24 de fevereiro, 2024 • 14:30', tech: 'Técnico: Sarah J.', saveDraft: 'Guardar rascunho' },
          profile: { name: 'Mateo Silva', initials: 'MS', idLabel: 'ID:', idValue: '#94821', statusActive: 'Ativo' },
          needs: { title: 'Necessidades identificadas', languageSupport: 'Apoio de Língua', cvWorkshop: 'Workshop de CV', housing: 'Habitação' },
          screening: {
            title: 'Resumo de Situação Inicial',
            p1: 'Admissão inicial realizada em 15 de jan de 2024. Mateo demonstra elevada motivação para emprego no setor da construção, especificamente carpintaria.',
            primaryChallengeLabel: 'Desafio principal:',
            primaryChallengeText: 'Nível atual de língua (A2) é insuficiente para requisitos de entrada em formação vocacional (necessário B1).',
            p2: 'Situação habitacional estável mas temporária. Solicitou apoio jurídico sobre reagrupamento familiar.',
          },
          activity: {
            title: 'Atividade recente',
            item1: { date: '10 fev, 2024', title: 'Participação em Workshop de CV', status: 'Concluído' },
            item2: { date: '28 jan, 2024', title: 'Avaliação de Língua', meta: 'Pontuação: A2' },
          },
          notes: {
            title: 'Notas da sessão',
            placeholder: 'Registe detalhes da conversa, objetivos definidos e observações aqui...',
            lastAutosaved: 'Último auto-guardar {relative}',
            justNow: 'agora mesmo',
            urgent: 'Marcar sessão como urgente',
            toolbar: { bold: 'Negrito', italic: 'Itálico', bullets: 'Lista', ordered: 'Lista numerada' },
          },
          outcomes: {
            title: 'Resultados e próximos passos',
            recommendTrack: 'Recomendar trilha formativa',
            immediateNextStep: 'Próximo passo imediato',
            selectTrackPlaceholder: 'Selecione uma trilha...',
            selectNextPlaceholder: 'Selecione o próximo passo...',
            track: { language: 'Português (B1)', career: 'Empregabilidade & CV', legal: 'Apoio jurídico' },
            next: { schedule: 'Agendar próxima sessão', docs: 'Solicitar documentos', referral: 'Encaminhar para serviço' },
            finalize: 'Finalizar e guardar',
          },
        },
        popover: {
          title: 'Acompanhamento de Trauma',
          person: 'Lucas Dubois',
          personMetaPrefix: 'ID: 4100',
          personMetaStatus: 'Estado: Ativo',
          dateTime: 'Qua, 25 Out • 13:00 - 14:00',
          specialist: 'Especialista: Dr. A. Rossi',
          notes: 'Utente reportou melhoria do sono. Foco nos fatores de stress de integração hoje.',
        },
        events: {
          'legal-consult': { title: 'Consulta Jurídica', subtitle: 'M. Al-Fayed (ID ...)' },
          'initial-assessment': { title: 'Avaliação Inicial', subtitle: 'S. Kovacs (ID ...)' },
          'family-mediation': { title: 'Mediação Familiar', subtitle: 'Família H. (Caso...)' },
          'workplace-conflict': { title: 'Conflito Laboral', subtitle: 'Caso #9912' },
          'follow-up': { title: 'Acompanhamento', subtitle: 'L. Dubois (ID: 4...)' },
        },
        requests: {
          r1: { category: 'JURÍDICO', title: 'Consulta de Recurso de Residência', person: 'Ahmed K.', team: 'Pedido Balcão', when: 'Seg, 30 Out • 10:00', timeAgo: 'há 2h' },
          r2: { category: 'PSICOLOGIA', title: 'Aconselhamento de Emergência', person: 'Nia J.', team: 'Pedido Assistente Social', when: '', timeAgo: 'há 5h', urgent: 'Urgente: ASAP' },
          r3: { category: 'MEDIAÇÃO', title: 'Resolução de Conflito', person: 'Marcus T.', team: 'Pedido Habitação', when: 'Qua, 1 Nov • 14:00', timeAgo: 'há 1d' },
        },
      },
    },
  },
  en: {
    cpc: {
      agenda: {
        header: { today: 'Today', filterBy: 'Filter by', week: 'Week', month: 'Month', newSession: 'New session' },
        weekdays: { mon: 'MON', tue: 'TUE', wed: 'WED', thu: 'THU', fri: 'FRI', sat: 'SAT', sun: 'SUN' },
        pending: { title: 'Pending Requests', viewAll: 'View All Requests' },
        actions: { approve: 'Approve', decline: 'Decline', assignSlot: 'Assign Slot', reschedule: 'Reschedule', cancel: 'Cancel' },
        status: { approved: 'Approved', declined: 'Declined', assigned: 'Slot assigned' },
        eventModal: { close: 'Close' },
        sessionRecord: {
          open: 'Session Record',
          breadcrumbs: { home: 'Home', migrants: 'Migrants', record: 'Session Record' },
          header: { title: 'Session Record', dateTime: 'February 24, 2024 • 14:30', tech: 'Tech: Sarah J.', saveDraft: 'Save Draft' },
          profile: { name: 'Mateo Silva', initials: 'MS', idLabel: 'ID:', idValue: '#94821', statusActive: 'Active' },
          needs: { title: 'Identified Needs', languageSupport: 'Language Support', cvWorkshop: 'CV Workshop', housing: 'Housing' },
          screening: {
            title: 'Screening Summary',
            p1: 'Initial intake conducted on Jan 15, 2024. Mateo shows high motivation for employment in the construction sector, specifically carpentry.',
            primaryChallengeLabel: 'Primary challenge:',
            primaryChallengeText: 'Current language proficiency (A2) is insufficient for vocational training entry requirements (B1 needed).',
            p2: 'Living situation is stable but temporary. Has requested legal assistance regarding family reunification paperwork.',
          },
          activity: {
            title: 'Recent Activity',
            item1: { date: 'Feb 10, 2024', title: 'CV Workshop Attendance', status: 'Completed' },
            item2: { date: 'Jan 28, 2024', title: 'Language Assessment', meta: 'Scored: A2' },
          },
          notes: {
            title: 'Session Notes',
            placeholder: 'Record the details of the conversation, goals set, and observations here...',
            lastAutosaved: 'Last auto-saved {relative}',
            justNow: 'just now',
            urgent: 'Mark session as Urgent',
            toolbar: { bold: 'Bold', italic: 'Italic', bullets: 'Bulleted list', ordered: 'Ordered list' },
          },
          outcomes: {
            title: 'Outcomes & Next Steps',
            recommendTrack: 'Recommend Training Track',
            immediateNextStep: 'Immediate Next Step',
            selectTrackPlaceholder: 'Select a track...',
            selectNextPlaceholder: 'Select next step...',
            track: { language: 'Portuguese (B1)', career: 'Employability & CV', legal: 'Legal support' },
            next: { schedule: 'Schedule next session', docs: 'Request documents', referral: 'Refer to service' },
            finalize: 'Finalize and Save',
          },
        },
        popover: {
          title: 'Trauma Follow-up',
          person: 'Lucas Dubois',
          personMetaPrefix: 'ID: 4100',
          personMetaStatus: 'Status: Active',
          dateTime: 'Wed, Oct 25 • 13:00 - 14:00',
          specialist: 'Specialist: Dr. A. Rossi',
          notes: 'Patient reported improved sleep patterns. Focus on integration stressors today.',
        },
        events: {
          'legal-consult': { title: 'Legal Consultation', subtitle: 'M. Al-Fayed (ID ...)' },
          'initial-assessment': { title: 'Initial Assessment', subtitle: 'S. Kovacs (ID ...)' },
          'family-mediation': { title: 'Family Mediation', subtitle: 'Family H. (Case...)' },
          'workplace-conflict': { title: 'Workplace Conflict', subtitle: 'Case #9912' },
          'follow-up': { title: 'Follow-up', subtitle: 'L. Dubois (ID: 4...)' },
        },
        requests: {
          r1: { category: 'LEGAL', title: 'Residency Appeal Consult', person: 'Ahmed K.', team: 'Req. Front Desk', when: 'Mon, Oct 30 • 10:00 AM', timeAgo: '2h ago' },
          r2: { category: 'PSYCHOLOGY', title: 'Emergency Counseling', person: 'Nia J.', team: 'Req. Social Worker', when: '', timeAgo: '5h ago', urgent: 'Urgent: ASAP' },
          r3: { category: 'MEDIATION', title: 'Conflict Resolution', person: 'Marcus T.', team: 'Req. Housing', when: 'Wed, Nov 1 • 14:00 PM', timeAgo: '1d ago' },
        },
      },
    },
  },
  es: {
    cpc: {
      agenda: {
        header: { today: 'Hoy', filterBy: 'Filtrar por', week: 'Semana', month: 'Mes', newSession: 'Nueva sesión' },
        weekdays: { mon: 'LUN', tue: 'MAR', wed: 'MIÉ', thu: 'JUE', fri: 'VIE', sat: 'SÁB', sun: 'DOM' },
        pending: { title: 'Solicitudes Pendientes', viewAll: 'Ver Todas las Solicitudes' },
        actions: { approve: 'Aprobar', decline: 'Rechazar', assignSlot: 'Asignar horario', reschedule: 'Reprogramar', cancel: 'Cancelar' },
        status: { approved: 'Aprobado', declined: 'Rechazado', assigned: 'Horario asignado' },
        eventModal: { close: 'Cerrar' },
        sessionRecord: {
          open: 'Registro de sesión',
          breadcrumbs: { home: 'Inicio', migrants: 'Migrantes', record: 'Registro de sesión' },
          header: { title: 'Registro de sesión', dateTime: '24 de febrero de 2024 • 14:30', tech: 'Técnico: Sarah J.', saveDraft: 'Guardar borrador' },
          profile: { name: 'Mateo Silva', initials: 'MS', idLabel: 'ID:', idValue: '#94821', statusActive: 'Activo' },
          needs: { title: 'Necesidades identificadas', languageSupport: 'Apoyo de idioma', cvWorkshop: 'Taller de CV', housing: 'Vivienda' },
          screening: {
            title: 'Resumen de evaluación',
            p1: 'Ingreso inicial realizado el 15 de ene de 2024. Mateo muestra alta motivación para empleo en el sector de la construcción, específicamente carpintería.',
            primaryChallengeLabel: 'Desafío principal:',
            primaryChallengeText: 'El nivel actual de idioma (A2) es insuficiente para requisitos de entrada a formación vocacional (se necesita B1).',
            p2: 'La situación de vivienda es estable pero temporal. Ha solicitado asistencia legal sobre documentación de reunificación familiar.',
          },
          activity: {
            title: 'Actividad reciente',
            item1: { date: '10 feb, 2024', title: 'Asistencia a taller de CV', status: 'Completado' },
            item2: { date: '28 ene, 2024', title: 'Evaluación de idioma', meta: 'Puntuación: A2' },
          },
          notes: {
            title: 'Notas de la sesión',
            placeholder: 'Registra los detalles de la conversación, objetivos definidos y observaciones aquí...',
            lastAutosaved: 'Último autoguardado {relative}',
            justNow: 'ahora mismo',
            urgent: 'Marcar sesión como urgente',
            toolbar: { bold: 'Negrita', italic: 'Cursiva', bullets: 'Lista con viñetas', ordered: 'Lista numerada' },
          },
          outcomes: {
            title: 'Resultados y próximos pasos',
            recommendTrack: 'Recomendar itinerario formativo',
            immediateNextStep: 'Próximo paso inmediato',
            selectTrackPlaceholder: 'Selecciona un itinerario...',
            selectNextPlaceholder: 'Selecciona el próximo paso...',
            track: { language: 'Portugués (B1)', career: 'Empleabilidad y CV', legal: 'Apoyo legal' },
            next: { schedule: 'Agendar próxima sesión', docs: 'Solicitar documentos', referral: 'Derivar a servicio' },
            finalize: 'Finalizar y guardar',
          },
        },
        popover: {
          title: 'Seguimiento de Trauma',
          person: 'Lucas Dubois',
          personMetaPrefix: 'ID: 4100',
          personMetaStatus: 'Estado: Activo',
          dateTime: 'Mié, 25 Oct • 13:00 - 14:00',
          specialist: 'Especialista: Dr. A. Rossi',
          notes: 'El paciente reportó mejora del sueño. Enfoque en factores de estrés de integración hoy.',
        },
        events: {
          'legal-consult': { title: 'Consulta Legal', subtitle: 'M. Al-Fayed (ID ...)' },
          'initial-assessment': { title: 'Evaluación Inicial', subtitle: 'S. Kovacs (ID ...)' },
          'family-mediation': { title: 'Mediación Familiar', subtitle: 'Familia H. (Caso...)' },
          'workplace-conflict': { title: 'Conflicto Laboral', subtitle: 'Caso #9912' },
          'follow-up': { title: 'Seguimiento', subtitle: 'L. Dubois (ID: 4...)' },
        },
        requests: {
          r1: { category: 'LEGAL', title: 'Consulta de Recurso de Residencia', person: 'Ahmed K.', team: 'Solicitud Recepción', when: 'Lun, 30 Oct • 10:00', timeAgo: 'hace 2h' },
          r2: { category: 'PSICOLOGÍA', title: 'Asesoramiento de Emergencia', person: 'Nia J.', team: 'Solicitud Trab. Social', when: '', timeAgo: 'hace 5h', urgent: 'Urgente: ASAP' },
          r3: { category: 'MEDIACIÓN', title: 'Resolución de Conflictos', person: 'Marcus T.', team: 'Solicitud Vivienda', when: 'Mié, 1 Nov • 14:00', timeAgo: 'hace 1d' },
        },
      },
    },
  },
};

function getPathValue(path: string) {
  const segments = path.split('.');
  let current: unknown = messages[currentLanguage];
  for (const segment of segments) {
    if (current == null || typeof current !== 'object' || !(segment in (current as Record<string, unknown>))) return path;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : path;
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: currentLanguage,
    setLanguage: (next: 'pt' | 'en' | 'es' | 'fr') => {
      currentLanguage = next;
    },
    t: {
      get: (path: string, params?: Record<string, string | number>) => interpolate(getPathValue(path), params),
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'cpc-consultant-1' },
    profile: { role: 'consultant', name: 'Consultor CPC' },
  }),
}));

vi.mock('@/integrations/firebase/firestore', () => {
  const todayIso = (() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  })();

  const sessions = [
    {
      id: 's1',
      migrant_id: 'm1',
      session_type: 'jurista',
      service_id: 'legal',
      service_label: 'Consulta Jurídica',
      specialist_name: 'Dr. A. Rossi',
      scheduled_date: todayIso,
      scheduled_time: '09:00',
      status: 'Agendada',
    },
    {
      id: 's2',
      migrant_id: 'm2',
      session_type: 'psicologa',
      service_id: 'psychology',
      service_label: 'Acompanhamento',
      specialist_name: 'Dr. M. Garcia',
      scheduled_date: todayIso,
      scheduled_time: '13:00',
      status: 'Agendada',
    },
    {
      id: 's3',
      migrant_id: 'm1',
      session_type: 'mediador',
      service_id: 'mediation',
      service_label: 'Mediação Familiar',
      specialist_name: 'Joana Pereira',
      scheduled_date: todayIso,
      scheduled_time: '11:00',
      status: 'pending_approval',
      created_at: new Date().toISOString(),
    },
  ];
  const profiles: Record<string, { name: string }> = {
    m1: { name: 'Ahmed Khan' },
    m2: { name: 'Lucas Dubois' },
  };
  const migrants = [
    { id: 'm1', role: 'migrant', name: 'Ahmed Khan' },
    { id: 'm2', role: 'migrant', name: 'Lucas Dubois' },
  ];
  const teamMembers = [
    { id: 'lawyer1', role: 'lawyer', name: 'Dr. A. Rossi', active: true },
    { id: 'psy1', role: 'psychologist', name: 'Dr. M. Garcia', active: true },
  ];

  return {
    queryDocuments: vi.fn(async (collectionName: string, filters?: Array<{ field: string; operator: string; value: unknown }>) => {
      if (collectionName === 'users') {
        const roleFilter = filters?.find((f) => f.field === 'role');
        if (roleFilter?.operator === 'in' && Array.isArray(roleFilter.value) && roleFilter.value.includes('migrant')) {
          return migrants;
        }
        return teamMembers;
      }
      return sessions;
    }),
    getDocument: vi.fn(async (collectionName: string, id: string) => {
      if (collectionName === 'profiles') return profiles[id] ?? null;
      if (collectionName === 'sessions') return sessions.find((session) => session.id === id) ?? null;
      return null;
    }),
    addDocument: vi.fn(async () => 's-new'),
    updateDocument: vi.fn(async () => undefined),
  };
});

describe('TeamAgendaPage', () => {
  it('renderiza topo com overflow oculto e textos contidos no container', async () => {
    currentLanguage = 'pt';
    render(<TeamAgendaPage />);

    const topBar = screen.getByText('Hoje').closest('div[class*="overflow-hidden"]');
    expect(topBar).toBeInTheDocument();
    expect(topBar?.className).toContain('overflow-hidden');
    expect(topBar?.className).not.toContain('overflow-x-auto');
    expect(screen.getByRole('button', { name: 'Nova sessão' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Acompanhamento/ })).toBeInTheDocument();
  });

  it('troca idioma dinamicamente para pt/en/es e mantém ações de pedidos funcionando', async () => {
    currentLanguage = 'pt';
    const { rerender } = render(<TeamAgendaPage />);

    expect(screen.getByText('Pedidos Pendentes')).toBeInTheDocument();
    expect(await screen.findByText('Mediação Familiar')).toBeInTheDocument();

    currentLanguage = 'en';
    rerender(<TeamAgendaPage />);
    expect(screen.getByText('Pending Requests')).toBeInTheDocument();

    currentLanguage = 'es';
    rerender(<TeamAgendaPage />);
    expect(screen.getByText('Solicitudes Pendientes')).toBeInTheDocument();

    currentLanguage = 'pt';
    rerender(<TeamAgendaPage />);

    const user = userEvent.setup();
    expect(screen.getAllByRole('button', { name: 'Aprovar' })).toHaveLength(1);
    await user.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]);
    expect(screen.queryAllByRole('button', { name: 'Aprovar' })).toHaveLength(0);
    expect(screen.getByText('Sem pedidos pendentes de aprovação.')).toBeInTheDocument();
  });

  it('mantém renderização estável em mobile, tablet e desktop sem overflow textual', async () => {
    currentLanguage = 'pt';

    const widths = [390, 768, 1366];
    for (const width of widths) {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
      window.dispatchEvent(new Event('resize'));
      const { unmount } = render(<TeamAgendaPage />);
      expect(screen.getByText('Pedidos Pendentes')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Nova sessão' })).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: /Acompanhamento/ })).toBeInTheDocument();
      unmount();
    }
  });

  it('carrega sessões reais e permite navegar e alternar entre semana e mês', async () => {
    currentLanguage = 'pt';
    render(<TeamAgendaPage />);

    const user = userEvent.setup();
    expect(await screen.findByRole('button', { name: /Acompanhamento/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Consulta Jurídica/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Período seguinte' }));
    expect(screen.queryByRole('button', { name: /Acompanhamento/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(await screen.findByRole('button', { name: /Acompanhamento/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mês' }));
    expect(screen.queryByRole('button', { name: /Acompanhamento/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Semana' }));
    expect(await screen.findByRole('button', { name: /Acompanhamento/ })).toBeInTheDocument();
  });

  it('filtra sessões por categoria', async () => {
    currentLanguage = 'pt';
    render(<TeamAgendaPage />);

    const user = userEvent.setup();
    expect(await screen.findByRole('button', { name: /Acompanhamento/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Consulta Jurídica/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtrar por' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Apoio Psicológico' }));

    expect(screen.getByRole('button', { name: 'Apoio Psicológico' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Consulta Jurídica/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acompanhamento/ })).toBeInTheDocument();
  });

  it('abre diálogo de criação de sessão com autocomplete de migrantes', async () => {
    currentLanguage = 'pt';
    render(<TeamAgendaPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Nova sessão' }));
    expect(screen.getByRole('heading', { name: 'Nova sessão' })).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();

    const migrantInput = screen.getByLabelText('Migrante');
    expect(migrantInput).toBeInTheDocument();
    await user.click(migrantInput);
    expect(await screen.findByRole('option', { name: 'Ahmed Khan' })).toBeInTheDocument();

    await user.clear(migrantInput);
    await user.type(migrantInput, 'Lucas');
    expect(await screen.findByRole('option', { name: 'Lucas Dubois' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ahmed Khan' })).not.toBeInTheDocument();
  });

  it('abre visualização de sessão a partir do calendário com todos os elementos do layout', async () => {
    currentLanguage = 'pt';
    render(<TeamAgendaPage />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Acompanhamento/ }));
    await user.click(screen.getByRole('button', { name: 'Ver nota de sessão' }));

    expect(screen.getByRole('heading', { name: 'Registo de Sessão' })).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('div[class*="overflow-y-auto"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar rascunho' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mateo Silva' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Necessidades identificadas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resumo de Situação Inicial' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atividade recente' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notas da sessão' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Registe detalhes da conversa, objetivos definidos e observações aqui...')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resultados e próximos passos' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Finalizar e guardar' }));
    expect(screen.queryByRole('heading', { name: 'Registo de Sessão' })).not.toBeInTheDocument();
  });
});
