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

vi.mock('@/integrations/firebase/functionsClient', () => ({
  functions: {},
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockCallable,
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
      if (collectionName === 'system_settings' && docId === 'smtp')
        return { id: 'smtp', host: 'smtp.exemplo.com', port: 587, security: 'tls', username: 'user', passwordSet: true, fromEmail: 'no-reply@cpc.pt' };
      return null;
    });
  });

  it('permite enfileirar teste SMTP e regista auditoria', async () => {
    const user = userEvent.setup();
    mockCallable.mockResolvedValueOnce({ data: { ok: true } });
    render(<CPCSettingsPage />);

    await screen.findByRole('heading', { name: 'Configurações' });

    await user.click(screen.getByRole('button', { name: 'Testar SMTP' }));

    await waitFor(() => {
      expect(mockCallable).toHaveBeenCalled();
      expect(mockAddDocument).toHaveBeenCalledWith('audit_logs', expect.objectContaining({ action: 'smtp_test_ok' }));
    });
  });
});
