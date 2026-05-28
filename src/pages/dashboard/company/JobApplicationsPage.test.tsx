import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => ({ jobId: 'job-1' }) };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'company-1' } }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt', t: { get: (k: string) => k } }),
}));

vi.mock('@/features/cv/CVUploadButton', () => ({
  CVUploadButton: ({ contextId }: { contextId: string }) => (
    <div data-testid="cv-upload" data-context={contextId}>upload</div>
  ),
}));

const mockGetDocument = vi.fn();
const mockQueryDocuments = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: (...a: unknown[]) => mockGetDocument(...a),
  queryDocuments: (...a: unknown[]) => mockQueryDocuments(...a),
  updateDocument: vi.fn(async () => undefined),
}));

import JobApplicationsPage from './JobApplicationsPage';

function setup(app: Record<string, unknown>, profile: Record<string, unknown> | null) {
  mockGetDocument.mockImplementation(async (collection: string) => {
    if (collection === 'job_offers') return { id: 'job-1', title: 'Vaga Teste', location: 'Faro' };
    if (collection === 'profiles') return profile;
    return null;
  });
  mockQueryDocuments.mockResolvedValue([app]);
  return render(
    <MemoryRouter>
      <JobApplicationsPage />
    </MemoryRouter>
  );
}

describe('JobApplicationsPage · CVs disponíveis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra os 3 CVs quando os 3 campos existem', async () => {
    setup(
      {
        id: 'app-1',
        applicant_id: 'mig-1',
        status: 'submitted',
        cover_letter: null,
        created_at: '2026-05-01T10:00:00Z',
        company_attached_cv_url: 'https://x/company.pdf',
        migrant_attached_cv_url: 'https://x/migrant.pdf',
      },
      { id: 'mig-1', name: 'Ana Silva', email: 'ana@x.com', resumeUrl: 'https://x/profile.pdf' }
    );

    const card = await screen.findByText('Ana Silva');
    await userEvent.click(card);

    // 1. CV do candidato (perfil)
    await waitFor(() => expect(screen.getByText('company.applications.details.viewCandidateCv')).toBeInTheDocument());
    // 2. CV anexado pelo migrante (label + link usam a mesma chave → pelo menos 1)
    expect(screen.getAllByText('applicationDetail.migrantAttachedCv').length).toBeGreaterThan(0);
    // 3. Upload da empresa (stub)
    expect(screen.getByTestId('cv-upload')).toHaveAttribute('data-context', 'app-1');
  });

  it('mostra apenas o CV do perfil quando não há CVs anexados', async () => {
    setup(
      {
        id: 'app-2',
        applicant_id: 'mig-2',
        status: 'submitted',
        cover_letter: null,
        created_at: '2026-05-01T10:00:00Z',
      },
      { id: 'mig-2', name: 'Bruno Costa', email: 'bruno@x.com', resumeUrl: 'https://x/profile2.pdf' }
    );

    const card = await screen.findByText('Bruno Costa');
    await userEvent.click(card);

    await waitFor(() => expect(screen.getByText('company.applications.details.viewCandidateCv')).toBeInTheDocument());
    // Sem CV anexado pelo migrante
    expect(screen.queryByText('applicationDetail.migrantAttachedCv')).toBeNull();
    // O upload da empresa está sempre disponível
    expect(screen.getByTestId('cv-upload')).toBeInTheDocument();
  });

  it('mostra "sem CV" quando o candidato não tem CV de perfil', async () => {
    setup(
      {
        id: 'app-3',
        applicant_id: 'mig-3',
        status: 'submitted',
        cover_letter: null,
        created_at: '2026-05-01T10:00:00Z',
      },
      { id: 'mig-3', name: 'Carla Dias', email: 'carla@x.com', resumeUrl: null }
    );

    const card = await screen.findByText('Carla Dias');
    await userEvent.click(card);

    await waitFor(() => expect(screen.getByText('company.applications.details.noCandidateCv')).toBeInTheDocument());
  });
});
