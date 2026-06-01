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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">{field.label}</Label>
        {field.maxLength ? (
          <span className={`text-xs ${overLimit ? 'text-rose-600' : 'text-muted-foreground'}`}>
            {count}/{field.maxLength}
          </span>
        ) : null}
      </div>
      {field.description ? <p className="text-sm text-muted-foreground">{field.description}</p> : null}
      {field.type === 'textarea' ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="min-h-[110px] bg-white"
        />
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="bg-white"
        />
      )}
    </div>
  );
}
