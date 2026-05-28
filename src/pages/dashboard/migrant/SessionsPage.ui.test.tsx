import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SessionsPage from './SessionsPage';

const mockAddDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockUpdateDocument = vi.fn();

const stableUser = { uid: 'm1' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: stableUser }),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
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
  });

  it('renderiza header, toggle Lista/Calendário e mostra próximas sessões por default', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
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
    ]);

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    expect(screen.getByText('Minhas Sessões')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-pressed', 'false');

    expect(screen.getByText('Minhas próximas sessões')).toBeInTheDocument();
    expect(screen.getByText('Aconselhamento jurídico')).toBeInTheDocument();
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
  });

  it('permite alternar para o modo calendário', async () => {
    const user = userEvent.setup();
    mockQueryDocuments.mockResolvedValueOnce([]);

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Calendário' }));
    expect(screen.getByRole('button', { name: 'Calendário' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Sessões do dia')).toBeInTheDocument();
  });

  it('permite cancelar uma sessão quando aplicável', async () => {
    const user = userEvent.setup();
    mockQueryDocuments.mockResolvedValueOnce([
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
    ]);

    render(<SessionsPage />);
    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
    await user.click(cancelButton);

    expect(mockUpdateDocument).toHaveBeenCalledWith('sessions', 's1', { status: 'Cancelada' });
  });

  it('abre o wizard ao clicar em Marcar sessão no card de especialistas', async () => {
    const user = userEvent.setup();
    mockQueryDocuments.mockResolvedValueOnce([]);

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

