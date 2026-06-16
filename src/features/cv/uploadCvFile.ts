import { FirebaseError } from 'firebase/app';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage } from '@/integrations/firebase/client';
import { setDocument } from '@/integrations/firebase/firestore';
import { functions } from '@/integrations/firebase/functionsClient';
import {
  buildMigrantCvStoragePath,
  buildProfileExternalCvStoragePath,
  sanitizeCvFileName,
} from './cvStoragePaths';
import {
  deleteCvFromStorageByUrl,
  deleteMigrantUserCvFiles,
  deleteProfileExternalCvFiles,
} from './deleteCvFile';

export const MAX_CV_SIZE_MB = 5;

export const ALLOWED_CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export type CvContextType = 'application' | 'migrant' | 'profile' | 'job_offer' | 'candidate_profile';

export type CvValidationCode = 'too_large' | 'invalid_type';

export class CvValidationError extends Error {
  code: CvValidationCode;
  constructor(code: CvValidationCode, message: string) {
    super(message);
    this.name = 'CvValidationError';
    this.code = code;
  }
}

export function inferCvMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return '';
}

/** Valida tamanho e tipo. Lança CvValidationError se inválido. */
export function validateCvFile(file: File): void {
  if (file.size > MAX_CV_SIZE_MB * 1024 * 1024) {
    throw new CvValidationError('too_large', `O ficheiro deve ter no máximo ${MAX_CV_SIZE_MB} MB.`);
  }
  if (!ALLOWED_CV_TYPES.includes(inferCvMimeType(file))) {
    throw new CvValidationError('invalid_type', 'Aceite PDF, DOC ou DOCX apenas.');
  }
}

interface UploadCvFileArgs {
  file: File;
  contextId: string;
  contextType: CvContextType;
  uploaderUid: string;
  previousUrl?: string | null;
}

interface UploadCvFileResult {
  url: string;
  fileName: string;
  storagePath: string;
}

type UploadCvSecurePayload = {
  fileBase64: string;
  fileName: string;
  mimeType: string;
  contextId: string;
  contextType: CvContextType;
  previousUrl?: string | null;
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Leitura do ficheiro falhou.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Leitura do ficheiro falhou.'));
    reader.readAsDataURL(file);
  });
}

function shouldTryDirectUploadAfterCallableFailure(err: unknown, contextType?: CvContextType): boolean {
  if (!(err instanceof FirebaseError)) return true;
  if (err.code === 'functions/unauthenticated') return false;
  if (err.code === 'functions/permission-denied') return false;
  if (err.code === 'functions/invalid-argument') {
    // Função em produção pode ainda não reconhecer contextType profile — tentar upload direto.
    return contextType === 'profile';
  }
  if (err.code === 'functions/not-found') return false;
  return true;
}

function resolveStoragePath(args: UploadCvFileArgs): string {
  if (args.contextType === 'migrant') {
    return buildMigrantCvStoragePath(args.uploaderUid, args.file.name);
  }
  if (args.contextType === 'profile') {
    return buildProfileExternalCvStoragePath(args.uploaderUid, args.file.name);
  }
  const sanitizedName = sanitizeCvFileName(args.file.name);
  const timestamp = Date.now();
  return `cv_uploads/${args.contextType}/${args.contextId}/${timestamp}_${sanitizedName}`;
}

async function prepareCvUpload(args: UploadCvFileArgs): Promise<string> {
  if (args.contextType === 'migrant') {
    await deleteMigrantUserCvFiles(args.uploaderUid, args.previousUrl);
    return buildMigrantCvStoragePath(args.uploaderUid, args.file.name);
  }
  if (args.contextType === 'profile') {
    await deleteProfileExternalCvFiles(args.uploaderUid, args.previousUrl);
    return buildProfileExternalCvStoragePath(args.uploaderUid, args.file.name);
  }
  if (args.previousUrl) {
    await deleteCvFromStorageByUrl(args.previousUrl);
  }
  return resolveStoragePath(args);
}

async function uploadCvViaCallable(args: UploadCvFileArgs): Promise<UploadCvFileResult> {
  const fileBase64 = await readFileAsBase64(args.file);
  const call = httpsCallable<UploadCvSecurePayload, UploadCvFileResult>(functions, 'uploadCvSecure');
  const response = await call({
    fileBase64,
    fileName: args.file.name,
    mimeType: inferCvMimeType(args.file),
    contextId: args.contextId,
    contextType: args.contextType,
    previousUrl: args.previousUrl ?? null,
  });
  return response.data;
}

async function uploadCvDirect(args: UploadCvFileArgs): Promise<UploadCvFileResult> {
  const storagePath = await prepareCvUpload(args);
  const storageRef = ref(storage, storagePath);
  const contentType = inferCvMimeType(args.file);
  const sanitizedName = sanitizeCvFileName(args.file.name);

  await uploadBytes(storageRef, args.file, {
    contentType,
    customMetadata: {
      uploaderUid: args.uploaderUid,
      contextType: args.contextType,
      contextId: args.contextId,
      originalName: args.file.name,
    },
  });

  const url = await getDownloadURL(storageRef);
  const auditId = `${args.contextType}_${args.contextId}_${Date.now()}`;

  await setDocument('cv_uploads_audit', auditId, {
    contextType: args.contextType,
    contextId: args.contextId,
    uploaderUid: args.uploaderUid,
    fileName: sanitizedName,
    storagePath,
    downloadUrl: url,
    uploadedAt: new Date().toISOString(),
    fileSize: args.file.size,
    fileType: contentType,
  });

  return { url, fileName: sanitizedName, storagePath };
}

export async function uploadCvFile(args: UploadCvFileArgs): Promise<UploadCvFileResult> {
  validateCvFile(args.file);

  try {
    return await uploadCvViaCallable(args);
  } catch (callableErr) {
    if (!shouldTryDirectUploadAfterCallableFailure(callableErr, args.contextType)) {
      throw callableErr;
    }
    try {
      return await uploadCvDirect(args);
    } catch (directErr) {
      if (callableErr instanceof FirebaseError) {
        throw callableErr;
      }
      throw directErr;
    }
  }
}

export { deleteMigrantUserCvFiles, deleteProfileExternalCvFiles, deleteCvFromStorageByUrl };
