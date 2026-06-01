import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageId, PAGE_SCHEMAS } from '@/features/cms/pageSchemas';
import { ContentEditorForm } from '@/features/cms/ContentEditorForm';

export default function ContentEditorPage() {
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { t } = useLanguage();

  const selectedPageId = useMemo<PageId>(() => {
    const pageParam = searchParams.get('page');
    if (pageParam && PAGE_SCHEMAS.some((page) => page.id === pageParam)) {
      return pageParam as PageId;
    }
    return 'home';
  }, [searchParams]);

  const selectedPage = useMemo(() => PAGE_SCHEMAS.find((page) => page.id === selectedPageId) ?? PAGE_SCHEMAS[0], [selectedPageId]);

  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.contentEditor.title')}
          </h1>
          <p className="text-destructive mt-1">{t.get('cpc.pages.contentEditor.noPermission')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.contentEditor.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.pages.contentEditor.subtitle')}</p>
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">{t.get('cpc.pages.contentEditor.activePage')}</p>
            <h2 className="text-2xl font-semibold text-slate-900">{selectedPage.title}</h2>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
            {t.get('cpc.pages.contentEditor.route')}: {selectedPage.route}
          </div>
        </div>
      </div>

      <ContentEditorForm pageId={selectedPageId} />
    </div>
  );
}
