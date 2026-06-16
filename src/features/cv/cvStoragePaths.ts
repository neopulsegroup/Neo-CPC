export const MIGRANT_CV_BASENAME = 'curriculo';
export const PROFILE_EXTERNAL_CV_BASENAME = 'external_curriculo';

export function sanitizeCvFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function inferCvFileExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return '.pdf';
  if (lower.endsWith('.docx')) return '.docx';
  if (lower.endsWith('.doc')) return '.doc';
  return '';
}

/** Um único CV por migrante: cv_uploads/migrant/{userId}/curriculo.{ext} */
export function buildMigrantCvStoragePath(uploaderUid: string, fileName: string): string {
  const ext = inferCvFileExtension(fileName) || '.pdf';
  return `cv_uploads/migrant/${uploaderUid}/${MIGRANT_CV_BASENAME}${ext}`;
}

export function migrantCvStoragePathCandidates(uploaderUid: string): string[] {
  return ['.pdf', '.doc', '.docx'].map((ext) => `cv_uploads/migrant/${uploaderUid}/${MIGRANT_CV_BASENAME}${ext}`);
}

/** CV externo no perfil: cv_uploads/profile/{userId}/external_curriculo.{ext} */
export function buildProfileExternalCvStoragePath(uploaderUid: string, fileName: string): string {
  const ext = inferCvFileExtension(fileName) || '.pdf';
  return `cv_uploads/profile/${uploaderUid}/${PROFILE_EXTERNAL_CV_BASENAME}${ext}`;
}

export function profileExternalCvStoragePathCandidates(uploaderUid: string): string[] {
  return ['.pdf', '.doc', '.docx'].map(
    (ext) => `cv_uploads/profile/${uploaderUid}/${PROFILE_EXTERNAL_CV_BASENAME}${ext}`
  );
}

export function parseStoragePathFromDownloadUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const encoded = parsed.pathname.split('/o/')[1];
    if (!encoded) return null;
    return decodeURIComponent(encoded.split('?')[0] ?? encoded);
  } catch {
    return null;
  }
}
