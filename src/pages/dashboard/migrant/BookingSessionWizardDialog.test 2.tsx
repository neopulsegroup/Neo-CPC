import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BookingSessionWizardDialog from './BookingSessionWizardDialog';
import type { ServiceArea } from '@/features/serviceAreas/serviceAreas';

const mockAddDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockGetCollection = vi.fn();

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt', setLanguage: vi.fn(), t: { get: (key: string) => key } }),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  getCollection: (...args: unknown[]) => mockGetCollection(...args),
  setDocument: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (d: Date) => void }) => (
    <button type="button" onClick={() => onSelect?.(new Date('2099-10-11T00:00:00.000Z'))}>
      Pick date
    </button>
  ),
}));

function legalArea(overrides: Partial<ServiceArea> = {}): ServiceArea {
  return {
    id: 'legal',
    name_key: 'serviceAreas.legal',
    responsible_uids: ['u-legal'],
    responsible_names: ['Dr. Legal'],
    default_duration_minutes: 30,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: 'admin',
    ...overrides,
  };
}

describe('BookingSessionWizardDialog - áreas de serviço', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialArea abre direto na etapa 2 e lista os responsáveis reais da área', async () => {
    mockGetCollection.mockResolvedValue([legalArea()]);

    render(<BookingSessionWizardDialog open onOpenChange={vi.fn()} userId="m1" initialArea="legal" />);

    expect(await screen.findByText('Etapa 2 de 4')).toBeInTheDocument();
    expect(await screen.findByText('Dr. Legal')).toBeInTheDocument();
  });

  it('área sem responsáveis mostra a mensagem de indisponibilidade e não lista especialistas', async () => {
    mockGetCollection.mockResolvedValue([legalArea({ responsible_uids: [], responsible_names: [] })]);

    render(<BookingSessionWizardDialog open onOpenChange={vi.fn()} userId="m1" initialArea="legal" />);

    expect(await screen.findByText('serviceAreas.areaUnavailable')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Legal')).not.toBeInTheDocument();
  });

  it('confirma a marcação gravando service_area_id e duration_minutes da área', async () => {
    const user = userEvent.setup();
    mockGetCollection.mockResolvedValue([legalArea({ default_duration_minutes: 60 })]);
    mockAddDocument.mockResolvedValueOnce({ id: 'new' });

    render(<BookingSessionWizardDialog open onOpenChange={vi.fn()} userId="m1" initialArea="legal" />);

    await user.click(await screen.findByText('Dr. Legal'));
    await user.click(screen.getByRole('button', { name: 'Próximo' }));

    expect(screen.getByText('Etapa 3 de 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pick date' }));

    const slotButton = screen
      .getAllByRole('button')
      .find((b) => /^\d{2}:\d{2}$/.test(b.textContent ?? '') && !(b as HTMLButtonElement).disabled);
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
      service_area_id: 'legal',
      service_area_name: 'serviceAreas.legal',
      duration_minutes: 60,
      specialist_name: 'Dr. Legal',
      consultant_uid: 'u-legal',
    });
  });
});
