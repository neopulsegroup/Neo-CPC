import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppDateTime } from '@/hooks/useAppDateTime';
import { addDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { storage } from '@/integrations/firebase/client';
import { filterNonDemoTrails } from '@/lib/trailDemoTitles';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getDownloadURL, ref as makeStorageRef, uploadBytes } from 'firebase/storage';
import {
  BookOpen,
  Plus,
  Clock,
  CheckCircle,
  Image as ImageIcon,
  AlertTriangle,
  LayoutGrid,
  List as ListIcon,
  Pencil,
  Upload,
  Loader2,
} from 'lucide-react';

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
const COVER_ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const COVER_MAX_BYTES = 6 * 1024 * 1024;

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'work',
  difficulty: 'beginner',
};

function readTrailsCache(): Trail[] | null {
  try {
    const raw = localStorage.getItem(TRAILS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: Trail[] } | null;
    if (!parsed?.ts || !Array.isArray(parsed.data)) return null;
    if (Date.now() - parsed.ts > TRAILS_CACHE_TTL_MS) return null;
    return filterNonDemoTrails(parsed.data);
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
  const { formatDate } = useAppDateTime();
  const { user } = useAuth();
  const navigate = useNavigate();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const raw = localStorage.getItem('cpc-trails:viewMode');
      return raw === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [togglingTrailId, setTogglingTrailId] = useState<string | null>(null);

  const fetchTrails = useCallback(async (isBackgroundRefresh: boolean) => {
    setError(null);
    if (!isBackgroundRefresh) setLoading(true);
    try {
      const data = await queryDocuments<Trail>('trails', [], { field: 'created_at', direction: 'desc' });
      const realTrails = filterNonDemoTrails(data || []);
      setTrails(realTrails);
      writeTrailsCache(realTrails);
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

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(coverFile);
    setCoverPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile]);

  function resetCreateForm() {
    setForm(EMPTY_FORM);
    setCoverFile(null);
    setCoverPreview(null);
    setCreateError(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open);
    if (!open) resetCreateForm();
  }

  function handleCoverPick(file: File | null) {
    setCreateError(null);
    if (!file) {
      setCoverFile(null);
      return;
    }
    if (!COVER_ALLOWED_MIME.has(file.type)) {
      setCreateError('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }
    if (file.size > COVER_MAX_BYTES) {
      setCreateError('A imagem deve ter no máximo 6 MB.');
      return;
    }
    setCoverFile(file);
  }

  async function createTrail(e: FormEvent) {
    e.preventDefault();
    if (!user?.uid) {
      setCreateError('Sessão inválida. Inicie sessão novamente.');
      return;
    }
    if (!form.title.trim()) {
      setCreateError('Indique o título da trilha.');
      return;
    }
    if (!coverFile) {
      setCreateError('Selecione uma imagem de capa.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const safeName = coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `profile_photos/${user.uid}/trail_covers/${Date.now()}_${safeName}`;
      const storageRef = makeStorageRef(storage, path);
      await uploadBytes(storageRef, coverFile, { contentType: coverFile.type });
      const imageUrl = await getDownloadURL(storageRef);

      const id = await addDocument('trails', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        difficulty: form.difficulty,
        image_url: imageUrl,
        image_path: path,
        is_active: true,
        modules_count: 0,
        duration_minutes: 0,
        created_at: new Date().toISOString(),
      });
      handleCreateOpenChange(false);
      navigate(`/dashboard/cpc/trilhas/${id}`);
    } catch (e) {
      console.error('Erro ao criar trilha', e);
      setCreateError('Não foi possível criar a trilha. Tente novamente.');
    } finally {
      setCreating(false);
    }
  }

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
    return formatDate(value);
  }

  function setViewModePersist(next: 'grid' | 'list') {
    setViewMode(next);
    try {
      localStorage.setItem('cpc-trails:viewMode', next);
    } catch {
      void 0;
    }
  }

  async function toggleTrailActive(trailId: string, nextActive: boolean) {
    setTogglingTrailId(trailId);
    try {
      await updateDocument('trails', trailId, { is_active: nextActive });
      setTrails((prev) => {
        const next = prev.map((trail) =>
          trail.id === trailId ? { ...trail, is_active: nextActive } : trail
        );
        writeTrailsCache(next);
        return next;
      });
    } catch (e) {
      console.error('Erro ao atualizar estado da trilha', e);
    } finally {
      setTogglingTrailId(null);
    }
  }

  function renderTrailActiveSwitch(trail: Trail) {
    const switchId = `trail-active-${trail.id}`;
    return (
      <div
        className="flex items-center gap-2"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Switch
          id={switchId}
          checked={trail.is_active === true}
          disabled={togglingTrailId === trail.id}
          onCheckedChange={(checked) => void toggleTrailActive(trail.id, checked)}
          aria-label={trail.is_active ? 'Desativar trilha' : 'Ativar trilha'}
        />
        <Label htmlFor={switchId} className="text-xs text-muted-foreground cursor-pointer">
          {trail.is_active ? 'Ativa' : 'Inativa'}
        </Label>
      </div>
    );
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

      <div className="cpc-card p-6 w-full">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-lg">Trilhas existentes</h2>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {refreshing ? <span className="text-xs text-muted-foreground">Atualizando…</span> : null}
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
            <Button type="button" className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Criar Trilha
            </Button>
          </div>
        </div>

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
                  <Button variant="outline" onClick={() => fetchTrails(false)}>
                    Tentar novamente
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
              <div aria-label="Trilhas existentes - grade" className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {trails.map((trail) => (
                  <div key={trail.id} className="cpc-card p-4 flex flex-col hover:border-primary/50 transition-colors">
                    <Link to={`/dashboard/cpc/trilhas/${trail.id}`} className="block flex-1 min-h-0">
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
                      <div className="mt-3 text-xs text-muted-foreground">Criada em: {formatCreatedAt(trail.created_at)}</div>
                    </Link>
                    <div className="mt-3 border-t pt-3">{renderTrailActiveSwitch(trail)}</div>
                  </div>
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
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {renderTrailActiveSwitch(trail)}
                            <Button asChild variant="outline" size="sm" className="gap-2">
                              <Link to={`/dashboard/cpc/trilhas/${trail.id}`}>
                                <Pencil className="h-4 w-4" />
                                Editar
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{trail.description || '—'}</p>

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

      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Trilha</DialogTitle>
          </DialogHeader>
          <form onSubmit={createTrail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trail-cover">Imagem de capa *</Label>
              <div className="overflow-hidden rounded-xl border bg-muted/20">
                {coverPreview ? (
                  <img src={coverPreview} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={creating}
                >
                  <Upload className="h-4 w-4" />
                  {coverFile ? 'Alterar imagem' : 'Selecionar imagem'}
                </Button>
                {coverFile ? (
                  <span className="text-xs text-muted-foreground truncate max-w-[220px]">{coverFile.name}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">JPG, PNG ou WebP (máx. 6 MB)</span>
                )}
              </div>
              <input
                ref={coverInputRef}
                id="trail-cover"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => handleCoverPick(e.currentTarget.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trail-title">Título *</Label>
              <Input
                id="trail-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trail-description">Descrição</Label>
              <Textarea
                id="trail-description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trail-category">Categoria</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger id="trail-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10050]" position="popper">
                    <SelectItem value="work">Trabalho</SelectItem>
                    <SelectItem value="health">Saúde</SelectItem>
                    <SelectItem value="rights">Direitos</SelectItem>
                    <SelectItem value="culture">Cultura</SelectItem>
                    <SelectItem value="entrepreneurship">Empreendedorismo</SelectItem>
                    <SelectItem value="finance">Finanças</SelectItem>
                    <SelectItem value="housing">Habitação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trail-level">Nível</Label>
                <Select value={form.difficulty} onValueChange={(value) => setForm({ ...form, difficulty: value })}>
                  <SelectTrigger id="trail-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[10050]" position="popper">
                    <SelectItem value="beginner">Iniciante</SelectItem>
                    <SelectItem value="intermediate">Intermédio</SelectItem>
                    <SelectItem value="advanced">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {createError ? <p className="text-sm text-red-600">{createError}</p> : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleCreateOpenChange(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating} className="gap-2">
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A criar…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Criar Trilha
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
