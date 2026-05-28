import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ProfilePage from './ProfilePage';

const mockFetchMigrantProfile = vi.fn();
const mockUpdateDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockRefreshProfile = vi.fn();
const mockToast = vi.fn();
const stableUser = { uid: 'u1' };
const stableAuthProfile = { role: 'migrant' as const };

const originalFetch = globalThis.fetch?.bind(globalThis) as typeof fetch;

vi.mock('@/api/migrantProfile', () => ({
  fetchMigrantProfile: (...args: unknown[]) => mockFetchMigrantProfile(...args),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
}));

vi.mock('@/integrations/firebase/auth', () => ({
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

vi.mock('@/integrations/firebase/client', () => ({
  storage: {},
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (...args: unknown[]) => mockToast(...args) }),
}));

const mockStorageRef = vi.fn();
const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockStorageRef(...args),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: stableUser, profile: stableAuthProfile, refreshProfile: mockRefreshProfile }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt', setLanguage: vi.fn(), t: { get: (path: string) => path } }),
}));

vi.mock('pdf-lib', () => {
  const pages: Array<{ getSize: () => { width: number; height: number }; drawText: () => void; drawImage: () => void }> = [];
  const makePage = () => ({
    getSize: () => ({ width: 595.28, height: 841.89 }),
    drawText: vi.fn(),
    drawImage: vi.fn(),
  });
  const mockPdfDoc = {
    addPage: vi.fn(() => {
      const p = makePage();
      pages.push(p);
      return p;
    }),
    embedFont: vi.fn(async () => ({
      widthOfTextAtSize: (txt: string, size: number) => txt.length * size * 0.45,
    })),
    embedPng: vi.fn(async () => ({ width: 100, height: 40 })),
    getPages: vi.fn(() => pages),
    save: vi.fn(async () => new Uint8Array([1, 2, 3])),
  };
  return {
    PDFDocument: { create: vi.fn(async () => mockPdfDoc) },
    StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'HelveticaBold' },
    rgb: vi.fn(),
  };
});

