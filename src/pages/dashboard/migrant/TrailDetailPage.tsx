import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { addDocument, getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { queryTrailModules } from '@/lib/trailModules';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Play,
  CheckCircle,
  FileText,
  Video,
  File,
} from 'lucide-react';

interface Trail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string | null;
  duration_minutes: number | null;
  modules_count: number | null;
}

interface Module {
  id: string;
  title: string;
  content_type: string;
  duration_minutes: number | null;
  order_index: number;
}

interface UserProgress {
  id: string;
  progress_percent: number;
  modules_completed: number;
  completed_at: string | null;
}

export default function TrailDetailPage() {
  const { trailId } = useParams();
  const { user } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trailId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchTrailDetails();
  }, [trailId, user?.uid]);

  async function fetchTrailDetails() {
    if (!trailId) return;

    try {
      const trailData = await getDocument<Trail>('trails', trailId);
      if (trailData) setTrail(trailData);
    } catch (error) {
      console.error('Error fetching trail:', error);
    }

    try {
      const modulesData = await queryTrailModules<Module>(trailId);
      setModules(modulesData);
    } catch (error) {
      console.error('Error fetching trail modules:', error);
      setModules([]);
    }

    try {
      if (user) {
        const progressDocs = await queryDocuments<UserProgress & { trail_id?: string }>(
          'user_trail_progress',
          [{ field: 'user_id', operator: '==', value: user.uid }]
        );
        setProgress(progressDocs.find((doc) => doc.trail_id === trailId) || null);
      }
    } catch (error) {
      console.error('Error fetching trail progress:', error);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }

  async function startTrail() {
    if (!trailId || !user) return;
    const id = await addDocument('user_trail_progress', {
      user_id: user.uid,
      trail_id: trailId,
      progress_percent: 0,
      modules_completed: 0,
      completed_at: null,
    });
    setProgress({ id, progress_percent: 0, modules_completed: 0, completed_at: null });
  }

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video': return Video;
      case 'text': return FileText;
      case 'pdf': return File;
      default: return FileText;
    }
  };

  const getContentLabel = (type: string) => {
    switch (type) {
      case 'video': return 'Vídeo';
      case 'text': return 'Artigo';
      case 'pdf': return 'PDF';
      default: return type;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'work': 'Trabalho',
      'health': 'Saúde',
      'rights': 'Direitos',
      'culture': 'Cultura',
      'entrepreneurship': 'Empreendedorismo',
    };
    return labels[category] || category;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Trilha não encontrada</p>
        <Link to="/dashboard/migrante/trilhas" className="text-primary hover:underline mt-2 inline-block">
          Voltar às trilhas
        </Link>
      </div>
    );
  }

  const isCompleted = progress?.completed_at !== null;

  return (
    <>
      {/* Back link */}
      <Link
        to="/dashboard/migrante/trilhas"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar às trilhas
      </Link>

      {/* Trail Header */}
      <div className="cpc-card p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                {getCategoryLabel(trail.category)}
              </span>
              {trail.difficulty && (
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  {trail.difficulty === 'beginner' ? 'Iniciante' : trail.difficulty === 'intermediate' ? 'Intermédio' : 'Avançado'}
                </span>
              )}
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold mb-3">{trail.title}</h1>
            <p className="text-muted-foreground mb-4">{trail.description}</p>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {modules.length} módulos
              </span>
              {trail.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {trail.duration_minutes} min
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
            {progress ? (
              <>
                <div className="text-right">
                  {isCompleted ? (
                    <span className="flex items-center gap-2 text-green-600 font-medium">
                      <CheckCircle className="h-5 w-5" />
                      Trilha Completa
                    </span>
                  ) : (
                    <span className="text-lg font-semibold">{progress.progress_percent}% completa</span>
                  )}
                </div>
                <Progress value={progress.progress_percent} className="w-48 h-2" />
              </>
            ) : (
              <Button size="lg" onClick={startTrail}>
                <Play className="h-5 w-5 mr-2" />
                Começar Trilha
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modules List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Módulos</h2>
        
        {modules.length === 0 ? (
          <div className="cpc-card p-8 text-center">
            <p className="text-muted-foreground">Esta trilha ainda não tem módulos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((module, index) => {
              const ContentIcon = getContentIcon(module.content_type);
              const isModuleCompleted = completedModules.has(module.id);
              const canAccess = progress !== null;

              return (
                <div
                  key={module.id}
                  className={`cpc-card p-4 ${canAccess ? 'hover:border-primary/50' : 'opacity-60'} transition-all`}
                >
                  {canAccess ? (
                    <Link
                      to={`/dashboard/migrante/trilhas/${trailId}/modulo/${module.id}`}
                      className="flex items-center gap-4"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isModuleCompleted ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'
                      }`}>
                        {isModuleCompleted ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <span className="font-semibold">{index + 1}</span>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-medium">{module.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ContentIcon className="h-3 w-3" />
                            {getContentLabel(module.content_type)}
                          </span>
                          {module.duration_minutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {module.duration_minutes} min
                            </span>
                          )}
                        </div>
                      </div>

                      <Play className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <span className="font-semibold text-muted-foreground">{index + 1}</span>
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-medium text-muted-foreground">{module.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Inicie a trilha para aceder a este conteúdo
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
