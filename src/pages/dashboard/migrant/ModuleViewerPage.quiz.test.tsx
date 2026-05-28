import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ModuleViewerPage from './ModuleViewerPage';

const mockAddDocument = vi.fn();
const mockGetDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockUpdateDocument = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u-m1' },
    profile: { name: 'Ana', avatar_url: null },
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
  return {
    useLanguage: () => ({
      language: 'pt',
      setLanguage: vi.fn(),
      t: { get },
    }),
  };
});

vi.mock('@/integrations/firebase/firestore', () => ({
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
}));

const QUIZ_MODULE = {
  id: 'mod-quiz-1',
  trail_id: 'trail-1',
  title: 'Quiz sobre direitos',
  content_type: 'quiz',
  content_text: null,
  content_url: null,
  duration_minutes: 5,
  order_index: 1,
  quiz_questions: [
    {
      id: 'q1',
      question: 'Quantas horas é a jornada padrão?',
      options: ['8h', '10h', '12h'],
      correctIndex: 0,
    },
    {
      id: 'q2',
      question: 'Idade mínima para trabalhar?',
      options: ['14', '16', '18'],
      correctIndex: 1,
    },
  ],
  quiz_passing_score: 70,
};

const TRAIL = { id: 'trail-1', title: 'Trilha', modules_count: 2, category: 'rights' };

function setupMocks(opts?: { existingAttempts?: Array<{ passed: boolean }> }) {
  mockGetDocument.mockImplementation(async (col: string, id: string) => {
    if (col === 'trail_modules' && id === QUIZ_MODULE.id) return QUIZ_MODULE;
    if (col === 'trails' && id === TRAIL.id) return TRAIL;
    return null;
  });
  mockQueryDocuments.mockImplementation(async (col: string, filters: Array<{ field: string; value: unknown }>) => {
    if (col === 'trail_modules') return [QUIZ_MODULE];
    if (col === 'user_trail_progress') {
      const isUserScoped = filters?.some((f) => f.field === 'user_id');
      return isUserScoped ? [] : [];
    }
    if (col === 'quiz_attempts') {
      return (opts?.existingAttempts ?? []).map((a, idx) => ({
        id: `att-${idx}`,
        user_id: 'u-m1',
        module_id: QUIZ_MODULE.id,
        trail_id: TRAIL.id,
        score: a.passed ? 100 : 0,
        passed: a.passed,
        answers: [],
        created_at: new Date(2026, 0, idx + 1).toISOString(),
      }));
    }
    return [];
  });
}

async function renderViewer() {
  render(
    <MemoryRouter initialEntries={[`/dashboard/migrante/trilhas/${TRAIL.id}/modulo/${QUIZ_MODULE.id}`]}>
      <Routes>
        <Route
          path="/dashboard/migrante/trilhas/:trailId/modulo/:moduleId"
          element={<ModuleViewerPage />}
        />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByTestId('quiz-viewer-block');
}

describe('ModuleViewerPage — quiz viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDocument.mockResolvedValue('new-attempt-id');
  });

  it('renderiza as perguntas e desabilita submit até todas estarem respondidas', async () => {
    setupMocks();
    await renderViewer();

    expect(screen.getByText('Quantas horas é a jornada padrão?')).toBeInTheDocument();
    expect(screen.getByText('Idade mínima para trabalhar?')).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: /Submeter respostas/i });
    expect(submit).toBeDisabled();
  });

  it('passa o quiz com 100% e marca módulo como concluído (incrementTrailProgress)', async () => {
    setupMocks();
    const user = userEvent.setup();
    await renderViewer();

    // Responde as duas corretas: q1 = "8h" (idx 0), q2 = "16" (idx 1).
    await user.click(screen.getByLabelText('8h'));
    await user.click(screen.getByLabelText('16'));

    const submit = screen.getByRole('button', { name: /Submeter respostas/i });
    expect(submit).not.toBeDisabled();
    await user.click(submit);

    // Resultado mostrado (Aprovado, Nota: 100%).
    expect(await screen.findByRole('status')).toHaveTextContent(/Aprovado/);
    expect(screen.getByRole('status')).toHaveTextContent(/100%/);

    // Tentativa gravada em quiz_attempts.
    expect(mockAddDocument).toHaveBeenCalledWith(
      'quiz_attempts',
      expect.objectContaining({
        user_id: 'u-m1',
        module_id: QUIZ_MODULE.id,
        trail_id: TRAIL.id,
        score: 100,
        passed: true,
      })
    );
    // Progresso da trilha incrementado (sem doc existente → addDocument em user_trail_progress).
    await waitFor(() => {
      expect(mockAddDocument).toHaveBeenCalledWith(
        'user_trail_progress',
        expect.objectContaining({
          user_id: 'u-m1',
          trail_id: TRAIL.id,
          modules_completed: 1,
        })
      );
    });
  });

  it('reprova com nota < passing_score e NÃO marca módulo como concluído', async () => {
    setupMocks();
    const user = userEvent.setup();
    await renderViewer();

    // q1 errada (10h em vez de 8h), q2 errada (14 em vez de 16) → 0%.
    await user.click(screen.getByLabelText('10h'));
    await user.click(screen.getByLabelText('14'));
    await user.click(screen.getByRole('button', { name: /Submeter respostas/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Reprovado/);
    expect(screen.getByRole('status')).toHaveTextContent(/0%/);

    // quiz_attempts gravado com passed=false.
    expect(mockAddDocument).toHaveBeenCalledWith(
      'quiz_attempts',
      expect.objectContaining({ passed: false, score: 0 })
    );
    // Nenhum write em user_trail_progress.
    expect(mockAddDocument).not.toHaveBeenCalledWith('user_trail_progress', expect.anything());
    expect(mockUpdateDocument).not.toHaveBeenCalledWith('user_trail_progress', expect.anything(), expect.anything());
  });

  it('NÃO re-incrementa progresso se já tinha passado antes', async () => {
    setupMocks({ existingAttempts: [{ passed: true }] });
    const user = userEvent.setup();
    await renderViewer();

    // Aguarda histórico carregar (1 tentativa prévia mostrada).
    await waitFor(() => {
      expect(screen.getByText(/Tentativas anteriores \(1\)/)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('8h'));
    await user.click(screen.getByLabelText('16'));
    await user.click(screen.getByRole('button', { name: /Submeter respostas/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Aprovado/);

    // Apenas quiz_attempts é gravado; user_trail_progress NÃO toca.
    const addCalls = mockAddDocument.mock.calls.map((c) => c[0]);
    expect(addCalls).toContain('quiz_attempts');
    expect(addCalls).not.toContain('user_trail_progress');
  });

  it('botão "Tentar novamente" limpa o resultado e permite repetir', async () => {
    setupMocks();
    const user = userEvent.setup();
    await renderViewer();

    await user.click(screen.getByLabelText('10h'));
    await user.click(screen.getByLabelText('14'));
    await user.click(screen.getByRole('button', { name: /Submeter respostas/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Reprovado/);
    await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    // Resultado desaparece e botão Submeter volta a aparecer (disabled, pois answers resetadas).
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
    expect(screen.getByRole('button', { name: /Submeter respostas/i })).toBeDisabled();
  });
});
