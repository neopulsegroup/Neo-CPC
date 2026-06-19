import { describe, expect, it, vi } from 'vitest';

const mockQueryDocuments = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
}));

import { queryTrailModules, sortTrailModules } from '@/lib/trailModules';

describe('trailModules', () => {
  it('sorts modules by order_index', () => {
    const sorted = sortTrailModules([
      { id: 'm2', order_index: 2 },
      { id: 'm1', order_index: 1 },
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('queries trail_modules without server-side orderBy', async () => {
    mockQueryDocuments.mockResolvedValueOnce([
      { id: 'm2', order_index: 2 },
      { id: 'm1', order_index: 1 },
    ]);

    const modules = await queryTrailModules('trail-1');

    expect(mockQueryDocuments).toHaveBeenCalledWith('trail_modules', [
      { field: 'trail_id', operator: '==', value: 'trail-1' },
    ]);
    expect(modules.map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});
