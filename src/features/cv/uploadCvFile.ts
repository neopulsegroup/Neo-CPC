import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/integrations/firebase/client';
import { setDocument } from '@/integrations/firebase/firestore';

export const MAX_CV_SIZE_MB = 5;

export const ALLOWED_CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export type CvContextType = 'application' | 'job_offer' | 'candidate_profile';

export type CvValidationCode = 'too_large' | 'invalid_type';

export class CvValidationError extends Error {
  code: CvValidationCode;
  constructor(code: CvValidationCode, message: string) {
    super(message);
    this.name = 'CvValidationError';
    this.code = code;
  }
}

/** Valida tamanho e tipo. Lança CvValidationError se inválido. */
export function validateCvFile(file: File): void {
  if (file.size > MAX_CV_SIZE_MB * 1024 * 1024) {
    throw new CvValidationError('too_large', `O ficheiro deve ter no máximo ${MAX_CV_SIZE_MB} MB.`);
  }
  if (!ALLOWED_CV_TYPES.includes(file.type)) {
    throw new CvValidationError('invalid_type', 'Aceite PDF, DOC ou DOCX apenas.');
  }
}

interface UploadCvFileArgs {
  file: File;
  contextId: string;
  contextType: CvContextType;
  uploaderUid: string;
}

interface UploadCvFileResult {
  url: string;
  fileName: string;
  storagePath: string;
}

export async function uploadCvFile(args: UploadCvFileArgs): Promise<UploadCvFileResult> {
  validateCvFile(args.file);

  const sanitizedName = args.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `cv_uploads/${args.contextType}/${args.contextId}/${timestamp}_${sanitizedName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, args.file, {
    contentType: args.file.type,
    customMetadata: {
      uploaderUid: args.uploaderUid,
      contextType: args.contextType,
      contextId: args.contextId,
      originalName: args.file.name,
    },
  });

  const url = await getDownloadURL(storageRef);

  // Audit trail (conformidade RGPD básica).
  const auditId = `${args.contextType}_${args.contextId}_${timestamp}`;
  await setDocument('cv_uploads_audit', auditId, {
    contextType: args.contextType,
    contextId: args.contextId,
    uploaderUid: args.uploaderUid,
    fileName: sanitizedName,
    storagePath,
    downloadUrl: url,
    uploadedAt: new Date().toISOString(),
    fileSize: args.file.size,
    fileType: args.file.type,
  });

  return { url, fileName: sanitizedName, storagePath };
}
