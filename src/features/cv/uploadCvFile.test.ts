import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock('@/integrations/firebase/functionsClient', () => ({
  functions: { _functions: true },
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
        storagePath: 'cv_uploads/application/app1/1_cv.pdf',
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
    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'João CV final.pdf',
        mimeType: 'application/pdf',
        contextId: 'app1',
        contextType: 'application',
      })
    );
  });
});
