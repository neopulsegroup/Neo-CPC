import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    } catch (e) {
      expect(e).toBeInstanceOf(CvValidationError);
      expect((e as CvValidationError).code).toBe('invalid_type');
      return;
    }
    expect.unreachable('deveria ter lançado');
  });

  it('lança CvValidationError too_large para ficheiro acima de 5 MB', () => {
    try {
      validateCvFile(makeFile({ sizeBytes: 6 * 1024 * 1024 }));
    } catch (e) {
      expect((e as CvValidationError).code).toBe('too_large');
      return;
    }
    expect.unreachable('deveria ter lançado');
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
        storagePath: 'cv_uploads/application/app1/cv.pdf',
      },
    });
  });

  it('tipo inválido não chega a chamar a função', async () => {
    await expect(
      uploadCvFile({
        file: makeFile({ type: 'image/png', name: 'x.png' }),
        contextId: 'app1',
        contextType: 'application',
        uploaderUid: 'u1',
      })
    ).rejects.toBeInstanceOf(CvValidationError);
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('bloqueia upload de currículo externo do migrante (contextType migrant)', async () => {
    await expect(
      uploadCvFile({
        file: makeFile({}),
        contextId: 'migrant-uid',
        contextType: 'migrant',
        uploaderUid: 'migrant-uid',
      })
    ).rejects.toMatchObject({ name: 'CvValidationError', code: 'invalid_type' });
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('bloqueia upload de currículo externo do migrante (contextType profile)', async () => {
    await expect(
      uploadCvFile({
        file: makeFile({}),
        contextId: 'migrant-uid',
        contextType: 'profile',
        uploaderUid: 'migrant-uid',
      })
    ).rejects.toMatchObject({ name: 'CvValidationError', code: 'invalid_type' });
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('bloqueia upload de CV anexado pela empresa (contextType application)', async () => {
    await expect(
      uploadCvFile({
        file: makeFile({ name: 'João CV final.pdf' }),
        contextId: 'app1',
        contextType: 'application',
        uploaderUid: 'company-uid',
      })
    ).rejects.toMatchObject({ name: 'CvValidationError', code: 'invalid_type' });
    expect(mockCallable).not.toHaveBeenCalled();
    expect(mockUploadBytes).not.toHaveBeenCalled();
  });
});
