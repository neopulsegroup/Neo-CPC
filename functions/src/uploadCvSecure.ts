import { randomUUID } from 'node:crypto';

import type { File } from '@google-cloud/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import {
  getFirestore,
  getStorageBucket,
  FIREBASE_STORAGE_BUCKET,
  LEGACY_STORAGE_BUCKET,
} from './admin';
import { isAdminUser } from './permissions';

const CV_CORS_ORIGINS: Array<string | RegExp> = [
  'https://www.portalcpc.com',
  'https://portalcpc.com',
  'https://cpc-projeto-app.web.app',
  'https://cpc-projeto-app.firebaseapp.com',
  'https://saas-cpc.vercel.app',
  /^https:\/\/[\w-]+\.portalcpc\.com$/,
  /^https:\/\/[\w-]+\.vercel\.app$/,
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8090',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8090',
];

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type UploadCvPayload = {
  fileBase64?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  contextId?: unknown;
  contextType?: unknown;
  previousUrl?: unknown;
};

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function inferMimeType(fileName: string, mimeType: string): string {
  if (mimeType && ALLOWED_TYPES.has(mimeType)) return mimeType;
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return '';
}

function companyUserIdMatches(data: FirebaseFirestore.DocumentData | undefined, uid: string): boolean {
  if (!data) return false;
  const userId = data.user_id ?? data.userId;
  if (typeof userId === 'string' && userId === uid) return true;
  if (userId && typeof userId === 'object' && 'path' in userId) {
    const path = String((userId as { path?: string }).path || '');
    return path.endsWith(`/${uid}`);
  }
  return false;
}

async function employerOwnsCompanyId(uid: string, companyId: string): Promise<boolean> {
  if (!companyId) return false;
  if (companyId === uid) return true;
  const compSnap = await getFirestore().doc(`companies/${companyId}`).get();
  if (!compSnap.exists) return false;
  return companyUserIdMatches(compSnap.data(), uid);
}

async function isEmployerPublisher(uid: string): Promise<boolean> {
  const db = getFirestore();
  const [userSnap, profileSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`profiles/${uid}`).get()]);
  const roleFrom = (data?: FirebaseFirestore.DocumentData) => {
    const raw = data?.role ?? data?.profile ?? data?.perfil ?? data?.type;
    return typeof raw === 'string' ? raw.toLowerCase() : '';
  };
  const role = roleFrom(userSnap.data()) || roleFrom(profileSnap.data());
  return role === 'company' || role === 'empresa';
}

function inferCvFileExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return '.pdf';
  if (lower.endsWith('.docx')) return '.docx';
  if (lower.endsWith('.doc')) return '.doc';
  return '.pdf';
}

function buildMigrantCvStoragePath(uploaderUid: string, fileName: string): string {
  return `cv_uploads/migrant/${uploaderUid}/curriculo${inferCvFileExtension(fileName)}`;
}

function buildProfileExternalCvStoragePath(uploaderUid: string, fileName: string): string {
  return `cv_uploads/profile/${uploaderUid}/external_curriculo${inferCvFileExtension(fileName)}`;
}

function parseStoragePathFromDownloadUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const encoded = parsed.pathname.split('/o/')[1];
    if (!encoded) return null;
    return decodeURIComponent(encoded.split('?')[0] ?? encoded);
  } catch {
    return null;
  }
}

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function deleteStoragePathIfExists(bucketName: string, storagePath: string): Promise<void> {
  try {
    await getStorageBucket(bucketName).file(storagePath).delete({ ignoreNotFound: true });
  } catch (err) {
    logger.warn('uploadCvSecure_delete_path_failed', {
      bucketName,
      storagePath,
      error: formatUnknownError(err),
    });
  }
}

