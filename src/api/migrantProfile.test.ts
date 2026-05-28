import { describe, expect, it, vi } from 'vitest';

import { fetchMigrantProfile } from './migrantProfile';

vi.mock('@/integrations/firebase/auth', () => ({
  getUserProfile: vi.fn(async () => ({ email: 'a@b.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null })),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: vi.fn(async (collectionName: string) => {
    if (collectionName === 'profiles') {
      return { id: 'u1', name: 'Ana', email: 'a@b.com', phone: '+351900000000' };
    }
    if (collectionName === 'triage') {
      return { id: 'u1', userId: 'u1', legal_status: 'regularized' };
    }
    if (collectionName === 'trails') {
      return { id: 't1', title: 'Trilha 1', modules_count: 3 };
    }
    return null;
  }),
  queryDocuments: vi.fn(async (collectionName: string) => {
    if (collectionName === 'sessions') {
      return [{ id: 's1', migrant_id: 'u1', session_type: 'mediador', scheduled_date: '2026-01-01', scheduled_time: '10:00' }];
    }
    if (collectionName === 'user_trail_progress') {
      return [{ id: 'p1', user_id: 'u1', trail_id: 't1', progress_percent: 50, modules_completed: 1, completed_at: null }];
    }
    return [];
  }),
  updateDocument: vi.fn(async () => {}),
  serverTimestamp: () => ({ __type: 'serverTimestamp' }),
}));

describe('fetchMigrantProfile', () => {
  it('agrega perfil, triagem, sessões e progresso com detalhe de trilhas', async () => {
    const res = await fetchMigrantProfile('u1');

    expect(res.userProfile?.name).toBe('Ana');
    expect(res.profile?.email).toBe('a@b.com');
    expect(res.profile?.phone).toBe('+351900000000');
    expect(res.triage?.legal_status).toBe('regularized');
    expect(res.sessions).toHaveLength(1);
    expect(res.progress).toHaveLength(1);
    expect(res.trails.t1?.title).toBe('Trilha 1');
  });
});
