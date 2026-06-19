import { useEffect, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Heading2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SimpleHtmlEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  minHeightClassName?: string;
  toolbarLabels?: {
    bold?: string;
    italic?: string;
    bullets?: string;
    ordered?: string;
    heading?: string;
  };
};

export function SimpleHtmlEditor({
  id,
  value,
  onChange,
  className,
  minHeightClassName = 'min-h-[180px]',
  toolbarLabels,
}: SimpleHtmlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (!editorRef.current) return;
    if (value !== lastValueRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
    lastValueRef.current = value;
  }, [value]);

  function syncValue() {
    const next = editorRef.current?.innerHTML ?? '';
    lastValueRef.current = next;
    onChange(next);
  }

  function applyCommand(command: string, valueArg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, valueArg);
    syncValue();
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-background', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={toolbarLabels?.bold ?? 'Negrito'}
          onClick={() => applyCommand('bold')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={toolbarLabels?.italic ?? 'Itálico'}
          onClick={() => applyCommand('italic')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={toolbarLabels?.bullets ?? 'Lista'}
          onClick={() => applyCommand('insertUnorderedList')}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={toolbarLabels?.ordered ?? 'Lista numerada'}
          onClick={() => applyCommand('insertOrderedList')}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={toolbarLabels?.heading ?? 'Título'}
          onClick={() => applyCommand('formatBlock', 'h2')}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
      </div>
      <div
        id={id}
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          'px-3 py-3 text-sm leading-relaxed focus:outline-none prose prose-sm max-w-none dark:prose-invert',
          minHeightClassName
        )}
        onInput={syncValue}
        onBlur={syncValue}
      />
    </div>
  );
}