async function deleteMigrantCvFilesServer(uploaderUid: string, previousUrl?: string): Promise<void> {
  const paths = new Set(['.pdf', '.doc', '.docx'].map((ext) => buildMigrantCvStoragePath(uploaderUid, `x${ext}`)));
  if (previousUrl) {
    const parsed = parseStoragePathFromDownloadUrl(previousUrl);
    if (parsed) paths.add(parsed);
  }
  for (const bucketName of [FIREBASE_STORAGE_BUCKET, LEGACY_STORAGE_BUCKET]) {
    await Promise.all(Array.from(paths).map((path) => deleteStoragePathIfExists(bucketName, path)));
  }
}

async function deleteProfileExternalCvFilesServer(uploaderUid: string, previousUrl?: string): Promise<void> {
  const paths = new Set(
    ['.pdf', '.doc', '.docx'].map((ext) => buildProfileExternalCvStoragePath(uploaderUid, `x${ext}`))
  );
  if (previousUrl) {
    const parsed = parseStoragePathFromDownloadUrl(previousUrl);
    if (parsed) paths.add(parsed);
  }
  for (const bucketName of [FIREBASE_STORAGE_BUCKET, LEGACY_STORAGE_BUCKET]) {
    await Promise.all(Array.from(paths).map((path) => deleteStoragePathIfExists(bucketName, path)));
  }
}

async function assertCanUploadCv(uid: string, contextType: string, contextId: string): Promise<void> {
  if (contextType === 'migrant' || contextType === 'profile') {
    if (contextId !== uid) {
      throw new HttpsError('permission-denied', 'Sem permissão para gerir o CV deste utilizador.');
    }
    return;
  }

  if (contextType !== 'application') {
    throw new HttpsError('invalid-argument', 'Tipo de contexto não suportado.');
  }

  const appSnap = await getFirestore().doc(`job_applications/${contextId}`).get();
  if (!appSnap.exists) {
    throw new HttpsError('not-found', 'Candidatura não encontrada.');
  }

  const app = appSnap.data() ?? {};
  if (app.applicant_id === uid) return;

  if (await isAdminUser(uid)) return;

  const jobId = typeof app.job_id === 'string' ? app.job_id : '';
  if (!jobId) {
    throw new HttpsError('permission-denied', 'Sem permissão para anexar CV a esta candidatura.');
  }

  const jobSnap = await getFirestore().doc(`job_offers/${jobId}`).get();
  const companyId = typeof jobSnap.data()?.company_id === 'string' ? jobSnap.data()!.company_id : '';
  if ((await isEmployerPublisher(uid)) && companyId && (await employerOwnsCompanyId(uid, companyId))) {
    return;
  }

  throw new HttpsError('permission-denied', 'Sem permissão para anexar CV a esta candidatura.');
}

