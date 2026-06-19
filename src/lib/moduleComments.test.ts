import { describe, expect, it } from 'vitest';

import {
  buildNewModuleCommentPayload,
  filterCommentsForViewer,
  getCommentStatusLabel,
  isCommentVisibleToViewer,
  sortCommentsNewestFirst,
  type TrailModuleComment,
} from '@/lib/moduleComments';

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
});
