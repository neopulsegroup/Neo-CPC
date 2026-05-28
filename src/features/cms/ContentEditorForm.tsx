import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getDocument, serverTimestamp, setDocument } from '@/integrations/firebase/firestore';
import { PAGE_SCHEMAS, PageId } from './pageSchemas';
import ContentEditorField from './ContentEditorField';
import { clearTranslationCache } from './translatorService';

type LocalizedFieldValue = {
  pt: string;
  en?: string;
  es?: string;
  fr?: string;
  kea?: string;
};

interface PageContentDocument {
  page_id: PageId;
  fields: Record<string, LocalizedFieldValue>;
  updated_at?: unknown;
  updated_by?: string;
  updated_by_name?: string;
}

function useUnsavedChangesWarning(when: boolean) {
  useEffect(() => {
    if (!when) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [when]);
}

function formatDate(date: Date | null): string {
  if (!date) return 'Nunca';
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit' }).format(date);
}

export function ContentEditorForm({ pageId }: { pageId: PageId }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const pageSchema = PAGE_SCHEMAS.find((page) => page.id === pageId);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [originalFields, setOriginalFields] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    async function debugAuthAndRole() {
      if (!user) {
        console.log('[DEBUG] sem user logado');
        return;
      }
      console.log('[DEBUG] uid:', user.uid);
      console.log('[DEBUG] email:', user.email);
      console.log('[DEBUG] displayName:', user.displayName);

      try {
        const userDoc = await getDocument('users', user.uid);
        console.log('[DEBUG] documento users/{uid} completo:', userDoc);
        console.log('[DEBUG] role detetada:', userDoc?.role);
        console.log('[DEBUG] tipo do role:', typeof userDoc?.role);
        console.log('[DEBUG] role === "admin" ?', userDoc?.role === 'admin');
      } catch (err) {
        console.error('[DEBUG] erro ao ler users/{uid}:', err);
      }
    }
    debugAuthAndRole();
  }, [user]);

  if (!pageSchema) {
    return <div>Schema de página não encontrado.</div>;
  }

  const pageFieldKeys = useMemo(() => new Set(pageSchema.fields.map((field) => field.key)), [pageSchema.fields]);

  const defaultValues = useMemo(() => {
    const fallback: Record<string, string> = {};
    for (const field of pageSchema.fields) {
      fallback[field.key] = t.get(field.key);
    }
    return fallback;
  }, [pageSchema.fields, t]);

  useUnsavedChangesWarning(JSON.stringify(fields) !== JSON.stringify(originalFields));

  useEffect(() => {
    mountedRef.current = true;
    setLoaded(false);
    setLoadingError(null);

    getDocument<PageContentDocument>('page_content', pageId)
      .then((doc) => {
        if (!mountedRef.current) return;
        const fetchedFields: Record<string, string> = {};
        for (const field of pageSchema.fields) {
          const overrideValue = doc?.fields?.[field.key]?.pt;
          fetchedFields[field.key] = overrideValue ?? defaultValues[field.key];
        }

        setFields(fetchedFields);
        setOriginalFields(fetchedFields);
        setLastSavedAt(doc?.updated_at ? new Date((doc.updated_at as { seconds: number }).seconds * 1000) : null);
        setLastSavedBy(doc?.updated_by_name ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setFields(defaultValues);
        setOriginalFields(defaultValues);
        setLastSavedAt(null);
        setLastSavedBy(null);
        setLoaded(true);
      });

    return () => {
      mountedRef.current = false;
    };
  }, [defaultValues, pageId, pageSchema.fields]);

  const sections = useMemo(() => {
    const grouped: Record<string, Array<typeof pageSchema.fields[number]>> = {};
    for (const field of pageSchema.fields) {
      grouped[field.section] = grouped[field.section] ?? [];
      grouped[field.section].push(field);
    }
    return Object.entries(grouped).map(([section, fieldsInSection]) => ({ section, fields: fieldsInSection }));
  }, [pageSchema.fields]);

  const hasChanges = JSON.stringify(fields) !== JSON.stringify(originalFields);

  const handleFieldChange = (key: string, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const handleDiscard = () => {
    if (!hasChanges) {
      setFields(originalFields);
      return;
    }
    const confirmed = window.confirm('Existem alterações não guardadas. Deseja descartar e recarregar o conteúdo?');
    if (confirmed) {
      setFields(originalFields);
      toast.success('Alterações descartadas.');
    }
  };

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        setSaving(false);
        toast.error('A gravação está a demorar. O Firestore continuará a tentar em segundo plano.');
      }
    }, 15000);

    try {
      const savedFields: Record<string, LocalizedFieldValue> = {};
      for (const key of Object.keys(fields)) {
        if (!pageFieldKeys.has(key)) continue;
        savedFields[key] = { pt: fields[key] };
      }

      console.log('[ContentEditorForm] a guardar', { pageId, savedKeys: Object.keys(savedFields).length });
      await setDocument<PageContentDocument>('page_content', pageId, {
        page_id: pageId,
        fields: savedFields,
        updated_at: serverTimestamp(),
        updated_by: user?.uid ?? 'unknown',
        updated_by_name: user?.displayName ?? user?.email ?? 'Administrador',
      }, false);

      clearTimeout(timeoutId);
      if (!mountedRef.current) return;

      console.log('[ContentEditorForm] gravação confirmada pelo Firestore');
      clearTranslationCache();
      setOriginalFields(fields);
      setLastSavedAt(new Date());
      setLastSavedBy(user?.displayName ?? user?.email ?? 'Administrador');
      toast.success('Conteúdo guardado com sucesso.');
      setSaving(false);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Erro ao guardar conteúdo:', error);
      if (!mountedRef.current) return;
      toast.error('Não foi possível guardar as alterações. Tente novamente.');
      setSaving(false);
    }
  }, [saving, fields, pageFieldKeys, pageId, user]);

  if (!loaded) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 text-muted-foreground">
        A carregar conteúdo...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">{pageSchema.title}</p>
            <h2 className="text-2xl font-semibold text-slate-900">Editor de Conteúdo</h2>
          </div>
          <div className="text-sm text-muted-foreground">
            Última edição: {formatDate(lastSavedAt)}{lastSavedBy ? ` por ${lastSavedBy}` : ''}
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Edita apenas a versão em português. As traduções para inglês, espanhol e francês são geradas automaticamente no navegador do visitante. Em navegadores sem suporte, o texto em português é apresentado.</p>
      </div>

      {loadingError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{loadingError}</div>
      ) : null}

      <div className="grid gap-6">
        {sections.map((section) => (
          <div key={section.section} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">{section.section}</h3>
            <div className="space-y-4">
              {section.fields.map((field) => (
                <ContentEditorField
                  key={field.key}
                  field={field}
                  value={fields[field.key] ?? ''}
                  onChange={(value) => handleFieldChange(field.key, value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-x-2">
          <Button variant="secondary" onClick={handleDiscard} disabled={saving}>
            Descartar
          </Button>
          <Button variant="outline" onClick={() => window.open(pageSchema.route, '_blank')}>
            Pré-visualizar
          </Button>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  );
}