function buildDownloadUrl(bucketName: string, storagePath: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

async function saveCvToStorage(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ bucketName: string; file: File }> {
  const bucketCandidates = [FIREBASE_STORAGE_BUCKET, LEGACY_STORAGE_BUCKET];
  let lastError: unknown = null;

  for (const bucketName of bucketCandidates) {
    try {
      const file = getStorageBucket(bucketName).file(storagePath);
      await file.save(buffer, {
        resumable: false,
        validation: false,
        contentType: mimeType,
        metadata: {
          contentType: mimeType,
        },
      });
      return { bucketName, file };
    } catch (err) {
      lastError = err;
      logger.warn('uploadCvSecure_bucket_try_failed', {
        bucketName,
        storagePath,
        error: formatUnknownError(err),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(formatUnknownError(lastError));
}

async function resolveDownloadUrl(bucketName: string, file: File, storagePath: string): Promise<string> {
  const downloadToken = randomUUID();

  try {
    await file.setMetadata({
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    });
    return buildDownloadUrl(bucketName, storagePath, downloadToken);
  } catch (tokenErr) {
    logger.warn('uploadCvSecure_token_metadata_failed', {
      bucketName,
      storagePath,
      error: formatUnknownError(tokenErr),
    });
  }

  try {
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    });
    return signedUrl;
  } catch (signedErr) {
    logger.error('uploadCvSecure_signed_url_failed', {
      bucketName,
      storagePath,
      error: formatUnknownError(signedErr),
    });
    throw signedErr;
  }
}

export const uploadCvSecure = onCall(
  {
    region: 'us-central1',
    invoker: 'public',
    cors: CV_CORS_ORIGINS,
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sessão inválida.');

    try {
      const payload = (request.data || {}) as UploadCvPayload;
      const fileName = normalize(payload.fileName);
      const contextId = normalize(payload.contextId);
      const contextType = normalize(payload.contextType);
      const mimeType = inferMimeType(fileName, normalize(payload.mimeType));
      const fileBase64 = typeof payload.fileBase64 === 'string' ? payload.fileBase64 : '';

      if (!fileName || !contextId || !contextType || !fileBase64) {
        throw new HttpsError('invalid-argument', 'Dados de upload incompletos.');
      }
      if (!mimeType || !ALLOWED_TYPES.has(mimeType)) {
        throw new HttpsError('invalid-argument', 'Tipo de ficheiro não suportado. Use PDF, DOC ou DOCX.');
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(fileBase64, 'base64');
      } catch {
        throw new HttpsError('invalid-argument', 'Conteúdo do ficheiro inválido.');
      }

      if (!buffer.length) {
        throw new HttpsError('invalid-argument', 'O ficheiro está vazio.');
      }
      if (buffer.length > MAX_BYTES) {
        throw new HttpsError('invalid-argument', 'O ficheiro deve ter no máximo 5 MB.');
      }

      await assertCanUploadCv(uid, contextType, contextId);

      const sanitizedName = sanitizeFileName(fileName);
      const timestamp = Date.now();
      const previousUrl = typeof payload.previousUrl === 'string' ? payload.previousUrl : '';
      let storagePath: string;

      if (contextType === 'migrant') {
        await deleteMigrantCvFilesServer(contextId, previousUrl || undefined);
        storagePath = buildMigrantCvStoragePath(contextId, fileName);
      } else if (contextType === 'profile') {
        await deleteProfileExternalCvFilesServer(contextId, previousUrl || undefined);
        storagePath = buildProfileExternalCvStoragePath(contextId, fileName);
      } else {
        if (previousUrl) {
          const parsed = parseStoragePathFromDownloadUrl(previousUrl);
          if (parsed) {
            await deleteStoragePathIfExists(FIREBASE_STORAGE_BUCKET, parsed);
            await deleteStoragePathIfExists(LEGACY_STORAGE_BUCKET, parsed);
          }
        }
        storagePath = `cv_uploads/${contextType}/${contextId}/${timestamp}_${sanitizedName}`;
      }

      const { bucketName, file } = await saveCvToStorage(storagePath, buffer, mimeType);
      const url = await resolveDownloadUrl(bucketName, file, storagePath);
      const auditId = `${contextType}_${contextId}_${timestamp}`;

      try {
        await getFirestore()
          .collection('cv_uploads_audit')
          .doc(auditId)
          .set({
            contextType,
            contextId,
            uploaderUid: uid,
            fileName: sanitizedName,
            storagePath,
            downloadUrl: url,
            uploadedAt: new Date().toISOString(),
            fileSize: buffer.length,
            fileType: mimeType,
          });
      } catch (err) {
        logger.error('uploadCvSecure_audit_failed', { auditId, contextId, error: String(err) });
      }

      return {
        url,
        fileName: sanitizedName,
        storagePath,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const detail = formatUnknownError(err);
      logger.error('uploadCvSecure_failed', {
        uid,
        error: detail,
      });
      throw new HttpsError(
        'internal',
        detail.includes('storage')
          ? `Não foi possível guardar o CV no Storage (${detail}).`
          : `Não foi possível guardar o CV (${detail}).`
      );
    }
  }
);
