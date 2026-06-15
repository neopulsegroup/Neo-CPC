import { httpsCallable } from 'firebase/functions';
import { functions } from '@/integrations/firebase/functionsClient';

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

export async function uploadCvFile(args: UploadCvFileArgs): Promise<UploadCvFileResult> {
  validateCvFile(args.file);

  const fileBase64 = await readFileAsBase64(args.file);
  const call = httpsCallable<UploadCvSecurePayload, UploadCvFileResult>(functions, 'uploadCvSecure');
  const response = await call({
    fileBase64,
    fileName: args.file.name,
    mimeType: inferCvMimeType(args.file),
    contextId: args.contextId,
    contextType: args.contextType,
  });

  return response.data;
}
