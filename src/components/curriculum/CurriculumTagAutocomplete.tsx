import { useCallback, useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function splitCsvLike(value: string): string[] {
  return value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export type CurriculumTagAutocompleteProps = {
  id?: string;
  label: string;
  tags: string[];
  onTagsChange: (next: string[]) => void;
  suggestions: string[];
  placeholder: string;
  addCustomLabel: (value: string) => string;
  emptyHint: string;
  removeTagAriaLabel: (tag: string) => string;
};

export function CurriculumTagAutocomplete({
  id: idProp,
  label,
  tags,
  onTagsChange,
  suggestions,
  placeholder,
  addCustomLabel,
  emptyHint,
  removeTagAriaLabel,
}: CurriculumTagAutocompleteProps) {
  const reactId = useId();
  const inputId = idProp ?? `cv-tags-${reactId}`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const availableSuggestions = useMemo(
    () => suggestions.filter((s) => !tags.some((t) => norm(t) === norm(s))),
    [suggestions, tags]
  );

  const filteredByQuery = useMemo(() => {
    const q = query.trim();
    if (!q) return availableSuggestions;
    const n = norm(q);
    return availableSuggestions.filter((s) => norm(s).includes(n));
  }, [availableSuggestions, query]);

  const shown = useMemo(() => {
    if (!query.trim()) return availableSuggestions.slice(0, 20);
    return filteredByQuery;
  }, [availableSuggestions, filteredByQuery, query]);

  const canAddCustom = useMemo(() => {
    const q = query.trim();
    if (!q) return false;
    if (tags.some((t) => norm(t) === norm(q))) return false;
    return true;
  }, [query, tags]);

  const showCustomRow =
    query.trim().length > 0 &&
    canAddCustom &&
    !availableSuggestions.some((s) => norm(s) === norm(query.trim()));

  const addTag = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      if (tags.some((x) => norm(x) === norm(t))) return;
      onTagsChange([...tags, t]);
      setQuery('');
      setOpen(false);
    },
    [onTagsChange, tags]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onTagsChange(tags.filter((x) => x !== tag));
    },
    [onTagsChange, tags]
  );

  const listboxId = `${inputId}-listbox`;
  const showList = open && (shown.length > 0 || showCustomRow);
  const showEmpty = open && query.trim().length > 0 && shown.length === 0 && !showCustomRow;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pl-2.5 pr-1 font-normal">
              <span>{tag}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => removeTag(tag)}
                aria-label={removeTagAriaLabel(tag)}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Input
          id={inputId}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 180);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!query.trim()) return;
              if (shown.length > 0) addTag(shown[0]);
              else if (showCustomRow) addTag(query);
            }
            if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
        />
        {showList ? (
          <ul
            id={listboxId}
            role="listbox"
            className={cn(
              'absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md',
              'py-1 text-sm'
            )}
          >
            {shown.map((s) => (
              <li key={s} role="option">
                <button
                  type="button"
                  className="flex w-full cursor-default select-none px-3 py-2 text-left outline-none hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => addTag(s)}
                >
                  {s}
                </button>
              </li>
            ))}
            {showCustomRow ? (
              <li role="option">
                <button
                  type="button"
                  className="flex w-full cursor-default select-none border-t px-3 py-2 text-left text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => addTag(query)}
                >
                  {addCustomLabel(query.trim())}
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
        {showEmpty ? (
          <p
            className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md"
            role="status"
          >
            {emptyHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
