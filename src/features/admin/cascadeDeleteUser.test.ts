import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock antes do import do módulo que usa estes símbolos.
vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  getDocument: vi.fn(),
}));

import {
  queryDocuments,
  deleteDocument,
  getDocument,
} from '@/integrations/firebase/firestore';
import { cascadeDeleteUserData } from './cascadeDeleteUser';

const mockQuery = vi.mocked(queryDocuments);
const mockDelete = vi.mocked(deleteDocument);
const mockGet = vi.mocked(getDocument);

const UID = 'u-test-123';

describe('cascadeDeleteUserData', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockDelete.mockReset();
    mockGet.mockReset();
  });

  it('apaga linhas em todas as collections com referência ao uid e devolve relatório', async () => {
    // Mock queryDocuments por collection.
    mockQuery.mockImplementation(async (name: string, filters: unknown) => {
      void filters;
      if (name === 'sessions') return [{ id: 's1' }, { id: 's2' }];
      if (name === 'user_trail_progress') return [{ id: 'p1' }];
      if (name === 'job_applications') return [];
      if (name === 'notifications') return [{ id: 'n1' }];
      if (name === 'conversations') return [{ id: 'c1' }];
      if (name === 'conversation_messages') return [{ id: 'm1' }, { id: 'm2' }];
      return [];
    });
    // Existência por doc id.
    mockGet.mockImplementation(async (name: string, id: string) => {
      if (id !== UID) return null;
      if (name === 'profiles' || name === 'triage' || name === 'users') {
        return { id } as { id: string };
      }
      return null;
    });
    mockDelete.mockResolvedValue();

    const report = await cascadeDeleteUserData(UID);

    // Field-based collections.
    expect(mockDelete).toHaveBeenCalledWith('sessions', 's1');
    expect(mockDelete).toHaveBeenCalledWith('sessions', 's2');
    expect(mockDelete).toHaveBeenCalledWith('user_trail_progress', 'p1');
    expect(mockDelete).toHaveBeenCalledWith('notifications', 'n1');

    // Conversas + mensagens.
    expect(mockDelete).toHaveBeenCalledWith('conversation_messages', 'm1');
    expect(mockDelete).toHaveBeenCalledWith('conversation_messages', 'm2');
    expect(mockDelete).toHaveBeenCalledWith('conversations', 'c1');

    // Doc-id collections.
    expect(mockDelete).toHaveBeenCalledWith('profiles', UID);
    expect(mockDelete).toHaveBeenCalledWith('triage', UID);
    expect(mockDelete).toHaveBeenCalledWith('users', UID);

    // Relatório.
    const byCollection = Object.fromEntries(report.map((r) => [r.collection, r.deleted]));
    expect(byCollection).toMatchObject({
      sessions: 2,
      user_trail_progress: 1,
      job_applications: 0,
      notifications: 1,
      conversations: 1,
      conversation_messages: 2,
      profiles: 1,
      triage: 1,
      users: 1,
    });
  });

  it('relatório regista 0 para doc-id collections que não existem', async () => {
    mockQuery.mockResolvedValue([]);
    mockGet.mockResolvedValue(null);

    const report = await cascadeDeleteUserData('u-empty');
    const profiles = report.find((r) => r.collection === 'profiles');
    expect(profiles?.deleted).toBe(0);
    // Nada foi apagado.
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('quando includeCompanyDoc=true tenta apagar companies/{uid} também', async () => {
    mockQuery.mockResolvedValue([]);
    mockGet.mockImplementation(async (name: string, id: string) => {
      if (name === 'companies' && id === UID) return { id };
      return null;
    });

    const report = await cascadeDeleteUserData(UID, { includeCompanyDoc: true });
    expect(mockDelete).toHaveBeenCalledWith('companies', UID);
    expect(report.find((r) => r.collection === 'companies')?.deleted).toBe(1);
  });
});
