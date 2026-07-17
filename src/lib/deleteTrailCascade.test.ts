import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteTrailCascade } from './deleteTrailCascade';

const mockDeleteDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockQueryTrailModules = vi.fn();
const mockDeleteTrailCoverFromStorage = vi.fn();
const mockDeleteTrailModuleCoverFromStorage = vi.fn();
const mockDeleteTrailModulePdfFromStorage = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
}));

vi.mock('@/lib/trailModules', () => ({
  queryTrailModules: (...args: unknown[]) => mockQueryTrailModules(...args),
}));

vi.mock('@/lib/trailCoverStorage', () => ({
  deleteTrailCoverFromStorage: (...args: unknown[]) => mockDeleteTrailCoverFromStorage(...args),
}));

vi.mock('@/lib/trailModuleStorage', () => ({
  deleteTrailModuleCoverFromStorage: (...args: unknown[]) => mockDeleteTrailModuleCoverFromStorage(...args),
  deleteTrailModulePdfFromStorage: (...args: unknown[]) => mockDeleteTrailModulePdfFromStorage(...args),
}));

describe('deleteTrailCascade', () => {
  beforeEach(() => {
    mockDeleteDocument.mockReset().mockResolvedValue(undefined);
    mockQueryDocuments.mockReset().mockResolvedValue([]);
    mockQueryTrailModules.mockReset().mockResolvedValue([]);
    mockDeleteTrailCoverFromStorage.mockReset().mockResolvedValue(undefined);
    mockDeleteTrailModuleCoverFromStorage.mockReset().mockResolvedValue(undefined);
    mockDeleteTrailModulePdfFromStorage.mockReset().mockResolvedValue(undefined);
  });

  it('remove módulos, comentários, progresso, capa e a trilha', async () => {
    mockQueryTrailModules.mockResolvedValueOnce([
      {
        id: 'm1',
        content_type: 'pdf',
        cover_image_path: 'cover/m1.webp',
        content_path: 'pdf/m1.pdf',
      },
      {
        id: 'm2',
        content_type: 'video',
        cover_image_path: null,
        content_path: null,
      },
    ]);
    mockQueryDocuments.mockImplementation(async (collection: string) => {
      if (collection === 'trail_module_comments') return [{ id: 'c1' }];
      if (collection === 'user_trail_progress') return [{ id: 'p1' }];
      return [];
    });

    await deleteTrailCascade({
      id: 't1',
      image_path: 'covers/t1.jpg',
      image_url: 'https://example.com/t1.jpg',
    });

    expect(mockDeleteTrailModuleCoverFromStorage).toHaveBeenCalledWith('cover/m1.webp', undefined);
    expect(mockDeleteTrailModulePdfFromStorage).toHaveBeenCalledWith('pdf/m1.pdf', undefined);
    expect(mockDeleteDocument).toHaveBeenCalledWith('trail_modules', 'm1');
    expect(mockDeleteDocument).toHaveBeenCalledWith('trail_modules', 'm2');
    expect(mockDeleteDocument).toHaveBeenCalledWith('trail_module_comments', 'c1');
    expect(mockDeleteDocument).toHaveBeenCalledWith('user_trail_progress', 'p1');
    expect(mockDeleteTrailCoverFromStorage).toHaveBeenCalledWith('covers/t1.jpg', 'https://example.com/t1.jpg');
    expect(mockDeleteDocument).toHaveBeenCalledWith('trails', 't1');
  });
});
