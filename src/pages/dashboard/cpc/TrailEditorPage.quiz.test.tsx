import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import TrailEditorPage from './TrailEditorPage';

const mockAddDocument = vi.fn();
const mockGetDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockUpdateDocument = vi.fn();
const mockDeleteDocument = vi.fn();

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
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
}));

describe('TrailEditorPage — quiz editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocument.mockResolvedValue({
      id: 'tr1',
      title: 'Trilha de Teste',
      description: 'desc',
      category: 'work',
      difficulty: 'beginner',
      duration_minutes: 0,
      modules_count: 0,
      is_active: true,
    });
    mockQueryDocuments.mockResolvedValue([]);
  });

  async function renderEditor() {
    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/trilhas/tr1/editar']}>
        <Routes>
          <Route path="/dashboard/cpc/trilhas/:trailId/editar" element={<TrailEditorPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('Editar Trilha');
  }

  it('mostra bloco de quiz quando content_type = quiz é selecionado', async () => {
    const user = userEvent.setup();
    await renderEditor();
    // Por defeito o select arranca em "video" — bloco quiz não existe.
    expect(screen.queryByTestId('quiz-editor-block')).toBeNull();

    // Seleciona Quiz no nativo <select>.
    const select = screen.getByLabelText('Tipo de conteúdo');
    await user.selectOptions(select, 'quiz');

    expect(await screen.findByTestId('quiz-editor-block')).toBeInTheDocument();
    expect(screen.getByText('Configuração do Quiz')).toBeInTheDocument();
    expect(screen.getByText('Pergunta 1')).toBeInTheDocument();
  });

  it('valida que pergunta vazia não submete (mostra erro)', async () => {
    const user = userEvent.setup();
    await renderEditor();
    await user.selectOptions(screen.getByLabelText('Tipo de conteúdo'), 'quiz');
    await user.type(screen.getByLabelText('Título *'), 'Quiz vazio');

    // Submeter sem preencher pergunta nem opções.
    await user.click(screen.getByRole('button', { name: /Adicionar módulo/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/precisa de texto/i);
    expect(mockAddDocument).not.toHaveBeenCalled();
  });

  it('valida que opção correta tem de estar marcada (cobre options preenchidas)', async () => {
    const user = userEvent.setup();
    await renderEditor();
    await user.selectOptions(screen.getByLabelText('Tipo de conteúdo'), 'quiz');
    await user.type(screen.getByLabelText('Título *'), 'Quiz simples');
    await user.type(screen.getByPlaceholderText('Digite a pergunta...'), 'O que é o EMPIS?');
    await user.type(screen.getByPlaceholderText('Opção 1'), 'Organização');
    await user.type(screen.getByPlaceholderText('Opção 2'), 'Pessoa');

    // Por defeito correctIndex é 0 (Opção 1 já está marcada). Submeter deve passar.
    await user.click(screen.getByRole('button', { name: /Adicionar módulo/i }));

    await waitFor(() => {
      expect(mockAddDocument).toHaveBeenCalledTimes(1);
    });
    const [collection, payload] = mockAddDocument.mock.calls[0];
    expect(collection).toBe('trail_modules');
    expect(payload).toMatchObject({
      content_type: 'quiz',
      quiz_passing_score: 70,
    });
    expect(payload.quiz_questions).toHaveLength(1);
    expect(payload.quiz_questions[0]).toMatchObject({
      question: 'O que é o EMPIS?',
      options: ['Organização', 'Pessoa'],
      correctIndex: 0,
    });
  });

  it('permite adicionar uma 2ª pergunta', async () => {
    const user = userEvent.setup();
    await renderEditor();
    await user.selectOptions(screen.getByLabelText('Tipo de conteúdo'), 'quiz');

    const addBtn = screen.getByRole('button', { name: /Adicionar pergunta/i });
    await user.click(addBtn);
    expect(screen.getByText('Pergunta 2')).toBeInTheDocument();
  });
});
