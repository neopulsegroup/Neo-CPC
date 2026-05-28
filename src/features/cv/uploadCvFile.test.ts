import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({ _ref: true })),
  uploadBytes: vi.fn(async () => ({})),
  getDownloadURL: vi.fn(async () => 'https://storage.example.com/cv.pdf'),
}));

vi.mock('@/integrations/firebase/client', () => ({
  storage: { _storage: true },
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  setDocument: vi.fn(async () => undefined),
}));

import { uploadCvFile, validateCvFile, CvValidationError } from './uploadCvFile';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { setDocument } from '@/integrations/firebase/firestore';

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
});

describe('uploadCvFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tipo inválido não chega a fazer upload', async () => {
    await expect(
      uploadCvFile({
        file: makeFile({ type: 'image/png', name: 'x.png' }),
        contextId: 'app1',
        contextType: 'application',
        uploaderUid: 'u1',
      })
    ).rejects.toBeInstanceOf(CvValidationError);
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('upload com sucesso devolve url e fileName, e cria audit', async () => {
    const result = await uploadCvFile({
      file: makeFile({ name: 'João CV final.pdf' }),
      contextId: 'app1',
      contextType: 'application',
      uploaderUid: 'company-uid',
    });
    expect(result.url).toBe('https://storage.example.com/cv.pdf');
    expect(result.fileName).toBe('Jo_o_CV_final.pdf'); // sanitizado
    expect(uploadBytes).toHaveBeenCalledTimes(1);
    expect(getDownloadURL).toHaveBeenCalledTimes(1);
    expect(setDocument).toHaveBeenCalledTimes(1);
    const [collection, , payload] = (setDocument as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(collection).toBe('cv_uploads_audit');
    expect((payload as { uploaderUid: string }).uploaderUid).toBe('company-uid');
    expect((payload as { downloadUrl: string }).downloadUrl).toBe('https://storage.example.com/cv.pdf');
  });

  it('upload pelo migrante (application) grava audit com o uploaderUid do migrante', async () => {
    await uploadCvFile({
      file: makeFile({ name: 'meu_cv.pdf' }),
      contextId: 'app-42',
      contextType: 'application',
      uploaderUid: 'migrant-uid',
    });
    const [collection, , payload] = (setDocument as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(collection).toBe('cv_uploads_audit');
    expect((payload as { uploaderUid: string }).uploaderUid).toBe('migrant-uid');
    expect((payload as { contextType: string }).contextType).toBe('application');
    expect((payload as { contextId: string }).contextId).toBe('app-42');
  });
});
