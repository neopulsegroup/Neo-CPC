import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CPCProfilePage from './ProfilePage';

const mockGetDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockRefreshProfile = vi.fn();
const mockToast = vi.fn();

const stableUser = { uid: 'u-cpc', email: 'cpc@teste.com' };

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
}));

vi.mock('@/integrations/firebase/auth', () => ({
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

vi.mock('@/integrations/firebase/client', () => ({
  storage: {},
}));

const mockStorageRef = vi.fn();
const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockStorageRef(...args),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (...args: unknown[]) => mockToast(...args) }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: stableUser,
    profile: { name: 'CPC', email: stableUser.email, role: 'admin', createdAt: null, updatedAt: null },
    profileData: { name: 'CPC', email: stableUser.email, phone: null, photoUrl: null },
    refreshProfile: mockRefreshProfile,
  }),
}));

vi.mock('@/contexts/LanguageContext', async () => {
  const { getTranslationStringAtPath, interpolateTranslation } = await vi.importActual<typeof import('@/lib/i18n')>(
    '@/lib/i18n'
  );

  const get = (path: string, params?: Record<string, string | number>) => {
    const template = getTranslationStringAtPath('pt', path) ?? path;
    return interpolateTranslation(template, params);
  };

  const wrap = (prefix = ''): unknown =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === 'get') return get;
          if (typeof prop !== 'string') return undefined;
          const next = prefix ? `${prefix}.${prop}` : prop;
          const value = getTranslationStringAtPath('pt', next);
          if (typeof value === 'string') return value;
          return wrap(next);
        },
      }
    );

  return {
    useLanguage: () => ({
      language: 'pt',
      setLanguage: vi.fn(),
      t: wrap() as unknown as Record<string, unknown> & { get: typeof get },
    }),
  };
});

describe('CPCProfilePage (dashboard/cpc)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stableUser.uid = 'u-cpc';
  });

  it('mostra loading e renderiza dados do perfil', async () => {
    mockGetDocument.mockResolvedValueOnce({ id: 'u-cpc', name: 'CPC', email: stableUser.email, phone: '+351900000000', photoUrl: null });

    render(<CPCProfilePage />);

    expect(document.querySelector('.animate-spin')).not.toBeNull();
    expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByText(stableUser.email)).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('valida nome obrigatório antes de guardar', async () => {
    mockGetDocument.mockResolvedValueOnce({ id: 'u-cpc', name: 'CPC', email: stableUser.email, phone: null, photoUrl: null });

    render(<CPCProfilePage />);
    await screen.findByRole('heading', { name: 'Perfil' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    const nameInput = screen.getByLabelText('Nome');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Validação', description: 'O nome é obrigatório.' })
    );
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it('guarda alterações e atualiza dados em Auth e Firestore', async () => {
    mockGetDocument.mockResolvedValueOnce({ id: 'u-cpc', name: 'CPC', email: stableUser.email, phone: null, photoUrl: null });
    mockUpdateUserProfile.mockResolvedValueOnce(undefined);
    mockUpdateDocument.mockResolvedValueOnce(undefined);

    render(<CPCProfilePage />);
    await screen.findByRole('heading', { name: 'Perfil' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.type(screen.getByLabelText('Nome'), ' Admin');
    await user.type(screen.getByLabelText('Telefone'), '910000000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith('u-cpc', expect.objectContaining({ name: expect.stringContaining('CPC') }));
    });
    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'profiles',
        'u-cpc',
        expect.objectContaining({ name: expect.any(String), phone: expect.any(String) })
      );
    });
    expect(mockRefreshProfile).toHaveBeenCalled();
  });

  it('mostra erro quando falha o carregamento', async () => {
    mockGetDocument.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    render(<CPCProfilePage />);

    expect(await screen.findByText('Sem permissões para carregar o seu perfil.')).toBeInTheDocument();
  });
});
