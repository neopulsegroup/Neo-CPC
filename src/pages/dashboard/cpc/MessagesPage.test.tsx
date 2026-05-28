import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import CPCMessagesPage from './MessagesPage';

const mockToast = vi.fn();
const mockAddDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockServerTimestamp = vi.fn();
const mockSubscribeQuery = vi.fn();

const stableUser = { uid: 'u-cpc' };

let conversationsNext: ((docs: unknown[]) => void) | null = null;
let messagesNext: ((docs: unknown[]) => void) | null = null;

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (...args: unknown[]) => mockToast(...args) }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: stableUser }),
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

describe('CPCMessagesPage (dashboard/cpc)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stableUser.uid = 'u-cpc';
    conversationsNext = null;
    messagesNext = null;
    mockServerTimestamp.mockReturnValue('ts');

    mockSubscribeQuery.mockImplementation((args: { collectionName: string; onNext: (docs: unknown[]) => void }) => {
      if (args.collectionName === 'conversations') conversationsNext = args.onNext;
      if (args.collectionName === 'conversation_messages') messagesNext = args.onNext;
      return () => {};
    });
  });

  it('mostra estado vazio quando não há conversas', async () => {
    render(
      <MemoryRouter>
        <CPCMessagesPage />
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
        <CPCMessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(conversationsNext).not.toBeNull();
    });

    act(() => {
      conversationsNext?.([{ id: 'c1', title: 'Maria Oliveira', participants: ['u-cpc', 'u2'], updatedAt: 'ts' }]);
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
          sender_id: 'u-cpc',
          text: 'Olá!',
          created_at: 'ts',
        })
      );
    });
    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'conversations',
        'c1',
        expect.objectContaining({ last_message_text: 'Olá!' })
      );
    });

    act(() => {
      messagesNext?.([{ id: 'm1', conversation_id: 'c1', sender_id: 'u-cpc', text: 'Olá!', created_at: 'ts' }]);
    });
    expect(await screen.findByText('Olá!')).toBeInTheDocument();
  });

  it('cria conversa por email com validação e feedback', async () => {
    mockQueryDocuments.mockResolvedValueOnce([{ id: 'u2', email: 'maria@teste.com', name: 'Maria Oliveira' }]);
    mockAddDocument.mockResolvedValueOnce('c2');

    render(
      <MemoryRouter>
        <CPCMessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(conversationsNext).not.toBeNull();
    });
    act(() => {
      conversationsNext?.([]);
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nova' }));
    await user.type(screen.getByPlaceholderText('email@dominio.com'), 'maria@teste.com');
    await user.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => {
      expect(mockQueryDocuments).toHaveBeenCalledWith(
        'users',
        [{ field: 'email', operator: '==', value: 'maria@teste.com' }],
        undefined,
        1
      );
    });
    await waitFor(() => {
      expect(mockAddDocument).toHaveBeenCalledWith(
        'conversations',
        expect.objectContaining({
          participants: ['u-cpc', 'u2'],
          title: 'Maria Oliveira',
        })
      );
    });

    act(() => {
      conversationsNext?.([{ id: 'c2', title: 'Maria Oliveira', participants: ['u-cpc', 'u2'], updatedAt: 'ts' }]);
    });
    await waitFor(() => {
      expect(screen.getAllByText('Maria Oliveira').length).toBeGreaterThan(0);
    });
  });
});
