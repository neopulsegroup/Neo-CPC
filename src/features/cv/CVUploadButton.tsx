import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileText, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  uploadCvFile,
  validateCvFile,
  CvValidationError,
  MAX_CV_SIZE_MB,
  type CvContextType,
} from './uploadCvFile';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

interface CVUploadButtonProps {
  contextId: string;
  contextType: CvContextType;
  uploaderUid: string;
  currentUrl?: string | null;
  onUploadComplete: (url: string, fileName: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export function CVUploadButton({
  contextId,
  contextType,
  uploaderUid,
  currentUrl,
  onUploadComplete,
  onRemove,
  disabled,
}: CVUploadButtonProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function handleClick() {
    inputRef.current?.click();
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      validateCvFile(file);
    } catch (err) {
      if (err instanceof CvValidationError) {
        const key = err.code === 'too_large' ? 'tooLarge' : 'invalidType';
        toast({
          title: t.get(`cvUpload.errors.${key}.title`),
          description:
            err.code === 'too_large'
              ? t.get('cvUpload.errors.tooLarge.description', { maxSize: MAX_CV_SIZE_MB })
              : t.get('cvUpload.errors.invalidType.description'),
          variant: 'destructive',
        });
      }
      return;
    }

    setUploading(true);
    try {
      const { url, fileName } = await uploadCvFile({ file, contextId, contextType, uploaderUid });
      onUploadComplete(url, fileName);
      toast({ title: t.get('cvUpload.success') });
    } catch (err) {
      console.error('[CVUploadButton] falha:', err);
      toast({
        title: t.get('cvUpload.errors.uploadFailed.title'),
        description: t.get('cvUpload.errors.uploadFailed.description'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  if (currentUrl) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-sm hover:underline"
        >
          {t.get('cvUpload.viewUploaded')}
        </a>
        {onRemove ? (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove} disabled={disabled || uploading}>
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleChange}
        className="hidden"
      />
      <Button type="button" variant="outline" onClick={handleClick} disabled={disabled || uploading}>
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t.get('cvUpload.uploading')}
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {t.get('cvUpload.button')}
          </>
        )}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">{t.get('cvUpload.hint', { maxSize: MAX_CV_SIZE_MB })}</p>
    </div>
  );
}

export default CVUploadButton;
