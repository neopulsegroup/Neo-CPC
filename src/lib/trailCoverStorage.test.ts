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

import { deleteTrailCoverFromStorage, resolveTrailCoverStoragePath } from '@/lib/trailCoverStorage';

describe('trailCoverStorage', () => {
  beforeEach(() => {
    mockDeleteObject.mockReset().mockResolvedValue(undefined);
  });

  it('resolves path from image_path or download url', () => {
    expect(
      resolveTrailCoverStoragePath(
        'profile_photos/u1/trail_covers/old.jpg',
        'https://example.com/other'
      )
    ).toBe('profile_photos/u1/trail_covers/old.jpg');

    expect(
      resolveTrailCoverStoragePath(
        null,
        'https://firebasestorage.googleapis.com/v0/b/app/o/profile_photos%2Fu1%2Ftrail_covers%2Fcover.webp?alt=media'
      )
    ).toBe('profile_photos/u1/trail_covers/cover.webp');
  });

  it('deletes trail cover from storage', async () => {
    await deleteTrailCoverFromStorage('profile_photos/u1/trail_covers/old.jpg');

    expect(mockDeleteObject).toHaveBeenCalledWith({ path: 'profile_photos/u1/trail_covers/old.jpg' });
  });

  it('ignores missing files', async () => {
    mockDeleteObject.mockRejectedValueOnce(new FirebaseError('storage/object-not-found', 'missing'));

    await expect(
      deleteTrailCoverFromStorage('profile_photos/u1/trail_covers/missing.jpg')
    ).resolves.toBeUndefined();
  });
});
