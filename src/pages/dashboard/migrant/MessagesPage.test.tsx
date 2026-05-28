import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import MigrantMessagesPage from './MessagesPage';

const mockToast = vi.fn();
const mockAddDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockServerTimestamp = vi.fn();
const mockSubscribeQuery = vi.fn();

let authState: { user?: { uid?: string }; profile?: { role?: string } } = { user: { uid: 'u-m1' }, profile: { role: 'migrant' } };

let conversationsNext: ((docs: unknown[]) => void) | null = null;
let messagesNext: ((docs: unknown[]) => void) | null = null;

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (...args: unknown[]) => mockToast(...args) }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
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

vi.mock('@/integrations/firebase/firestore', () => ({
  addDocument: (...args: unknown[]) => mockAddDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  serverTimestamp: (...args: unknown[]) => mockServerTimestamp(...args),
  subscribeQuery: (...args: unknown[]) => mockSubscribeQuery(...args),
}));

describe('MigrantMessagesPage (dashboard/migrante)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: { uid: 'u-m1' }, profile: { role: 'migrant' } };
    conversationsNext = null;
    messagesNext = null;
    mockServerTimestamp.mockReturnValue('ts');

    mockSubscribeQuery.mockImplementation((args: { collectionName: string; onNext: (docs: unknown[]) => void }) => {
      if (args.collectionName === 'conversations') conversationsNext = args.onNext;
      if (args.collectionName === 'conversation_messages') messagesNext = args.onNext;
      return () => {};
    });
  });

  it('bloqueia acesso para perfis não migrantes', async () => {
    authState = { user: { uid: 'u-x' }, profile: { role: 'company' } };
    render(
      <MemoryRouter>
        <MigrantMessagesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Sem permissão para aceder às mensagens.')).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há conversas', async () => {
    render(
      <MemoryRouter>
        <MigrantMessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(conversationsNext).not.toBeNull();
    });

    act(() => {
      conversationsNext?.([]);
    });

    expect(await screen.findByText('Sem conversas. Crie uma nova conversa para começar.')).toBeInTheDocument();
  });

  it('envia mensagem e atualiza conversa', async () => {
    mockAddDocument.mockResolvedValueOnce('m1');
    mockUpdateDocument.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <MigrantMessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(conversationsNext).not.toBeNull();
    });

    act(() => {
      conversationsNext?.([{ id: 'c1', title: 'Empresa X', participants: ['u-m1', 'u-c1'], updatedAt: 'ts' }]);
    });

    await waitFor(() => {
      expect(messagesNext).not.toBeNull();
    });
    act(() => {
      messagesNext?.([]);
    });

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Escreva a sua mensagem aqui...'), 'Olá!');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => {
      expect(mockAddDocument).toHaveBeenCalledWith(
        'conversation_messages',
        expect.objectContaining({
          conversation_id: 'c1',
          sender_id: 'u-m1',
          text: 'Olá!',
          created_at: 'ts',
        })
      );
    });
    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('conversations', 'c1', expect.objectContaining({ last_message_text: 'Olá!' }));
    });
  });
});
