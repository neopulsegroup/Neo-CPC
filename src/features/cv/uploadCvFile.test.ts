import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseError } from 'firebase/app';

const mockCallable = vi.fn();
const mockUploadBytes = vi.fn(async () => ({}));
const mockGetDownloadURL = vi.fn(async () => 'https://storage.example.com/direct.pdf');
const mockSetDocument = vi.fn(async () => undefined);

vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({ _ref: true })),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock('@/integrations/firebase/client', () => ({
  storage: { _storage: true },
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  setDocument: (...args: unknown[]) => mockSetDocument(...args),
}));

vi.mock('@/integrations/firebase/functionsClient', () => ({
  functions: { _functions: true },
}));

vi.mock('./deleteCvFile', () => ({
  deleteMigrantUserCvFiles: vi.fn(async () => undefined),
  deleteProfileExternalCvFiles: vi.fn(async () => undefined),
  deleteCvFromStorageByUrl: vi.fn(async () => undefined),
}));

import { uploadCvFile, validateCvFile, CvValidationError } from './uploadCvFile';

function makeFile(opts: { name?: string; type?: string; sizeBytes?: number }): File {
  const { name = 'cv.pdf', type = 'application/pdf', sizeBytes = 1024 } = opts;
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('validateCvFile', () => {
  it('lança CvValidationError invalid_type para tipo não suportado', () => {
    try {
      validateCvFile(makeFile({ type: 'image/jpeg', name: 'foto.jpg' }));
      expect.unreachable('deveria ter lançado');
    } catch (e) {
      expect(e).toBeInstanceOf(CvValidationError);
      expect((e as CvValidationError).code).toBe('invalid_type');
    }
  });

  it('lança CvValidationError too_large para ficheiro acima de 5 MB', () => {
    try {
      validateCvFile(makeFile({ sizeBytes: 6 * 1024 * 1024 }));
      expect.unreachable('deveria ter lançado');
    } catch (e) {
      expect((e as CvValidationError).code).toBe('too_large');
    }
  });

  it('aceita PDF válido dentro do limite', () => {
    expect(() => validateCvFile(makeFile({}))).not.toThrow();
  });

  it('aceita PDF quando o browser não preenche file.type mas a extensão é .pdf', () => {
    expect(() => validateCvFile(makeFile({ type: '', name: 'curriculo.pdf' }))).not.toThrow();
  });
});

describe('uploadCvFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallable.mockResolvedValue({
      data: {
        url: 'https://storage.example.com/cv.pdf',
        fileName: 'cv.pdf',
        storagePath: 'cv_uploads/migrant/migrant-uid/curriculo.pdf',
      },
    });
  });

  it('tipo inválido não chega a chamar a função', async () => {
    await expect(
      uploadCvFile({
        file: makeFile({ type: 'image/png', name: 'x.png' }),
        contextId: 'migrant-uid',
        contextType: 'migrant',
        uploaderUid: 'u1',
      })
    ).rejects.toBeInstanceOf(CvValidationError);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('upload com sucesso devolve url e fileName via Cloud Function', async () => {
    const result = await uploadCvFile({
      file: makeFile({ name: 'João CV final.pdf' }),
      contextId: 'app1',
      contextType: 'application',
      uploaderUid: 'migrant-uid',
    });
    expect(result.url).toBe('https://storage.example.com/cv.pdf');
    expect(result.fileName).toBe('cv.pdf');
    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(mockUploadBytes).not.toHaveBeenCalled();
  });

  it('faz fallback para upload direto quando a Cloud Function falha com internal', async () => {
    mockCallable.mockRejectedValueOnce(new FirebaseError('functions/internal', 'falha no servidor'));

    const result = await uploadCvFile({
      file: makeFile({ name: 'cv.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      contextId: 'app1',
      contextType: 'application',
      uploaderUid: 'migrant-uid',
    });

    expect(result.url).toBe('https://storage.example.com/direct.pdf');
    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
    expect(mockSetDocument).toHaveBeenCalledTimes(1);
  });

  it('faz fallback para upload direto quando profile não é suportado pela função', async () => {
    mockCallable.mockRejectedValueOnce(
      new FirebaseError('functions/invalid-argument', 'Tipo de contexto não suportado.')
    );

    const result = await uploadCvFile({
      file: makeFile({ name: 'cv.pdf' }),
      contextId: 'migrant-uid',
      contextType: 'profile',
      uploaderUid: 'migrant-uid',
    });

    expect(result.url).toBe('https://storage.example.com/direct.pdf');
    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
  });
});
