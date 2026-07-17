import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildNewModuleCommentPayload,
  filterCommentsForViewer,
  getCommentStatusLabel,
  isCommentVisibleToViewer,
  queryApprovedTrailComments,
  queryModuleComments,
  sortCommentsNewestFirst,
  type TrailModuleComment,
} from '@/lib/moduleComments';

const mockQueryDocuments = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
}));

const baseComment = (overrides: Partial<TrailModuleComment>): TrailModuleComment => ({
  id: 'c1',
  trail_id: 't1',
  module_id: 'm1',
  user_id: 'u1',
  user_name: 'Ana',
  avatar_url: null,
  content: 'Olá',
  status: 'approved',
  created_at: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

describe('moduleComments', () => {
  beforeEach(() => {
    mockQueryDocuments.mockReset();
  });

  it('ordena comentários do mais recente para o mais antigo', () => {
    const sorted = sortCommentsNewestFirst([
      baseComment({ id: 'old', created_at: '2026-01-01T09:00:00.000Z' }),
      baseComment({ id: 'new', created_at: '2026-01-02T09:00:00.000Z' }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['new', 'old']);
  });

  it('mostra comentários aprovados a todos e pendentes/rejeitados só ao autor', () => {
    expect(isCommentVisibleToViewer(baseComment({ status: 'approved' }), 'u2')).toBe(true);
    expect(isCommentVisibleToViewer(baseComment({ status: 'pending' }), 'u1')).toBe(true);
    expect(isCommentVisibleToViewer(baseComment({ status: 'pending' }), 'u2')).toBe(false);
    expect(isCommentVisibleToViewer(baseComment({ status: 'rejected' }), 'u1')).toBe(true);
    expect(isCommentVisibleToViewer(baseComment({ status: 'rejected' }), 'u2')).toBe(false);
  });

  it('filtra lista visível para o migrante', () => {
    const visible = filterCommentsForViewer(
      [
        baseComment({ id: 'a', status: 'approved', user_id: 'u2', created_at: '2026-01-01T10:00:00.000Z' }),
        baseComment({ id: 'b', status: 'pending', user_id: 'u1', created_at: '2026-01-02T10:00:00.000Z' }),
        baseComment({ id: 'c', status: 'pending', user_id: 'u2', created_at: '2026-01-03T10:00:00.000Z' }),
      ],
      'u1'
    );
    expect(visible.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('cria payload pendente para novo comentário', () => {
    const payload = buildNewModuleCommentPayload({
      trailId: 't1',
      moduleId: 'm1',
      userId: 'u1',
      userName: 'Ana',
      content: '  Teste  ',
    });
    expect(payload.status).toBe('pending');
    expect(payload.content).toBe('Teste');
    expect(payload.trail_id).toBe('t1');
  });

  it('devolve rótulos de estado', () => {
    expect(getCommentStatusLabel('pending')).toBe('Em moderação');
    expect(getCommentStatusLabel('rejected')).toBe('Não aprovado');
    expect(getCommentStatusLabel('approved')).toBeNull();
  });

  it('queryModuleComments junta aprovados e próprios do viewer (alinhado às rules)', async () => {
    mockQueryDocuments.mockImplementation(async (_collection: string, filters: Array<{ field: string; value: unknown }>) => {
      const statusFilter = filters.find((f) => f.field === 'status');
      const userFilter = filters.find((f) => f.field === 'user_id');
      if (statusFilter?.value === 'approved') {
        return [
          baseComment({ id: 'approved-other', status: 'approved', user_id: 'u2', created_at: '2026-01-01T10:00:00.000Z' }),
          baseComment({ id: 'approved-own', status: 'approved', user_id: 'u1', created_at: '2026-01-02T10:00:00.000Z' }),
        ];
      }
      if (userFilter?.value === 'u1') {
        return [
          baseComment({ id: 'approved-own', status: 'approved', user_id: 'u1', created_at: '2026-01-02T10:00:00.000Z' }),
          baseComment({ id: 'pending-own', status: 'pending', user_id: 'u1', created_at: '2026-01-03T10:00:00.000Z' }),
        ];
      }
      return [];
    });

    const docs = await queryModuleComments('m1', 'u1');
    expect(docs.map((c) => c.id)).toEqual(['pending-own', 'approved-own', 'approved-other']);
    expect(mockQueryDocuments).toHaveBeenCalledTimes(2);
  });

  it('queryApprovedTrailComments filtra por trilha e status approved', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
      baseComment({ id: 'a1', status: 'approved', created_at: '2026-01-02T10:00:00.000Z' }),
      baseComment({ id: 'a2', status: 'approved', created_at: '2026-01-03T10:00:00.000Z' }),
    ]);

    const docs = await queryApprovedTrailComments('t1');
    expect(mockQueryDocuments).toHaveBeenCalledWith('trail_module_comments', [
      { field: 'trail_id', operator: '==', value: 't1' },
      { field: 'status', operator: '==', value: 'approved' },
    ]);
    expect(docs.map((c) => c.id)).toEqual(['a2', 'a1']);
  });
});
