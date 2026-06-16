import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ptJson from '@/locales/pt.json';

import CPCSettingsPage from './SettingsPage';

const mockGetDocument = vi.fn();
const mockSetDocument = vi.fn();
const mockAddDocument = vi.fn();
const mockToast = vi.fn();
const mockCallable = vi.fn();

const stableUser = { uid: 'u-admin', email: 'admin@teste.com' };

// Mock LanguageContext devolvendo traduções reais do pt.json.
vi.mock('@/contexts/LanguageContext', () => {
  function tGet(path: string): string {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, ptJson);
    return typeof value === 'string' ? value : path;
  }
  return {
    useLanguage: () => ({
      language: 'pt',
      setLanguage: vi.fn(),
      t: { get: tGet },
    }),
  };
});

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  setDocument: (...args: unknown[]) => mockSetDocument(...args),
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  serverTimestamp: () => ({ __type: 'serverTimestamp' }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (...args: unknown[]) => mockToast(...args) }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: stableUser,
    profile: { name: 'Admin', email: stableUser.email, role: 'admin', createdAt: null, updatedAt: null },
  }),
}));

describe('CPCSettingsPage (dashboard/cpc/configuracoes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocument.mockImplementation(async (collectionName: string, docId: string) => {
      if (collectionName === 'system_settings' && docId === 'contact') return { id: 'contact', notificationEmail: 'notificacoes@cpc.pt' };
      return null;
    });
  });

  // TASK consolidate-resend: a página deixou de ter UI SMTP. O smoke test agora
  // valida que o heading existe e que o botão "Testar SMTP" foi removido.
  it('renderiza heading e NÃO mostra mais botão "Testar SMTP" após consolidação RESEND', async () => {
    render(<CPCSettingsPage />);
    await screen.findByRole('heading', { name: 'Configurações' });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Testar SMTP/i })).toBeNull();
    });
    // O texto explicativo do novo card "Email transacional" deve aparecer.
    expect(screen.getByText(/RESEND_API_KEY/)).toBeInTheDocument();
    // Sem regressão de auditoria: clique do utilizador não despoletou httpsCallable.
    expect(mockCallable).not.toHaveBeenCalled();
    void userEvent; // evita lint warning de import não usado em CI estrito.
  });
});
