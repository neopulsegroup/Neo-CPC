import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseError } from 'firebase/app';

const mockDeleteObject = vi.fn();

vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => ({ path }),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

vi.mock('@/integrations/firebase/client', () => ({
  storage: {},
}));

import {
  buildTrailModuleCoverPath,
  buildTrailModulePdfPath,
  deleteTrailModuleCoverFromStorage,
  resolveTrailModuleCoverPath,
} from '@/lib/trailModuleStorage';

describe('trailModuleStorage', () => {
  beforeEach(() => {
    mockDeleteObject.mockReset().mockResolvedValue(undefined);
  });

  it('builds storage paths for module assets', () => {
    expect(buildTrailModuleCoverPath('u1', 't1', 'm1', 'capa.png')).toMatch(
      /^profile_photos\/u1\/trail_module_covers\/t1_m1_\d+_capa\.png$/
    );
    expect(buildTrailModulePdfPath('u1', 't1', 'm1', 'doc.pdf')).toMatch(
      /^profile_photos\/u1\/trail_module_pdfs\/t1_m1_\d+_doc\.pdf$/
    );
  });

  it('resolves module cover path from stored path or url', () => {
    expect(
      resolveTrailModuleCoverPath('profile_photos/u1/trail_module_covers/t1_m1_capa.webp')
    ).toBe('profile_photos/u1/trail_module_covers/t1_m1_capa.webp');
  });

  it('deletes module cover and ignores missing files', async () => {
    await deleteTrailModuleCoverFromStorage('profile_photos/u1/trail_module_covers/old.webp');
    expect(mockDeleteObject).toHaveBeenCalledWith({ path: 'profile_photos/u1/trail_module_covers/old.webp' });

    mockDeleteObject.mockRejectedValueOnce(new FirebaseError('storage/object-not-found', 'missing'));
    await expect(
      deleteTrailModuleCoverFromStorage('profile_photos/u1/trail_module_covers/missing.webp')
    ).resolves.toBeUndefined();
  });
});
