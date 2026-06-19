import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { queryDocuments } from '@/integrations/firebase/firestore';
import { useAppDateTime } from '@/hooks/useAppDateTime';
import { filterNonDemoTrails } from '@/lib/trailDemoTitles';
import {
  BookOpen,
  Clock,
  Search,
  CheckCircle,
  Play,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';

interface Trail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string | null;
  duration_minutes: number | null;
  modules_count: number | null;
  created_at?: string | null;
}

interface UserProgress {
  trail_id: string;
  progress_percent: number;
  modules_completed: number;
  completed_at: string | null;
}

export default function TrailsPage() {
  const { formatDate } = useAppDateTime();
  const { user } = useAuth();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchTrails = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const trailsData = await queryDocuments<Trail & { is_active?: boolean }>('trails', [
        { field: 'is_active', operator: '==', value: true },
      ]);
      const sorted = filterNonDemoTrails(trailsData || [])
        .filter((trail) => trail.is_active === true)
        .sort((a, b) => {
          const categoryCompare = (a.category || '').localeCompare(b.category || '');
          if (categoryCompare !== 0) return categoryCompare;
          return (a.title || '').localeCompare(b.title || '');
        });
      setTrails(sorted);
    } catch (fetchError) {
      console.error('Error fetching trails:', fetchError);
      setError('Não foi possível carregar as trilhas. Verifique a ligação e tente novamente.');
      setTrails([]);
      setLoading(false);
      return;
    }

    try {
      const progressMap: Record<string, UserProgress> = {};
      if (user) {
        const progressData = await queryDocuments<UserProgress>('user_trail_progress', [
          { field: 'user_id', operator: '==', value: user.uid },
        ]);
        progressData.forEach((p) => {
          progressMap[p.trail_id] = p;
        });
      }
      setUserProgress(progressMap);
    } catch (progressError) {
      console.error('Error fetching trail progress:', progressError);
      setUserProgress({});
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void fetchTrails();
  }, [fetchTrails]);

  const categories = ['all', ...new Set(trails.map((t) => t.category))];

  const filteredTrails = trails.filter((trail) => {
    const matchesSearch =
      trail.title.toLowerCase().includes(search.toLowerCase()) ||
      trail.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || trail.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      work: 'Trabalho',
      health: 'Saúde',
      rights: 'Direitos',
      culture: 'Cultura',
      entrepreneurship: 'Empreendedorismo',
      housing: 'Habitação',
      finance: 'Finanças',
      language: 'Língua',
      all: 'Todas',
    };
    return labels[category] || category;
  };

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-700';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700';
      case 'advanced':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getDifficultyLabel = (difficulty: string | null) => {
    switch (difficulty) {
      case 'beginner':
        return 'Iniciante';
      case 'intermediate':
        return 'Intermédio';
      case 'advanced':
        return 'Avançado';
      default:
        return difficulty;
    }
  };

  const getStatusChip = (trailId: string) => {
    const progress = userProgress[trailId];
    if (!progress) return { label: 'Não iniciada', className: 'bg-muted text-muted-foreground' };
    if (progress.completed_at) return { label: 'Completa', className: 'bg-green-100 text-green-700' };
    if (progress.progress_percent > 0) return { label: 'Em progresso', className: 'bg-blue-100 text-blue-700' };
    return { label: 'Não iniciada', className: 'bg-muted text-muted-foreground' };
  };

  const formatCreatedAt = (value?: string | null) => formatDate(value);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          Trilhas Formativas
        </h1>
        <p className="text-muted-foreground mt-1">Explore conteúdos educativos para apoiar a sua integração</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar trilhas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="cpc-card p-6 animate-pulse">
              <div className="flex items-start justify-between mb-4">
                <div className="h-6 w-20 rounded-full bg-muted" />
                <div className="h-6 w-24 rounded-full bg-muted" />
              </div>
              <div className="h-5 w-3/4 rounded bg-muted mb-3" />
              <div className="h-4 w-full rounded bg-muted mb-2" />
              <div className="h-4 w-2/3 rounded bg-muted mb-6" />
              <div className="h-2 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {error ? (
            <div className="cpc-card p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Ocorreu um problema</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => void fetchTrails()}>
                Tentar novamente
              </Button>
            </div>
          ) : null}

          {filteredTrails.length === 0 ? (
            <div className="cpc-card p-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhuma trilha encontrada</h3>
              <p className="text-muted-foreground">
                {trails.length === 0
                  ? 'Ainda não existem trilhas publicadas.'
                  : 'Tente ajustar os filtros de pesquisa.'}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrails.map((trail) => {
                const progress = userProgress[trail.id];
                const isCompleted = progress?.completed_at !== null;
                const status = getStatusChip(trail.id);

                return (
                  <Link
                    key={trail.id}
                    to={`/dashboard/migrante/trilhas/${trail.id}`}
                    className="cpc-card p-6 hover:border-primary/50 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {getCategoryLabel(trail.category)}
                      </span>
                      {trail.difficulty ? (
                        <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(trail.difficulty)}`}>
                          {getDifficultyLabel(trail.difficulty)}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{trail.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{trail.description}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-4">
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
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        {formatCreatedAt(trail.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${status.className}`}>{status.label}</span>
                      {progress ? (
                        isCompleted ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Completa
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{progress.progress_percent}%</span>
                        )
                      ) : (
                        <span className="flex items-center gap-1 text-primary">
                          <Play className="h-4 w-4" />
                          Começar
                        </span>
                      )}
                    </div>

                    {progress ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {progress.modules_completed}/{trail.modules_count} módulos
                          </span>
                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              Completa
                            </span>
                          ) : (
                            <span>{progress.progress_percent}%</span>
                          )}
                        </div>
                        <Progress value={progress.progress_percent} className="h-2" />
                      </div>
                    ) : (
                      <div className="h-2 rounded bg-muted/60" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
