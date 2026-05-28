import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SessionsPage, {
  BookingConfirmationStep,
  BookingDateTimeStep,
  BookingServiceStep,
  BookingSpecialistStep,
  type BookingServiceOption,
  type BookingSpecialistOption,
} from './SessionsPage';

const mockAddDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockUpdateDocument = vi.fn();
const mockToast = vi.fn();

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
  toast: (...args: unknown[]) => mockToast(...args),
  useToast: () => ({ toast: (...args: unknown[]) => mockToast(...args) }),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (d: Date) => void }) => (
    <button type="button" onClick={() => onSelect?.(new Date('2099-10-11T00:00:00.000Z'))}>
      Pick date
    </button>
  ),
}));

describe('SessionsPage - wizard de marcação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('BookingServiceStep permite selecionar um serviço', async () => {
    const user = userEvent.setup();
    const services: BookingServiceOption[] = [
      { id: 'legal', title: 'Aconselhamento jurídico', description: 'Desc', priceLabel: 'Gratuito', specialistRoles: ['jurista'] },
      { id: 'psychology', title: 'Apoio psicológico', description: 'Desc', priceLabel: 'Gratuito', specialistRoles: ['psicologa'] },
    ];
    const onChange = vi.fn();

    render(<BookingServiceStep services={services} value={null} onChange={onChange} />);
    await user.click(screen.getByText('Apoio psicológico'));
    expect(onChange).toHaveBeenCalledWith('psychology');
  });

  it('BookingSpecialistStep permite selecionar um especialista', async () => {
    const user = userEvent.setup();
    const specialists: BookingSpecialistOption[] = [
      { id: 's1', name: 'Dra. Sarah Miller', role: 'jurista', languages: ['PT'], rating: 4.9, reviewCount: 10 },
      { id: 's2', name: 'Joana Pereira', role: 'mediador', languages: ['PT', 'EN'], rating: 4.8, reviewCount: 20 },
    ];
    const onChange = vi.fn();

    render(<BookingSpecialistStep specialists={specialists} value={null} onChange={onChange} />);
    await user.click(screen.getByText('Joana Pereira'));
    expect(onChange).toHaveBeenCalledWith('s2');
  });

  it('BookingDateTimeStep permite selecionar data e horário', async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    const onTimeChange = vi.fn();

    const { unmount } = render(
      <BookingDateTimeStep
        selectedDate={null}
        onDateChange={onDateChange}
        timeValue={null}
        onTimeChange={onTimeChange}
        specialistId="spec-med-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Pick date' }));
    expect(onDateChange).toHaveBeenCalled();
    unmount();

    render(
      <BookingDateTimeStep
        selectedDate={new Date('2099-10-11T00:00:00.000Z')}
        onDateChange={vi.fn()}
        timeValue={null}
        onTimeChange={onTimeChange}
        specialistId="spec-med-1"
      />,
    );

    const timeButtons = screen.getAllByRole('button').filter((b) => (b as HTMLButtonElement).disabled === false);
    const slotButton = timeButtons.find((b) => /^\d{2}:\d{2}$/.test(b.textContent ?? ''));
    expect(slotButton).toBeTruthy();
    await user.click(slotButton as HTMLElement);
    expect(onTimeChange).toHaveBeenCalled();
  });

  it('BookingConfirmationStep renderiza resumo completo', () => {
    const service: BookingServiceOption = {
      id: 'legal',
      title: 'Aconselhamento jurídico',
      description: 'Apoio legal',
      priceLabel: 'Gratuito',
      specialistRoles: ['jurista'],
    };
    const specialist: BookingSpecialistOption = {
      id: 's1',
      name: 'Dra. Sarah Miller',
      role: 'jurista',
      languages: ['PT'],
      rating: 4.9,
      reviewCount: 10,
    };

    render(<BookingConfirmationStep service={service} specialist={specialist} date={new Date('2099-10-11T00:00:00.000Z')} time="10:00" />);
    expect(screen.getByText('Aconselhamento jurídico')).toBeInTheDocument();
    expect(screen.getByText('Dra. Sarah Miller')).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });

  it('fluxo completo: abre modal, valida etapas e confirma marcação', async () => {
    const user = userEvent.setup();

    mockAddDocument.mockResolvedValueOnce({ id: 'new' });
    mockQueryDocuments.mockResolvedValueOnce([]);
    mockQueryDocuments.mockResolvedValueOnce([
      {
        id: 'sess-1',
        migrant_id: stableUser.uid,
        session_type: 'jurista',
        scheduled_date: '2099-10-11',
        scheduled_time: '10:00',
        status: 'Agendada',
        service_label: 'Aconselhamento jurídico',
      },
    ]);

    render(<SessionsPage />);

    await waitFor(() => expect(document.querySelector('.animate-spin')).toBeNull());

    await user.click(screen.getAllByRole('button', { name: /marcar sessão/i })[0]);

    expect(screen.getByText('Etapa 1 de 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Selecione um serviço/i);

    await user.click(screen.getByText('Aconselhamento jurídico'));
    await user.click(screen.getByRole('button', { name: 'Próximo' }));

    expect(screen.getByText('Etapa 2 de 4')).toBeInTheDocument();
    await user.click(screen.getByText('Dra. Sarah Miller'));
    await user.click(screen.getByRole('button', { name: 'Próximo' }));

    expect(screen.getByText('Etapa 3 de 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pick date' }));

    const slotButton = screen.getAllByRole('button').find((b) => /^\d{2}:\d{2}$/.test(b.textContent ?? '') && !(b as HTMLButtonElement).disabled);
    expect(slotButton).toBeTruthy();
    await user.click(slotButton as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Próximo' }));

    expect(screen.getByText('Etapa 4 de 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirmar marcação/i }));

    await waitFor(() => expect(mockAddDocument).toHaveBeenCalled());
    const [collection, payload] = mockAddDocument.mock.calls[0];
    expect(collection).toBe('sessions');
    expect(payload).toMatchObject({
      migrant_id: 'm1',
      service_id: 'legal',
      specialist_name: 'Dra. Sarah Miller',
      scheduled_date: '2099-10-11',
      status: 'Agendada',
    });

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Etapa 4 de 4')).not.toBeInTheDocument());

    expect(await screen.findByText('Aconselhamento jurídico')).toBeInTheDocument();
  });
});
