import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { FieldDefinition } from './pageSchemas';

interface ContentEditorFieldProps {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}

export default function ContentEditorField({ field, value, onChange }: ContentEditorFieldProps) {
  const count = value.length;
  const overLimit = field.maxLength !== undefined && count > field.maxLength;

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label className="font-semibold text-slate-900">{field.label}</Label>
        {field.maxLength ? (
          <span className={`text-sm ${overLimit ? 'text-rose-600' : 'text-muted-foreground'}`}>
            {count} / {field.maxLength}
          </span>
        ) : null}
      </div>
      {field.description ? <p className="text-sm text-muted-foreground">{field.description}</p> : null}
      {field.type === 'textarea' ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          className="min-h-[120px]"
        />
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
