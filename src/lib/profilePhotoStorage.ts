import { FirebaseError } from 'firebase/app';
import { deleteObject, ref } from 'firebase/storage';

import { parseStoragePathFromDownloadUrl } from '@/features/cv/cvStoragePaths';
import { storage } from '@/integrations/firebase/client';

const RESERVED_PROFILE_SUBFOLDERS = new Set(['document_branding', 'trail_covers']);

export function buildProfilePhotoStoragePath(userId: string): string {
  return `profile_photos/${userId}`;
}

export function resolveProfilePhotoStoragePath(
  photoUrl?: string | null,
  userId?: string
): string | null {
  if (typeof photoUrl !== 'string' || !photoUrl.trim()) return null;

  const parsed = parseStoragePathFromDownloadUrl(photoUrl.trim());
  if (!parsed?.startsWith('profile_photos/')) return null;

  const parts = parsed.split('/');
  if (parts.length < 2 || parts.length > 3) return null;

  const ownerId = parts[1];
  if (userId && ownerId !== userId) return null;

  if (parts.length === 3 && RESERVED_PROFILE_SUBFOLDERS.has(parts[2]!)) return null;

  return parsed;
}

export async function deleteProfilePhotoFromStorage(
  photoUrl?: string | null,
  userId?: string
): Promise<void> {
  const path = resolveProfilePhotoStoragePath(photoUrl, userId);
  if (!path) return;

  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'storage/object-not-found') return;
    throw err;
  }
}
