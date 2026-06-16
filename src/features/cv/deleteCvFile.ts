import { FirebaseError } from 'firebase/app';
import { deleteObject, ref } from 'firebase/storage';
import { storage } from '@/integrations/firebase/client';
import {
  migrantCvStoragePathCandidates,
  parseStoragePathFromDownloadUrl,
  profileExternalCvStoragePathCandidates,
} from './cvStoragePaths';

async function deleteStoragePathIfExists(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'storage/object-not-found') return;
    throw err;
  }
}

/** Remove o CV do migrante no Storage (um ficheiro por utilizador). */
export async function deleteMigrantUserCvFiles(
  uploaderUid: string,
  knownDownloadUrl?: string | null
): Promise<void> {
  const paths = new Set(migrantCvStoragePathCandidates(uploaderUid));
  if (knownDownloadUrl) {
    const parsed = parseStoragePathFromDownloadUrl(knownDownloadUrl);
    if (parsed) paths.add(parsed);
  }
  await Promise.all(Array.from(paths).map((path) => deleteStoragePathIfExists(path)));
}

/** Remove o CV externo do perfil no Storage (um ficheiro por utilizador). */
export async function deleteProfileExternalCvFiles(
  uploaderUid: string,
  knownDownloadUrl?: string | null
): Promise<void> {
  const paths = new Set(profileExternalCvStoragePathCandidates(uploaderUid));
  if (knownDownloadUrl) {
    const parsed = parseStoragePathFromDownloadUrl(knownDownloadUrl);
    if (parsed) paths.add(parsed);
  }
  await Promise.all(Array.from(paths).map((path) => deleteStoragePathIfExists(path)));
}

/** Remove um ficheiro de CV pelo URL de download (ex.: anexos por candidatura da empresa). */
export async function deleteCvFromStorageByUrl(downloadUrl?: string | null): Promise<void> {
  if (!downloadUrl) return;
  const path = parseStoragePathFromDownloadUrl(downloadUrl);
  if (!path) return;
  await deleteStoragePathIfExists(path);
}
