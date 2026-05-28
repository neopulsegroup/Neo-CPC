import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { PageId, PAGE_SCHEMAS } from '@/features/cms/pageSchemas';
import { ContentEditorForm } from '@/features/cms/ContentEditorForm';

export default function ContentEditorPage() {
  const [selectedPageId, setSelectedPageId] = useState<PageId>('home');
  const selectedPage = useMemo(
    () => PAGE_SCHEMAS.find((page) => page.id === selectedPageId) ?? PAGE_SCHEMAS[0],
    [selectedPageId]
  );

  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    return (
      <Layout>
        <div className="cpc-container py-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-rose-600">Acesso não autorizado.</p>
            <p className="mt-2 text-sm text-muted-foreground">Apenas administradores podem editar o conteúdo público.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="cpc-container py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Painel de administração</p>
            <h1 className="text-3xl font-semibold text-slate-900">Editor de Conteúdo</h1>
            <p className="mt-2 text-sm text-muted-foreground">Selecione uma página e altere os textos visíveis no site público.</p>
          </div>
          <Button asChild>
            <Link to="/dashboard/cpc">Voltar</Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Páginas</h2>
            <div className="space-y-2">
              {PAGE_SCHEMAS.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setSelectedPageId(page.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    page.id === selectedPageId
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {page.title}
                </button>
              ))}
            </div>
          </aside>

          <main>
            <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Página ativa</p>
                  <h2 className="text-2xl font-semibold text-slate-900">{selectedPage.title}</h2>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">Rota: {selectedPage.route}</div>
              </div>
            </div>

            <ContentEditorForm pageId={selectedPageId} />
          </main>
        </div>
      </div>
    </Layout>
  );
}
