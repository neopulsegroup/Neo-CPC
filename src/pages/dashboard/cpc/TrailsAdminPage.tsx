import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { addDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BookOpen, Plus, Clock, CheckCircle, Sparkles, Image as ImageIcon, AlertTriangle, LayoutGrid, List as ListIcon, Pencil } from 'lucide-react';

interface Trail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string | null;
  duration_minutes: number | null;
  modules_count: number | null;
  is_active: boolean;
  created_at?: string | null;
  image_url?: string | null;
}

const TRAILS_CACHE_KEY = 'cpc-trails-cache:v1';
const TRAILS_CACHE_TTL_MS = 5 * 60 * 1000;

function readTrailsCache(): Trail[] | null {
  try {
    const raw = localStorage.getItem(TRAILS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: Trail[] } | null;
    if (!parsed?.ts || !Array.isArray(parsed.data)) return null;
    if (Date.now() - parsed.ts > TRAILS_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeTrailsCache(data: Trail[]) {
  try {
    localStorage.setItem(TRAILS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    void 0;
  }
}

export default function TrailsAdminPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResults, setSeedResults] = useState<{ title: string; status: 'created' | 'exists' | 'error'; message?: string }[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const raw = localStorage.getItem('cpc-trails:viewMode');
      return raw === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [showDemo, setShowDemo] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cpc-trails-demo:show') === 'true';
    } catch {
      return false;
    }
  });
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'work',
    difficulty: 'beginner',
  });

  const fetchTrails = useCallback(async (isBackgroundRefresh: boolean) => {
    setError(null);
    if (!isBackgroundRefresh) setLoading(true);
    try {
      const data = await queryDocuments<Trail>('trails', [], { field: 'created_at', direction: 'desc' });
      setTrails(data || []);
      writeTrailsCache(data || []);
    } catch (e) {
      console.error('Erro ao carregar trilhas', e);
      setError('Não foi possível carregar as trilhas. Tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = readTrailsCache();
    if (cached?.length) {
      setTrails(cached);
      setLoading(false);
      setRefreshing(true);
    }
    fetchTrails(Boolean(cached?.length));
  }, [fetchTrails]);

  async function createTrail(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const id = await addDocument('trails', {
        title: form.title,
        description: form.description || null,
        category: form.category,
        difficulty: form.difficulty,
        is_active: true,
        modules_count: 0,
        duration_minutes: 0,
        created_at: new Date().toISOString(),
      });
      navigate(`/dashboard/cpc/trilhas/${id}`);
    } catch (e) {
      console.error('Erro ao criar trilha', e);
    } finally {
      setCreating(false);
    }
  }

  async function seedDemo() {
    setSeeding(true);
    setSeedResults([]);
    const demos = [
      {
        title: 'Direitos Laborais em Portugal',
        description: 'Conheça seus direitos e deveres no ambiente de trabalho em Portugal.',
        category: 'rights',
        difficulty: 'beginner',
        modules: [
          { title: 'Introdução aos direitos laborais', type: 'video', url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', duration: 8 },
          { title: 'Contrato de trabalho', type: 'text', text: 'Tipos de contrato, período de prova e rescisão.', duration: 12 },
          { title: 'Segurança Social', type: 'pdf', url: 'https://example.com/seguranca-social.pdf', duration: 15 },
        ],
      },
      {
        title: 'Cultura e Costumes Portugueses',
        description: 'Aspectos culturais, etiqueta e costumes do dia a dia.',
        category: 'culture',
        difficulty: 'beginner',
        modules: [
          { title: 'Boas-vindas à cultura portuguesa', type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: 6 },
          { title: 'Etiqueta e convivência', type: 'text', text: 'Cumprimentos, pontualidade e convivência social.', duration: 10 },
          { title: 'Feriados e tradições', type: 'pdf', url: 'https://example.com/tradicoes.pdf', duration: 10 },
        ],
      },
      {
        title: 'Sistema de Saúde em Portugal',
        description: 'Como aceder aos serviços de saúde e o que esperar.',
        category: 'health',
        difficulty: 'intermediate',
        modules: [
          { title: 'Introdução ao SNS', type: 'video', url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', duration: 7 },
          { title: 'Centros de saúde e hospitais', type: 'text', text: 'Diferenças e quando procurar cada serviço.', duration: 12 },
          { title: 'Documentação necessária', type: 'pdf', url: 'https://example.com/saude-docs.pdf', duration: 8 },
        ],
      },
      {
        title: 'Preparação para o Trabalho',
        description: 'Passos para buscar emprego e preparar o CV.',
        category: 'work',
        difficulty: 'beginner',
        modules: [
          { title: 'Como procurar vagas', type: 'video', url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', duration: 9 },
          { title: 'Construindo o seu CV', type: 'text', text: 'Estrutura, competências e experiências.', duration: 14 },
          { title: 'Entrevistas de emprego', type: 'pdf', url: 'https://example.com/entrevistas.pdf', duration: 12 },
        ],
      },
    ];

    const results: { title: string; status: 'created' | 'exists' | 'error'; message?: string }[] = [];
    try {
      for (const demo of demos) {
        const existing = await queryDocuments<{ id: string }>(
          'trails',
          [{ field: 'title', operator: '==', value: demo.title }],
          undefined,
          1
        );
        if (existing[0]?.id) {
          results.push({ title: demo.title, status: 'exists' });
          continue;
        }

        const trailId = await addDocument('trails', {
          title: demo.title,
          description: demo.description,
          category: demo.category,
          difficulty: demo.difficulty,
          is_active: true,
          modules_count: 0,
          duration_minutes: 0,
          created_at: new Date().toISOString(),
        });

        let order = 1;
        let totalDuration = 0;
        for (const m of demo.modules) {
          totalDuration += m.duration;
          const isText = m.type === 'text';
          try {
            await addDocument('trail_modules', {
              trail_id: trailId,
              title: m.title,
              content_type: m.type,
              content_url: isText ? null : m.url,
              content_text: isText ? m.text : null,
              duration_minutes: m.duration,
              order_index: order,
              created_at: new Date().toISOString(),
            });
          } catch (err) {
            results.push({ title: `${demo.title} - módulo`, status: 'error', message: err instanceof Error ? err.message : 'Falha ao criar módulo' });
          }
          order += 1;
        }

        await updateDocument('trails', trailId, { modules_count: order - 1, duration_minutes: totalDuration });

        results.push({ title: demo.title, status: 'created' });
      }
    } catch (e) {
      results.push({ title: 'seed', status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido' });
    }

    setSeedResults(results);
    setSeeding(false);
    fetchTrails(false);
  }

  const DEMO_TRAILS: Trail[] = [
    {
      id: 'demo-cpc-1',
      title: 'Direitos Laborais em Portugal',
      description: 'Conheça os seus direitos e deveres no ambiente de trabalho em Portugal.',
      category: 'rights',
      difficulty: 'beginner',
      duration_minutes: 35,
      modules_count: 3,
      is_active: true,
      created_at: '2025-01-12T10:00:00.000Z',
      image_url: '/placeholder.svg',
    },
    {
      id: 'demo-cpc-2',
      title: 'Cultura e Costumes Portugueses',
      description: 'Aspetos culturais, etiqueta e costumes do dia a dia.',
      category: 'culture',
      difficulty: 'beginner',
      duration_minutes: 26,
      modules_count: 3,
      is_active: true,
      created_at: '2025-01-18T10:00:00.000Z',
      image_url: '/placeholder.svg',
    },
    {
      id: 'demo-cpc-3',
      title: 'Sistema de Saúde em Portugal',
      description: 'Como aceder ao SNS, documentação necessária e onde procurar ajuda.',
      category: 'health',
      difficulty: 'intermediate',
      duration_minutes: 27,
      modules_count: 3,
      is_active: true,
      created_at: '2025-01-25T10:00:00.000Z',
      image_url: '/placeholder.svg',
    },
    {
      id: 'demo-cpc-4',
      title: 'Preparação para o Trabalho',
      description: 'Procura de vagas, construção de CV e preparação para entrevistas.',
      category: 'work',
      difficulty: 'beginner',
      duration_minutes: 35,
      modules_count: 3,
      is_active: true,
      created_at: '2025-01-30T10:00:00.000Z',
      image_url: '/placeholder.svg',
    },
    {
      id: 'demo-cpc-5',
      title: 'Finanças do Dia a Dia',
      description: 'Orçamento mensal, custos fixos e noções práticas para o dia a dia.',
      category: 'finance',
      difficulty: 'beginner',
      duration_minutes: 22,
      modules_count: 4,
      is_active: true,
      created_at: '2025-02-05T10:00:00.000Z',
      image_url: '/placeholder.svg',
    },
    {
      id: 'demo-cpc-6',
      title: 'Habitação e Arrendamento',
      description: 'Como procurar casa, documentos, contratos e boas práticas de arrendamento.',
      category: 'housing',
      difficulty: 'intermediate',
      duration_minutes: 30,
      modules_count: 5,
      is_active: true,
      created_at: '2025-02-14T10:00:00.000Z',
      image_url: '/placeholder.svg',
    },
  ];

  const categoryLabel: Record<string, string> = {
    work: 'Trabalho',
    health: 'Saúde',
    rights: 'Direitos',
    culture: 'Cultura',
    entrepreneurship: 'Empreendedorismo',
    finance: 'Finanças',
    housing: 'Habitação',
  };

  const difficultyLabel: Record<string, string> = {
    beginner: 'Iniciante',
    intermediate: 'Intermédio',
    advanced: 'Avançado',
  };

  const difficultyClass: Record<string, string> = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700',
  };

  function formatCreatedAt(value?: string | null) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
  }

  function toggleDemo() {
    setShowDemo((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cpc-trails-demo:show', next ? 'true' : 'false');
      } catch {
        void 0;
      }
      return next;
    });
  }

  function setShowDemoPersist(next: boolean) {
    setShowDemo(next);
    try {
      localStorage.setItem('cpc-trails-demo:show', next ? 'true' : 'false');
    } catch {
      void 0;
    }
  }

  function setViewModePersist(next: 'grid' | 'list') {
    setViewMode(next);
    try {
      localStorage.setItem('cpc-trails:viewMode', next);
    } catch {
      void 0;
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary shrink-0" aria-hidden />
            {t.get('cpc.pages.trails.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.pages.trails.subtitle')}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 cpc-card p-6">
          <h2 className="font-semibold mb-4">Trilhas existentes</h2>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={seedDemo} disabled={seeding}>
                {seeding ? 'A criar...' : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar trilhas demo
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={toggleDemo} className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {showDemo ? 'Ocultar demonstração' : 'Mostrar demonstração'}
              </Button>
              {refreshing ? (
                <span className="text-xs text-muted-foreground">Atualizando…</span>
              ) : null}
            </div>

            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => {
                if (v === 'grid' || v === 'list') setViewModePersist(v);
              }}
              variant="outline"
              size="sm"
              className="rounded-lg border border-input bg-background p-1"
            >
              <ToggleGroupItem value="grid" aria-label="Ver em grade" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Grade
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Ver em lista" className="flex items-center gap-2">
                <ListIcon className="h-4 w-4" />
                Lista
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {seedResults.length > 0 && (
            <div className="mb-6 space-y-2">
              {seedResults.map((r) => (
                <div key={`${r.title}-${r.status}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span className="font-medium">{r.title}</span>
                  <span className={r.status === 'created' ? 'text-green-600' : r.status === 'exists' ? 'text-amber-600' : 'text-red-600'}>
                    {r.status}
                    {r.message ? `: ${r.message}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          {error ? (
            <div className="mb-6 rounded-md border p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Ocorreu um problema</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => fetchTrails(false)}>Tentar novamente</Button>
                    <Button onClick={() => setShowDemoPersist(true)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Ver demonstração
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : trails.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma trilha criada ainda.</div>
          ) : (
            <div key={viewMode} className="animate-fade-in">
              {viewMode === 'grid' ? (
                <div aria-label="Trilhas existentes - grade" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {trails.map((trail) => (
                    <Link
                      key={trail.id}
                      to={`/dashboard/cpc/trilhas/${trail.id}`}
                      className="cpc-card p-4 hover:border-primary/50 transition-colors"
                    >
                      {trail.image_url ? (
                        <div className="mb-3 overflow-hidden rounded-xl border bg-muted/20">
                          <img src={trail.image_url} alt="" className="h-28 w-full object-cover" />
                        </div>
                      ) : (
                        <div className="mb-3 overflow-hidden rounded-xl border bg-muted/20 h-28 w-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {categoryLabel[trail.category] || trail.category}
                        </span>
                        {trail.is_active ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Ativa</span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Inativa</span>
                        )}
                      </div>
                      <h3 className="font-medium mb-1">{trail.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{trail.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          {trail.modules_count || 0} módulos
                        </span>
                        {trail.duration_minutes ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {trail.duration_minutes} min
                          </span>
                        ) : null}
                        {trail.modules_count && trail.modules_count > 0 ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Conteúdo
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Criada em: {formatCreatedAt(trail.created_at)}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div aria-label="Trilhas existentes - lista" role="list" className="space-y-3">
                  {trails.map((trail) => (
                    <div
                      key={trail.id}
                      role="listitem"
                      className="rounded-xl border bg-background/60 p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="w-full sm:w-36 h-24 rounded-xl border bg-muted/20 overflow-hidden flex items-center justify-center text-muted-foreground shrink-0">
                          {trail.image_url ? (
                            <img src={trail.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-5 w-5" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                to={`/dashboard/cpc/trilhas/${trail.id}`}
                                className="font-semibold leading-tight hover:underline block truncate"
                              >
                                {trail.title}
                              </Link>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                  {categoryLabel[trail.category] || trail.category}
                                </span>
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${difficultyClass[trail.difficulty || 'beginner'] || difficultyClass.beginner}`}
                                >
                                  {difficultyLabel[trail.difficulty || 'beginner'] || trail.difficulty || 'Iniciante'}
                                </span>
                                {trail.is_active ? (
                                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Ativa</span>
                                ) : (
                                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Inativa</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button asChild variant="outline" size="sm" className="gap-2">
                                <Link to={`/dashboard/cpc/trilhas/${trail.id}`}>
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </Link>
                              </Button>
                            </div>
                          </div>

                          <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                            {trail.description || '—'}
                          </p>

                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                            <div>Criada em: {formatCreatedAt(trail.created_at)}</div>
                            <div>{trail.modules_count || 0} módulos</div>
                            <div>{trail.duration_minutes ? `${trail.duration_minutes} min` : '—'}</div>
                            <div>{trail.modules_count && trail.modules_count > 0 ? 'Conteúdo' : 'Sem conteúdo'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="cpc-card p-6">
          <h2 className="font-semibold mb-4">Nova Trilha</h2>
          <form onSubmit={createTrail} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Título *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Descrição</label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="work">Trabalho</option>
                  <option value="health">Saúde</option>
                  <option value="rights">Direitos</option>
                  <option value="culture">Cultura</option>
                  <option value="entrepreneurship">Empreendedorismo</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Nível</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="beginner">Iniciante</option>
                  <option value="intermediate">Intermédio</option>
                  <option value="advanced">Avançado</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? 'A criar...' : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Trilha
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {showDemo ? (
        <div className="mt-6 cpc-card p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Conteúdos de demonstração
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Exemplos fictícios para pré-visualização. Não são gravados na base de dados.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-amber-100 text-amber-900 w-fit">
              <Sparkles className="h-4 w-4" />
              Demo
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_TRAILS.map((trail) => (
              <div key={trail.id} className="cpc-card p-4">
                <div className="mb-3 overflow-hidden rounded-xl border bg-muted/20">
                  <img src={trail.image_url || '/placeholder.svg'} alt="" className="h-28 w-full object-cover" />
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {categoryLabel[trail.category] || trail.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-900 inline-flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      Demo
                    </span>
                    {trail.difficulty ? (
                      <span className={`text-xs px-2 py-1 rounded-full ${difficultyClass[trail.difficulty] || 'bg-muted text-muted-foreground'}`}>
                        {difficultyLabel[trail.difficulty] || trail.difficulty}
                      </span>
                    ) : null}
                  </div>
                </div>

                <h3 className="font-medium mb-1">{trail.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{trail.description}</p>

                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {trail.modules_count || 0} módulos
                  </span>
                  {trail.duration_minutes ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {trail.duration_minutes} min
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Criada em: {formatCreatedAt(trail.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
