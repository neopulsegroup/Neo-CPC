import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const toastSpy = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: { get: (key: string) => key } }),
}));

vi.mock('./uploadCvFile', async (importActual) => {
  const actual = await importActual<typeof import('./uploadCvFile')>();
  return { ...actual, uploadCvFile: vi.fn(async () => ({ url: 'https://x/cv.pdf', fileName: 'cv.pdf', storagePath: 'p' })) };
});

import { CVUploadButton } from './CVUploadButton';
import { uploadCvFile } from './uploadCvFile';

function makeFile(opts: { name?: string; type?: string; sizeBytes?: number }): File {
  const { name = 'cv.pdf', type = 'application/pdf', sizeBytes = 1024 } = opts;
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

const baseProps = {
  contextId: 'app1',
  contextType: 'application' as const,
  uploaderUid: 'u1',
  onUploadComplete: vi.fn(),
};

describe('CVUploadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza botão de carregar quando não há currentUrl', () => {
    render(<CVUploadButton {...baseProps} />);
    expect(screen.getByRole('button', { name: /cvUpload\.button/ })).toBeInTheDocument();
  });

  it('renderiza link "ver CV carregado" quando currentUrl está preenchido', () => {
    render(<CVUploadButton {...baseProps} currentUrl="https://x/cv.pdf" />);
    const link = screen.getByText('cvUpload.viewUploaded');
    expect(link).toHaveAttribute('href', 'https://x/cv.pdf');
  });

  it('clique no botão dispara o input file', () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    render(<CVUploadButton {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cvUpload\.button/ }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('ficheiro de tipo inválido mostra toast destrutivo e não faz upload', async () => {
    const { container } = render(<CVUploadButton {...baseProps} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile({ type: 'image/jpeg', name: 'foto.jpg' })] } });
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'cvUpload.errors.invalidType.title', variant: 'destructive' })
      )
    );
    expect(uploadCvFile).not.toHaveBeenCalled();
  });

  it('ficheiro demasiado grande mostra toast destrutivo e não faz upload', async () => {
    const { container } = render(<CVUploadButton {...baseProps} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile({ sizeBytes: 6 * 1024 * 1024 })] } });
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'cvUpload.errors.tooLarge.title', variant: 'destructive' })
      )
    );
    expect(uploadCvFile).not.toHaveBeenCalled();
  });

  it('PDF válido faz upload e chama onUploadComplete', async () => {
    const onUploadComplete = vi.fn();
    const { container } = render(<CVUploadButton {...baseProps} onUploadComplete={onUploadComplete} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile({})] } });
    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith('https://x/cv.pdf', 'cv.pdf'));
    expect(uploadCvFile).toHaveBeenCalledTimes(1);
  });
});
