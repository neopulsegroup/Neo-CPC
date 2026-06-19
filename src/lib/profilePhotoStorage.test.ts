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
  buildProfilePhotoStoragePath,
  deleteProfilePhotoFromStorage,
  resolveProfilePhotoStoragePath,
} from '@/lib/profilePhotoStorage';

describe('profilePhotoStorage', () => {
  beforeEach(() => {
    mockDeleteObject.mockReset().mockResolvedValue(undefined);
  });

  it('builds the canonical profile photo path', () => {
    expect(buildProfilePhotoStoragePath('u1')).toBe('profile_photos/u1');
  });

  it('resolves avatar paths from download url', () => {
    expect(
      resolveProfilePhotoStoragePath(
        'https://firebasestorage.googleapis.com/v0/b/app/o/profile_photos%2Fu1?alt=media',
        'u1'
      )
    ).toBe('profile_photos/u1');

    expect(
      resolveProfilePhotoStoragePath(
        'https://firebasestorage.googleapis.com/v0/b/app/o/profile_photos%2Fu1%2F1234-foto.png?alt=media',
        'u1'
      )
    ).toBe('profile_photos/u1/1234-foto.png');
  });

  it('ignores non-avatar profile_photos paths', () => {
    expect(
      resolveProfilePhotoStoragePath(
        'https://firebasestorage.googleapis.com/v0/b/app/o/profile_photos%2Fu1%2Ftrail_covers%2Fcover.webp?alt=media',
        'u1'
      )
    ).toBeNull();

    expect(
      resolveProfilePhotoStoragePath(
        'https://firebasestorage.googleapis.com/v0/b/app/o/profile_photos%2Fu1%2Fdocument_branding%2Fheader.png?alt=media',
        'u1'
      )
    ).toBeNull();
  });

  it('deletes profile photo from storage', async () => {
    await deleteProfilePhotoFromStorage(
      'https://firebasestorage.googleapis.com/v0/b/app/o/profile_photos%2Fu1?alt=media',
      'u1'
    );

    expect(mockDeleteObject).toHaveBeenCalledWith({ path: 'profile_photos/u1' });
  });

  it('ignores missing files', async () => {
    mockDeleteObject.mockRejectedValueOnce(new FirebaseError('storage/object-not-found', 'missing'));

    await expect(
      deleteProfilePhotoFromStorage(
        'https://firebasestorage.googleapis.com/v0/b/app/o/profile_photos%2Fu1?alt=media',
        'u1'
      )
    ).resolves.toBeUndefined();
  });
});
