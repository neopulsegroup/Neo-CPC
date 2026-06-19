import { FirebaseError } from 'firebase/app';
import { deleteObject, ref } from 'firebase/storage';

import { parseStoragePathFromDownloadUrl } from '@/features/cv/cvStoragePaths';
import { storage } from '@/integrations/firebase/client';

export function resolveTrailCoverStoragePath(
  imagePath?: string | null,
  imageUrl?: string | null
): string | null {
  const trimmedPath = typeof imagePath === 'string' ? imagePath.trim() : '';
  if (trimmedPath.includes('/trail_covers/')) return trimmedPath;

  if (typeof imageUrl === 'string' && imageUrl.trim()) {
    const parsed = parseStoragePathFromDownloadUrl(imageUrl.trim());
    if (parsed?.includes('/trail_covers/')) return parsed;
  }

  return null;
}

export async function deleteTrailCoverFromStorage(
  imagePath?: string | null,
  imageUrl?: string | null
): Promise<void> {
  const path = resolveTrailCoverStoragePath(imagePath, imageUrl);
  if (!path) return;

  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'storage/object-not-found') return;
    throw err;
  }
}
