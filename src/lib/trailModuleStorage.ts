import { FirebaseError } from 'firebase/app';
import { deleteObject, ref } from 'firebase/storage';

import { parseStoragePathFromDownloadUrl } from '@/features/cv/cvStoragePaths';
import { storage } from '@/integrations/firebase/client';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
}

export function buildTrailModuleCoverPath(
  userId: string,
  trailId: string,
  moduleId: string,
  fileName: string
): string {
  const safeName = sanitizeFileName(fileName);
  return `profile_photos/${userId}/trail_module_covers/${trailId}_${moduleId}_${Date.now()}_${safeName}`;
}

export function buildTrailModulePdfPath(
  userId: string,
  trailId: string,
  moduleId: string,
  fileName: string
): string {
  const safeName = sanitizeFileName(fileName);
  return `profile_photos/${userId}/trail_module_pdfs/${trailId}_${moduleId}_${Date.now()}_${safeName}`;
}

function resolveStoragePath(
  storedPath?: string | null,
  downloadUrl?: string | null,
  segment: 'trail_module_covers' | 'trail_module_pdfs' = 'trail_module_covers'
): string | null {
  const trimmedPath = typeof storedPath === 'string' ? storedPath.trim() : '';
  if (trimmedPath.includes(`/${segment}/`)) return trimmedPath;

  if (typeof downloadUrl === 'string' && downloadUrl.trim()) {
    const parsed = parseStoragePathFromDownloadUrl(downloadUrl.trim());
    if (parsed?.includes(`/${segment}/`)) return parsed;
  }

  return null;
}

export function resolveTrailModuleCoverPath(
  imagePath?: string | null,
  imageUrl?: string | null
): string | null {
  return resolveStoragePath(imagePath, imageUrl, 'trail_module_covers');
}

export function resolveTrailModulePdfPath(
  contentPath?: string | null,
  contentUrl?: string | null
): string | null {
  return resolveStoragePath(contentPath, contentUrl, 'trail_module_pdfs');
}

async function deleteStoragePath(path: string | null): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'storage/object-not-found') return;
    throw err;
  }
}

export async function deleteTrailModuleCoverFromStorage(
  imagePath?: string | null,
  imageUrl?: string | null
): Promise<void> {
  await deleteStoragePath(resolveTrailModuleCoverPath(imagePath, imageUrl));
}

export async function deleteTrailModulePdfFromStorage(
  contentPath?: string | null,
  contentUrl?: string | null
): Promise<void> {
  await deleteStoragePath(resolveTrailModulePdfPath(contentPath, contentUrl));
}