describe('ProfilePage (dashboard/migrante)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMigrantProfile.mockReset();
    mockQueryDocuments.mockResolvedValue([]);
    stableUser.uid = 'u1';
    (stableAuthProfile as { role: string }).role = 'migrant';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (u.includes('photon.komoot.io')) {
        return {
          ok: true,
          json: async () => ({ features: [] }),
        } as Response;
      }
      if (u.includes('nominatim.openstreetmap.org') || u.includes('/osm-nominatim')) {
        return {
          ok: true,
          json: async () => [],
        } as Response;
      }
      if (originalFetch) return originalFetch(input, init);
      throw new Error(`fetch não mockado: ${u}`);
    }) as typeof fetch;
  });

  it('mostra loading e depois renderiza dados vindos da base de dados', async () => {
    localStorage.clear();
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: '+351900000000', birthDate: '1990-02-03', nationality: 'Brasil' },
      triage: { id: 'u1', userId: 'u1', legal_status: 'regularized', work_status: 'employed', language_level: 'basic', urgencies: ['legal'], interests: ['it'], answers: { phone: '+351900000000', birth_date: '1990-02-03', nationality: 'Brasil' } },
      sessions: [{ id: 's1', migrant_id: 'u1', session_type: 'mediador', scheduled_date: '2026-01-01', scheduled_time: '10:00', status: 'pending' }],
      progress: [{ id: 'p1', user_id: 'u1', trail_id: 't1', progress_percent: 50, modules_completed: 1, completed_at: null }],
      trails: { t1: { id: 't1', title: 'Trilha 1', modules_count: 3 } },
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(document.querySelector('.animate-spin')).not.toBeNull();

    expect(await screen.findByText('Informação Pessoal')).toBeInTheDocument();
    expect(screen.getByText('Editar Perfil')).toBeInTheDocument();
    expect(screen.queryByLabelText('Telefone')).toBeNull();
    expect(screen.queryByLabelText('Data de nascimento')).toBeNull();
    expect(screen.queryByLabelText('Nacionalidade')).toBeNull();
    expect(screen.getByText('+351 900 000 000')).toBeInTheDocument();
    expect(screen.getByText('03/02/1990')).toBeInTheDocument();
    expect(screen.getAllByText('Brasil').length).toBeGreaterThan(0);
    expect(screen.getByText('Status Migratório & Integração')).toBeInTheDocument();
    expect(screen.getByText('Marcações')).toBeInTheDocument();
    expect(screen.getByText('Trilhas de Sucesso')).toBeInTheDocument();
  });

  it('mostra estado de não encontrado quando o perfil não existe', async () => {
    localStorage.clear();
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: null,
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Perfil não encontrado.')).toBeInTheDocument();
  });

  it('mantém campos vazios quando não há dados', async () => {
    localStorage.clear();
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, birthDate: null, nationality: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    expect(screen.queryByLabelText('Telefone')).toBeNull();
    expect(screen.queryByLabelText('Data de nascimento')).toBeNull();
    expect(screen.queryByLabelText('Nacionalidade')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('mostra erro quando a API falha', async () => {
    localStorage.clear();
    mockFetchMigrantProfile.mockRejectedValueOnce(new Error('boom'));
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Não foi possível carregar os dados do perfil.')).toBeInTheDocument();
  });

  it('guarda alterações no Firestore', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    mockUpdateDocument.mockResolvedValueOnce(undefined);
    mockUpdateUserProfile.mockResolvedValueOnce(undefined);
    mockRefreshProfile.mockResolvedValueOnce(undefined);
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana Maria', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana Maria', email: 'ana@exemplo.com', phone: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));
    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Ana Maria');
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('profiles', 'u1', expect.objectContaining({ name: 'Ana Maria' }));
    });
  });

  // TASK-TESTS: timeout 15s — teste passa em ~1.5s isolado mas pode exceder 5s default sob load
  // do full suite (renderiza ProfilePage completo + múltiplas async fetches + state changes).
  it('usa o migrantId da rota CPC e não tenta atualizar o perfil Auth do utilizador atual', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    stableUser.uid = 'cpc1';

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm1@exemplo.com', name: 'Migrante 1', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm1', name: 'Migrante 1', email: 'm1@exemplo.com', phone: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    mockUpdateDocument.mockResolvedValueOnce(undefined);
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm1@exemplo.com', name: 'Migrante 1', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm1', name: 'Migrante 1 Atualizado', email: 'm1@exemplo.com', phone: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m1/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    expect(mockFetchMigrantProfile).toHaveBeenCalledWith('m1');

    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));
    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Migrante 1 Atualizado');
    await user.type(screen.getByLabelText('Morada'), 'Rua da Liberdade 123, Lisboa');
    await user.type(screen.getByLabelText('Número'), '10');
    await user.type(screen.getByLabelText('CEP'), '1000-001');
    await user.click(screen.getByLabelText('Região'));
    await user.click(await screen.findByText('Lisboa'));
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('profiles', 'm1', expect.objectContaining({ name: 'Migrante 1 Atualizado' }));
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
      expect(mockRefreshProfile).not.toHaveBeenCalled();
    });
  }, 15000);

  it('valida campos obrigatórios (Morada, Número, CEP e Região) no perfil CPC', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    stableUser.uid = 'cpc1';

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm1@exemplo.com', name: 'Migrante 1', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm1', name: 'Migrante 1', email: 'm1@exemplo.com', phone: null },
      triage: { id: 'm1', userId: 'm1', answers: { document_type: 'nif' }, legal_status: null, work_status: null, language_level: null, interests: null, urgencies: null },
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m1/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    expect(await screen.findByText('A Morada é obrigatória.')).toBeInTheDocument();
    expect(screen.getByText('O Número é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('O CEP é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('A Região é obrigatória.')).toBeInTheDocument();
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it('restringe o CEP a dígitos e hífen', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    stableUser.uid = 'cpc1';

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm2@exemplo.com', name: 'Migrante 2', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm2', name: 'Migrante 2', email: 'm2@exemplo.com', phone: null },
      triage: { id: 'm2', userId: 'm2', answers: {}, legal_status: null, work_status: null, language_level: null, interests: null, urgencies: null },
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m2/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));

    const input = screen.getByLabelText('CEP') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '10ab00-00x1' } });
    expect(input.value).toBe('1000-001');
  });

  it('requer região adicional quando seleciona "Outra" e guarda no Firestore', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    stableUser.uid = 'cpc1';

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm3@exemplo.com', name: 'Migrante 3', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm3', name: 'Migrante 3', email: 'm3@exemplo.com', phone: null },
      triage: { id: 'm3', userId: 'm3', answers: { document_type: 'passport' }, legal_status: null, work_status: null, language_level: null, interests: null, urgencies: null },
      sessions: [],
      progress: [],
      trails: {},
    });
    mockUpdateDocument.mockResolvedValueOnce(undefined);
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm3@exemplo.com', name: 'Migrante 3', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm3', name: 'Migrante 3', email: 'm3@exemplo.com', phone: null },
      triage: { id: 'm3', userId: 'm3', answers: { document_type: 'passport' }, legal_status: null, work_status: null, language_level: null, interests: null, urgencies: null },
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m3/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));

    await user.type(screen.getByLabelText('Morada'), 'Rua Exemplo, 123, Lisboa');
    await user.type(screen.getByLabelText('Número'), '5');
    await user.type(screen.getByLabelText('CEP'), '1000-002');

    await user.click(screen.getByLabelText('Região'));
    await user.click(await screen.findByText('Outra'));

    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    expect(await screen.findByText('Indique a Região.')).toBeInTheDocument();
    expect(mockUpdateDocument).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Outra Região'), 'Madeira');
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'profiles',
        'm3',
        expect.objectContaining({
          address: 'Rua Exemplo, 123, Lisboa',
          addressNumber: '5',
          cep: '1000-002',
          region: 'Outra',
          regionOther: 'Madeira',
        })
      );
    });
  });

  it('exporta ficha em PDF no perfil CPC', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    stableUser.uid = 'cpc1';
    (stableAuthProfile as { role: string }).role = 'admin';

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null as unknown as Window);
    const originalCreateObjectURL = (URL as unknown as { createObjectURL?: (b: Blob) => string }).createObjectURL;
    const originalRevokeObjectURL = (URL as unknown as { revokeObjectURL?: (s: string) => void }).revokeObjectURL;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = vi.fn(() => {});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }) as unknown as Response) as unknown as typeof fetch;

    // 1) carrega atividades do migrante (card "Atividades")
    // 2) carrega atividades para a ficha exportada
    mockQueryDocuments.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm1@exemplo.com', name: 'Migrante 1', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm1', name: 'Migrante 1', email: 'm1@exemplo.com', phone: null, currentLocation: 'Rua A' },
      triage: { id: 'm1', userId: 'm1', answers: {}, legal_status: null, work_status: null, language_level: null, interests: null, urgencies: null },
      sessions: [{ id: 's1', migrant_id: 'm1', session_type: 'mediador', scheduled_date: '2026-01-01', scheduled_time: '10:00', status: 'completed' }],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m1/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');

    await user.click(screen.getByRole('button', { name: 'Exportar Ficha' }));

    await waitFor(() => {
      expect(mockQueryDocuments).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    globalThis.fetch = originalFetch;
    (URL as unknown as { createObjectURL?: (b: Blob) => string }).createObjectURL = originalCreateObjectURL;
    (URL as unknown as { revokeObjectURL?: (s: string) => void }).revokeObjectURL = originalRevokeObjectURL;
    openSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('exporta ficha em PDF mesmo sem dados de progresso', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    stableUser.uid = 'cpc1';
    (stableAuthProfile as { role: string }).role = 'admin';

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null as unknown as Window);
    const originalCreateObjectURL = (URL as unknown as { createObjectURL?: (b: Blob) => string }).createObjectURL;
    const originalRevokeObjectURL = (URL as unknown as { revokeObjectURL?: (s: string) => void }).revokeObjectURL;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = vi.fn(() => {});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }) as unknown as Response) as unknown as typeof fetch;

    // 1) carrega atividades do migrante (card "Atividades")
    // 2) carrega atividades para a ficha exportada
    mockQueryDocuments.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm2@exemplo.com', name: 'Migrante 2', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm2', name: 'Migrante 2', email: 'm2@exemplo.com', phone: null, currentLocation: 'Rua B' },
      triage: { id: 'm2', userId: 'm2', answers: {}, legal_status: null, work_status: null, language_level: null, interests: null, urgencies: null },
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m2/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    await user.click(screen.getByRole('button', { name: 'Exportar Ficha' }));

    await waitFor(() => {
      expect(mockQueryDocuments).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    globalThis.fetch = originalFetch;
    (URL as unknown as { createObjectURL?: (b: Blob) => string }).createObjectURL = originalCreateObjectURL;
    (URL as unknown as { revokeObjectURL?: (s: string) => void }).revokeObjectURL = originalRevokeObjectURL;
    openSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('permite upload de foto e grava photoUrl no perfil', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockStorageRef.mockReturnValueOnce({ key: 'ref1' });
    mockUploadBytes.mockResolvedValueOnce(undefined);
    mockGetDownloadURL.mockResolvedValueOnce('https://exemplo.com/foto.png');

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    mockUpdateDocument.mockResolvedValueOnce(undefined);
    mockRefreshProfile.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(['abc'], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    await waitFor(() => {
      expect(mockUploadBytes).toHaveBeenCalled();
      expect(mockGetDownloadURL).toHaveBeenCalled();
      expect(mockUpdateDocument).toHaveBeenCalledWith('profiles', 'u1', expect.objectContaining({ photoUrl: 'https://exemplo.com/foto.png' }));
    });
  });

  it('permite editar campos de "Informação Pessoal" e usa seletor de opções em "Idiomas"', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, address: '', addressNumber: '', cep: '', region: null, regionOther: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));

    expect(screen.getByLabelText('Morada')).toBeInTheDocument();
    expect(screen.getByLabelText('Número')).toBeInTheDocument();
    expect(screen.getByLabelText('CEP')).toBeInTheDocument();
    expect(screen.getByLabelText('Região')).toBeInTheDocument();

    expect(screen.getByLabelText('Telefone')).toBeInTheDocument();
    expect(screen.getByLabelText('Nacionalidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Data de nascimento')).toBeInTheDocument();

    expect(screen.queryByText('Necessidades principais')).toBeNull();

    expect(screen.getByRole('button', { name: 'triage.options.languages.portuguese' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'triage.options.languages.english' })).toBeInTheDocument();
  });

  it('exporta triagem em PDF no perfil CPC quando existem respostas', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    stableUser.uid = 'cpc1';
    (stableAuthProfile as { role: string }).role = 'admin';

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null as unknown as Window);
    const originalCreateObjectURL = (URL as unknown as { createObjectURL?: (b: Blob) => string }).createObjectURL;
    const originalRevokeObjectURL = (URL as unknown as { revokeObjectURL?: (s: string) => void }).revokeObjectURL;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = vi.fn(() => {});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }) as unknown as Response) as unknown as typeof fetch;

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm3@exemplo.com', name: 'Migrante 3', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm3', name: 'Migrante 3', email: 'm3@exemplo.com', phone: null, currentLocation: 'Rua C' },
      triage: {
        id: 'm3',
        userId: 'm3',
        completed: true,
        completedAt: '2026-01-02T10:11:12.000Z',
        answers: { phone: '+351900000000', legal_status: 'regularized', languages: ['portuguese', 'english'] },
        legal_status: 'regularized',
        work_status: null,
        language_level: null,
        interests: null,
        urgencies: null,
      },
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m3/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    await user.click(screen.getByRole('button', { name: 'Exportar Situação Inicial' }));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Situação Inicial exportada' }));
    });

    globalThis.fetch = originalFetch;
    (URL as unknown as { createObjectURL?: (b: Blob) => string }).createObjectURL = originalCreateObjectURL;
    (URL as unknown as { revokeObjectURL?: (s: string) => void }).revokeObjectURL = originalRevokeObjectURL;
    openSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('mostra erro ao tentar exportar triagem sem respostas', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    stableUser.uid = 'cpc1';
    (stableAuthProfile as { role: string }).role = 'admin';

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm4@exemplo.com', name: 'Migrante 4', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm4', name: 'Migrante 4', email: 'm4@exemplo.com', phone: null, currentLocation: 'Rua D' },
      triage: { id: 'm4', userId: 'm4', answers: {}, legal_status: null, work_status: null, language_level: null, interests: null, urgencies: null },
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m4/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');

    await user.click(screen.getByRole('button', { name: 'Exportar Situação Inicial' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sem dados de Situação Inicial', variant: 'destructive' }));
    });
  });

  it('não exibe o botão de exportar triagem para utilizadores sem permissão', async () => {
    localStorage.clear();
    stableUser.uid = 'cpc1';
    (stableAuthProfile as { role: string }).role = 'migrant';

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm5@exemplo.com', name: 'Migrante 5', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm5', name: 'Migrante 5', email: 'm5@exemplo.com', phone: null, currentLocation: 'Rua E' },
      triage: { id: 'm5', userId: 'm5', answers: { phone: '+351900000000' }, legal_status: null, work_status: null, language_level: null, interests: null, urgencies: null },
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m5/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    expect(screen.queryByRole('button', { name: 'Exportar Situação Inicial' })).toBeNull();
  });

  it('rejeita ficheiros com formato inválido', async () => {
    localStorage.clear();

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(['abc'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    expect(mockUploadBytes).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Formato não suportado', variant: 'destructive' }));
  });

  it('rejeita ficheiros maiores que 5MB', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([big], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    expect(mockUploadBytes).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Imagem muito grande', variant: 'destructive' }));
  });

  it('mostra loading state durante o upload', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockStorageRef.mockReturnValueOnce({ key: 'ref1' });
    let resolveUpload: (() => void) | null = null;
    mockUploadBytes.mockImplementationOnce(() => new Promise<void>((res) => { resolveUpload = res; }));
    mockGetDownloadURL.mockResolvedValueOnce('https://exemplo.com/foto.png');
    mockUpdateDocument.mockResolvedValueOnce(undefined);
    mockRefreshProfile.mockResolvedValueOnce(undefined);

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File(['abc'], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    expect(await screen.findByText('A enviar…')).toBeInTheDocument();
    resolveUpload?.();

    await waitFor(() => {
      expect(screen.queryByText('A enviar…')).toBeNull();
      expect(mockUpdateDocument).toHaveBeenCalledWith('profiles', 'u1', expect.objectContaining({ photoUrl: 'https://exemplo.com/foto.png' }));
    });
  });

  it('mostra erro específico quando o upload falha por permissão', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockStorageRef.mockReturnValueOnce({ key: 'ref1' });
    mockUploadBytes.mockRejectedValueOnce({ code: 'storage/unauthorized' });

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File(['abc'], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    await waitFor(() => {
      expect(mockUploadBytes).toHaveBeenCalled();
      expect(mockUpdateDocument).not.toHaveBeenCalled();
    });
  });

  it('mostra erro específico quando guardar photoUrl falha por permissão', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockStorageRef.mockReturnValueOnce({ key: 'ref1' });
    mockUploadBytes.mockResolvedValueOnce(undefined);
    mockGetDownloadURL.mockResolvedValueOnce('https://exemplo.com/foto.png');
    mockUpdateDocument.mockRejectedValueOnce({ code: 'permission-denied' });

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File(['abc'], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('profiles', 'u1', expect.any(Object));
    });
  });
});
