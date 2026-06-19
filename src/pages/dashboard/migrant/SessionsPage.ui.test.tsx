import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SessionsPage from './SessionsPage';

const mockAddDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockUpdateDocument = vi.fn();

const stableUser = { uid: 'm1' };

let sessionsFixture: Array<Record<string, unknown>> = [];
let supportRequestsFixture: Array<Record<string, unknown>> = [];

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: stableUser }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt', setLanguage: vi.fn(), t: { get: (key: string) => key } }),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  getCollection: vi.fn(async () => []),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div>Calendar</div>,
}));

describe('SessionsPage - UI/Interações (referência)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionsFixture = [];
    supportRequestsFixture = [];
    mockQueryDocuments.mockImplementation(async (collectionName: string) => {
      if (collectionName === 'support_requests') return supportRequestsFixture;
      if (collectionName === 'sessions') return sessionsFixture;
      return [];
    });
  });

  it('renderiza header, toggle Lista/Calendário e mostra próximas sessões por default', async () => {
    sessionsFixture = [
      {
        id: 's1',
        migrant_id: stableUser.uid,
        session_type: 'jurista',
        scheduled_date: '2099-10-11',
        scheduled_time: '10:00',
        status: 'Agendada',
        service_id: 'legal',
        service_label: 'Aconselhamento jurídico',
        specialist_name: 'Sarah Johnson',
      },
    ];

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    expect(screen.getByText('Minhas Sessões')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-pressed', 'false');

    expect(screen.getByText('Minhas próximas sessões')).toBeInTheDocument();
    expect(screen.getByText('Aconselhamento jurídico')).toBeInTheDocument();
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
  });

  it('oculta sessões duplicadas com a mesma data, hora e especialista', async () => {
    sessionsFixture = [
      {
        id: 's1',
        migrant_id: stableUser.uid,
        session_type: 'jurista',
        scheduled_date: '2099-10-11',
        scheduled_time: '10:00',
        status: 'Agendada',
        service_id: 'legal',
        service_label: 'Aconselhamento jurídico',
        specialist_name: 'Sarah Johnson',
      },
      {
        id: 's2',
        migrant_id: stableUser.uid,
        session_type: 'jurista',
        scheduled_date: '2099-10-11',
        scheduled_time: '10:00',
        status: 'Agendada',
        service_id: 'legal',
        service_label: 'Aconselhamento jurídico',
        specialist_name: 'Sarah Johnson',
        support_request_id: 'sr1',
      },
    ];

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    expect(screen.getAllByText('Aconselhamento jurídico')).toHaveLength(1);
    expect(screen.getAllByText('Sarah Johnson')).toHaveLength(1);
  });

  it('permite alternar para o modo calendário', async () => {
    const user = userEvent.setup();

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    expect(screen.getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Sessões do dia')).toBeInTheDocument();
  });

  it('permite cancelar uma sessão quando aplicável', async () => {
    const user = userEvent.setup();
    sessionsFixture = [
      {
        id: 's1',
        migrant_id: stableUser.uid,
        session_type: 'psicologa',
        scheduled_date: '2099-10-11',
        scheduled_time: '10:00',
        status: 'Agendada',
        service_id: 'psychology',
        service_label: 'Apoio psicológico',
        specialist_name: 'Dra. Amina',
      },
    ];

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
    await user.click(cancelButton);

    expect(mockUpdateDocument).toHaveBeenCalledWith('sessions', 's1', { status: 'Cancelada' });
  });

  it('sessões canceladas ou passadas aparecem apenas no histórico', async () => {
    sessionsFixture = [
      {
        id: 's-upcoming',
        migrant_id: stableUser.uid,
        session_type: 'jurista',
        scheduled_date: '2099-10-11',
        scheduled_time: '10:00',
        status: 'Agendada',
        service_id: 'legal',
        service_label: 'Aconselhamento jurídico',
        specialist_name: 'Sarah Johnson',
      },
      {
        id: 's-cancelled',
        migrant_id: stableUser.uid,
        session_type: 'psicologa',
        scheduled_date: '2099-10-12',
        scheduled_time: '11:00',
        status: 'Cancelada',
        service_id: 'psychology',
        service_label: 'Apoio psicológico',
        specialist_name: 'Dra. Amina',
      },
      {
        id: 's-past',
        migrant_id: stableUser.uid,
        session_type: 'mediador',
        scheduled_date: '2020-01-01',
        scheduled_time: '09:00',
        status: 'Agendada',
        service_id: 'mediation',
        service_label: 'Mediação',
        specialist_name: 'João',
      },
    ];

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    const upcomingSection = screen.getByText('Minhas próximas sessões').closest('section');
    expect(upcomingSection).toBeTruthy();
    const upcoming = within(upcomingSection as HTMLElement);
    expect(upcoming.getByText('Sarah Johnson')).toBeInTheDocument();
    expect(upcoming.queryByText('Dra. Amina')).not.toBeInTheDocument();
    expect(upcoming.queryByText('João')).not.toBeInTheDocument();

    const historySection = screen.getByText('Histórico').closest('section');
    expect(historySection).toBeTruthy();
    const history = within(historySection as HTMLElement);
    expect(history.getByText('Dra. Amina')).toBeInTheDocument();
    expect(history.getByText('João')).toBeInTheDocument();
  });

  it('mostra pedidos de apoio recusados no histórico', async () => {
    supportRequestsFixture = [
      {
        id: 'sr-rejected',
        migrant_id: stableUser.uid,
        type: 'juridico',
        description: 'Pedido recusado',
        status: 'cancelado',
        created_at: '2026-06-10T10:00:00.000Z',
        updated_at: '2026-06-11T12:00:00.000Z',
      },
    ];

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    const historySection = screen.getByText('Histórico').closest('section');
    expect(historySection).toBeTruthy();
    const history = within(historySection as HTMLElement);
    expect(history.getByText('Aconselhamento jurídico')).toBeInTheDocument();
    expect(history.getByText('Recusado')).toBeInTheDocument();
  });

  it('abre o wizard ao clicar em Marcar sessão no card de especialistas', async () => {
    const user = userEvent.setup();

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    const specialistsSection = screen.getByText('Especialistas disponíveis').closest('section');
    expect(specialistsSection).toBeTruthy();

    const section = within(specialistsSection as HTMLElement);
    const firstCardButton = section.getAllByRole('button', { name: 'Marcar sessão' })[0];
    await user.click(firstCardButton);

    expect(screen.getByText('Etapa 2 de 4')).toBeInTheDocument();
  });
});

