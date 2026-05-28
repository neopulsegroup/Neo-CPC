import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { addDocument, getDocument, queryDocuments } from '@/integrations/firebase/firestore';
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
  const isDemo = !!trailId && trailId.startsWith('demo-');
  const getDemoKey = (id: string) => `demoTrailProgress:${id}:${user?.uid || 'anon'}`;

  useEffect(() => {
    if (trailId) fetchTrailDetails();
  }, [trailId, user]);

  async function fetchTrailDetails() {
    try {
      if (isDemo) {
        const demoTrails: Record<string, Trail> = {
          'demo-trail-1': { id: 'demo-trail-1', title: 'Direitos Laborais em Portugal', description: 'Conheça seus direitos e deveres no ambiente de trabalho em Portugal.', category: 'rights', difficulty: 'beginner', duration_minutes: 35, modules_count: 3 },
          'demo-trail-2': { id: 'demo-trail-2', title: 'Cultura e Costumes Portugueses', description: 'Aspectos culturais, etiqueta e costumes do dia a dia.', category: 'culture', difficulty: 'beginner', duration_minutes: 26, modules_count: 3 },
          'demo-trail-3': { id: 'demo-trail-3', title: 'Sistema de Saúde em Portugal', description: 'Como aceder aos serviços de saúde e o que esperar.', category: 'health', difficulty: 'intermediate', duration_minutes: 27, modules_count: 3 },
          'demo-trail-4': { id: 'demo-trail-4', title: 'Preparação para o Trabalho', description: 'Passos para buscar emprego e preparar o CV.', category: 'work', difficulty: 'beginner', duration_minutes: 35, modules_count: 3 },
        };
        const demoModules: Record<string, Module[]> = {
          'demo-trail-1': [
            { id: 'demo-module-1-1', title: 'Introdução aos direitos laborais', content_type: 'video', duration_minutes: 8, order_index: 1 },
            { id: 'demo-module-1-2', title: 'Contrato de trabalho', content_type: 'text', duration_minutes: 12, order_index: 2 },
            { id: 'demo-module-1-3', title: 'Segurança Social', content_type: 'pdf', duration_minutes: 15, order_index: 3 },
          ],
          'demo-trail-2': [
            { id: 'demo-module-2-1', title: 'Boas-vindas à cultura portuguesa', content_type: 'video', duration_minutes: 6, order_index: 1 },
            { id: 'demo-module-2-2', title: 'Etiqueta e convivência', content_type: 'text', duration_minutes: 10, order_index: 2 },
            { id: 'demo-module-2-3', title: 'Feriados e tradições', content_type: 'pdf', duration_minutes: 10, order_index: 3 },
          ],
          'demo-trail-3': [
            { id: 'demo-module-3-1', title: 'Introdução ao SNS', content_type: 'video', duration_minutes: 7, order_index: 1 },
            { id: 'demo-module-3-2', title: 'Centros de saúde e hospitais', content_type: 'text', duration_minutes: 12, order_index: 2 },
            { id: 'demo-module-3-3', title: 'Documentação necessária', content_type: 'pdf', duration_minutes: 8, order_index: 3 },
          ],
          'demo-trail-4': [
            { id: 'demo-module-4-1', title: 'Como procurar vagas', content_type: 'video', duration_minutes: 9, order_index: 1 },
            { id: 'demo-module-4-2', title: 'Construindo o seu CV', content_type: 'text', duration_minutes: 14, order_index: 2 },
            { id: 'demo-module-4-3', title: 'Entrevistas de emprego', content_type: 'pdf', duration_minutes: 12, order_index: 3 },
          ],
        };
        const t = demoTrails[trailId as string] || null;
        const m = demoModules[trailId as string] || [];
        setTrail(t);
        setModules(m);
        const raw = localStorage.getItem(getDemoKey(trailId as string));
        if (raw) {
          try {
            const val = JSON.parse(raw) as UserProgress;
            setProgress(val);
          } catch { void 0; }
        }
      } else {
        const trailData = await getDocument<Trail>('trails', trailId as string);
        if (trailData) setTrail(trailData);

        const modulesData = await queryDocuments<Module>(
          'trail_modules',
          [{ field: 'trail_id', operator: '==', value: trailId }],
          { field: 'order_index', direction: 'asc' }
        );
        setModules(modulesData);

        if (user) {
          const progressDocs = await queryDocuments<UserProgress>(
            'user_trail_progress',
            [
              { field: 'trail_id', operator: '==', value: trailId },
              { field: 'user_id', operator: '==', value: user.uid },
            ],
            undefined,
            1
          );
          setProgress(progressDocs[0] || null);
        }
      }
    } catch (error) {
      console.error('Error fetching trail details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function startTrail() {
    if (!trailId) return;
    if (isDemo) {
      const demo = { id: 'demo-progress', progress_percent: 0, modules_completed: 0, completed_at: null };
      localStorage.setItem(getDemoKey(trailId), JSON.stringify(demo));
      setProgress(demo);
      return;
    }
    if (!user) return;
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
