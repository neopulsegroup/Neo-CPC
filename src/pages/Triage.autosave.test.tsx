import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Triage from './Triage';
import { makeTriageDraft } from '@/lib/triageDraft';

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1' },
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      triage: {
        title: 'Situação Inicial',
        step_count: 'Passo {current} de {total}',
        next: 'Próximo',
        back: 'Voltar',
        confirm: 'Confirmar',
        select_placeholder: 'Selecione uma opção',
        success: 'OK',
      },
      get: (key: string) => key,
    },
  }),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: vi.fn(async () => null),
  setDocument: vi.fn(async () => undefined),
  updateDocument: vi.fn(async () => undefined),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Triage autosave progressivo', () => {
  it('guarda localmente e restaura respostas e passo', async () => {
    localStorage.clear();

    const { unmount } = render(
      <MemoryRouter>
        <Triage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Situação Inicial')).toBeInTheDocument();

    const birthLabel = screen.getByText('triage.questions.birth_date');
    const birthInput = birthLabel.parentElement?.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(birthInput).toBeTruthy();

    fireEvent.change(birthInput as HTMLInputElement, { target: { value: '2000-01-01' } });
    await waitFor(() => {
      expect(localStorage.getItem('triage:draft:v1:u1')).toBeTruthy();
    });

    const raw = localStorage.getItem('triage:draft:v1:u1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as { answers?: Record<string, unknown>; stepId?: string };
    expect(parsed.answers?.birth_date).toBe('2000-01-01');

    unmount();

    const draft = makeTriageDraft({
      formSignature: 'deadbeef',
      updatedAt: '2026-03-12T10:00:00.000Z',
      revision: 10,
      stepId: 'contacts',
      answers: { phone: '+351912345678', contact_preference: 'email' },
      writerId: 'w-test',
    });
    localStorage.setItem('triage:draft:v1:u1', JSON.stringify(draft));

    render(
      <MemoryRouter>
        <Triage />
      </MemoryRouter>
    );

    expect(await screen.findByText('triage.steps.contacts')).toBeInTheDocument();
  });
});
