import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { addDocument, deleteDocument, getDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  Play,
  FileText,
  File,
  ExternalLink,
  List,
  XCircle,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildNewModuleCommentPayload,
  filterCommentsForViewer,
  getCommentStatusLabel,
  queryModuleComments,
  TRAIL_MODULE_COMMENTS_COLLECTION,
  type TrailModuleComment,
} from '@/lib/moduleComments';
import { useAppDateTime } from '@/hooks/useAppDateTime';
import {
  buildQuizDisplayMap,
  mapDisplayAnswerToOriginalIndex,
  type ShuffledQuizOptions,
} from '@/lib/quizOptions';
import { queryTrailModules } from '@/lib/trailModules';

/** TASK-03 — pergunta do quiz (replicado do editor; sem partilhar tipos entre páginas). */
interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

interface Module {
  id: string;
  title: string;
  content_type: string;
  content_text: string | null;
  content_url: string | null;
  content_path?: string | null;
  cover_image_url?: string | null;
  duration_minutes: number | null;
  order_index: number;
  trail_id: string;
  quiz_questions?: QuizQuestion[] | null;
  quiz_passing_score?: number | null;
}

/** TASK-03 — entrada em `quiz_attempts` Firestore. */
interface QuizAttemptDoc {
  id: string;
  user_id: string;
  module_id: string;
  trail_id: string;
  score: number;
  passed: boolean;
  answers: Array<{ questionId: string; selectedIndex: number; correct: boolean }>;
  created_at: string;
}

/** Default da nota mínima quando o módulo não definir explicitamente. TODO(D2). */
const DEFAULT_QUIZ_PASSING_SCORE = 70;

interface Trail {
  id: string;
  title: string;
  modules_count: number | null;
  category: string;
}

interface UserProgress {
  modules_completed: number;
  progress_percent: number;
}

export default function ModuleViewerPage() {
  const { trailId, moduleId } = useParams();
  const { user, profile, profileData } = useAuth();
  const migrantPhotoUrl = profileData?.photoUrl ?? null;
  const migrantName = profileData?.name ?? profile?.name ?? 'Anónimo';
  const { t } = useLanguage();
  const { formatDateTime } = useAppDateTime();
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [trail, setTrail] = useState<Trail | null>(null);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  // TASK-03 — estado do quiz: respostas atuais, último resultado, histórico.
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptDoc[]>([]);
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [quizOptionOrder, setQuizOptionOrder] = useState<Record<string, ShuffledQuizOptions>>({});
  const getLastKey = (trail: string, uid?: string) => `lastModuleViewed:${trail}:${uid || 'anon'}`;

  const [comments, setComments] = useState<TrailModuleComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);

  const visibleComments = useMemo(
    () => filterCommentsForViewer(comments, user?.uid),
    [comments, user?.uid]
  );

  useEffect(() => {
    if (!trailId || !moduleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchData();
    setQuizAnswers({});
    setQuizResult(null);
    setQuizAttempts([]);
  }, [trailId, moduleId, user?.uid]);

  /**
   * TASK-03 — Carrega histórico de tentativas do quiz quando o módulo atual é um quiz.
   * Executado depois de `module` ficar disponível.
   */
  useEffect(() => {
    let cancelled = false;
    async function loadAttempts() {
      if (!module || module.content_type !== 'quiz' || !user?.uid || !moduleId) return;
      try {
        const docs = await queryDocuments<QuizAttemptDoc>(
          'quiz_attempts',
          [
            { field: 'user_id', operator: '==', value: user.uid },
            { field: 'module_id', operator: '==', value: moduleId },
          ]
        );
        if (cancelled) return;
        // Ordena por created_at desc; mais recente em primeiro.
        const sorted = [...docs].sort((a, b) => {
          const ta = Date.parse(a.created_at || '');
          const tb = Date.parse(b.created_at || '');
          return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
        });
        setQuizAttempts(sorted);
      } catch (err) {
        console.error('ModuleViewerPage: falha ao carregar quiz_attempts', err);
      }
    }
    void loadAttempts();
    return () => {
      cancelled = true;
    };
  }, [module, user?.uid, moduleId]);

  useEffect(() => {
    if (module?.content_type === 'quiz' && Array.isArray(module.quiz_questions) && module.quiz_questions.length > 0) {
      setQuizOptionOrder(buildQuizDisplayMap(module.quiz_questions));
      return;
    }
    setQuizOptionOrder({});
  }, [module?.id, module?.content_type, module?.quiz_questions]);

  async function fetchData() {
    if (!trailId || !moduleId) {
      setLoading(false);
      return;
    }

    try {
      const moduleDoc = await getDocument<Module>('trail_modules', moduleId);
      if (moduleDoc) setModule(moduleDoc);
    } catch (error) {
      console.error('Error fetching module:', error);
    }

    try {
      const trailDoc = await getDocument<Trail>('trails', trailId);
      if (trailDoc) setTrail(trailDoc);
    } catch (error) {
      console.error('Error fetching trail:', error);
    }

    try {
      const modulesDocs = await queryTrailModules<Module>(trailId);
      setAllModules(modulesDocs);
    } catch (error) {
      console.error('Error fetching trail modules:', error);
      setAllModules([]);
    }

    try {
      if (user) {
        const progressDocs = await queryDocuments<UserProgress & { trail_id?: string }>(
          'user_trail_progress',
          [{ field: 'user_id', operator: '==', value: user.uid }]
        );
        setUserProgress(progressDocs.find((doc) => doc.trail_id === trailId) || null);
      }
    } catch (error) {
      console.error('Error fetching trail progress:', error);
      setUserProgress(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadComments() {
      if (!moduleId) {
        setComments([]);
        return;
      }
      try {
        const docs = await queryModuleComments(moduleId);
        if (!cancelled) setComments(docs);
      } catch (err) {
        console.error('ModuleViewerPage: falha ao carregar comentários', err);
        if (!cancelled) setComments([]);
      }
    }
    void loadComments();
    return () => {
      cancelled = true;
    };
  }, [moduleId, user?.uid]);

  useEffect(() => {
    if (!trailId || !moduleId || !module) return;
    try {
      const info = { module_id: moduleId, title: module.title };
      localStorage.setItem(getLastKey(trailId as string, user?.uid), JSON.stringify(info));
    } catch (e) { void e; }
  }, [trailId, moduleId, module, user]);

  async function addComment() {
    if (!newComment.trim() || !user?.uid || !trailId || !moduleId) return;
    setPosting(true);
    setCommentError(null);
    try {
      const payload = buildNewModuleCommentPayload({
        trailId,
        moduleId,
        userId: user.uid,
        userName: migrantName,
        avatarUrl: migrantPhotoUrl,
        content: newComment,
      });
      const id = await addDocument(TRAIL_MODULE_COMMENTS_COLLECTION, payload);
      setComments((prev) => [{ id, ...payload }, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('ModuleViewerPage: falha ao publicar comentário', err);
      setCommentError('Não foi possível publicar o comentário. Tente novamente.');
    } finally {
      setPosting(false);
    }
  }

  async function deleteOwnComment(commentId: string) {
    if (!user?.uid) return;
    const target = comments.find((comment) => comment.id === commentId);
    if (!target || target.user_id !== user.uid) return;

    setDeletingCommentId(commentId);
    setCommentError(null);
    try {
      await deleteDocument(TRAIL_MODULE_COMMENTS_COLLECTION, commentId);
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
    } catch (err) {
      console.error('ModuleViewerPage: falha ao apagar comentário', err);
      setCommentError('Não foi possível apagar o comentário. Tente novamente.');
    } finally {
      setDeletingCommentId(null);
    }
  }

  type TrailProgressDoc = {
    id: string;
    trail_id?: string;
    modules_completed: number;
    progress_percent: number;
    completed_at?: string | null;
    started_at?: string | null;
  };

  async function persistTrailProgress(
    newModulesCompleted: number
  ): Promise<{ modules_completed: number; progress_percent: number } | null> {
    if (!user || !trailId) return null;

    const existing = await queryDocuments<TrailProgressDoc>(
      'user_trail_progress',
      [{ field: 'user_id', operator: '==', value: user.uid }]
    );
    const progressDoc = existing.find((doc) => doc.trail_id === trailId);

    const totalModules = trail?.modules_count || allModules.length;
    const clampedCompleted = Math.max(0, Math.min(totalModules, newModulesCompleted));
    const newProgressPercent =
      totalModules > 0 ? Math.round((clampedCompleted / totalModules) * 100) : 0;
    const isComplete = totalModules > 0 ? clampedCompleted >= totalModules : false;
    const nowIso = new Date().toISOString();

    if (progressDoc?.id) {
      const payload: Record<string, unknown> = {
        modules_completed: clampedCompleted,
        progress_percent: newProgressPercent,
        completed_at: isComplete ? nowIso : null,
      };
      if ((progressDoc.modules_completed || 0) === 0 && clampedCompleted > 0 && !progressDoc.started_at) {
        payload.started_at = nowIso;
      }
      await updateDocument('user_trail_progress', progressDoc.id, payload);
    } else {
      await addDocument('user_trail_progress', {
        user_id: user.uid,
        trail_id: trailId,
        modules_completed: clampedCompleted,
        progress_percent: newProgressPercent,
        completed_at: isComplete ? nowIso : null,
        started_at: clampedCompleted > 0 ? nowIso : null,
      });
    }

    return { modules_completed: clampedCompleted, progress_percent: newProgressPercent };
  }

  /**
   * TASK-03 — Marca o módulo atual como concluído (fluxo de quiz).
   * Não navega — apenas escreve.
   */
  async function incrementTrailProgress(): Promise<{ modules_completed: number; progress_percent: number } | null> {
    const moduleIndex = allModules.findIndex((m) => m.id === moduleId);
    if (moduleIndex < 0) return null;
    const currentModulesCompleted = userProgress?.modules_completed || 0;
    const newModulesCompleted = Math.max(currentModulesCompleted, moduleIndex + 1);
    return persistTrailProgress(newModulesCompleted);
  }

  /**
   * TASK-03 — Submete tentativa de quiz: calcula score, salva em `quiz_attempts`,
   * e se passou pela 1ª vez, marca módulo como concluído.
   */
  async function submitQuiz() {
    if (!module || module.content_type !== 'quiz' || !module.quiz_questions || !user || !trailId || !moduleId) return;
    const questions = module.quiz_questions;
    const passingScore =
      typeof module.quiz_passing_score === 'number' && Number.isFinite(module.quiz_passing_score)
        ? module.quiz_passing_score
        : DEFAULT_QUIZ_PASSING_SCORE;

    setQuizSubmitting(true);
    try {
      const answers = questions.map((q) => {
        const displayIndex = quizAnswers[q.id];
        const mapping = quizOptionOrder[q.id]?.displayToOriginal ?? q.options.map((_, index) => index);
        const selectedIndex = mapDisplayAnswerToOriginalIndex(displayIndex, mapping);
        const correct = selectedIndex === q.correctIndex;
        return { questionId: q.id, selectedIndex, correct };
      });
      const correctCount = answers.filter((a) => a.correct).length;
      const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
      const passed = score >= passingScore;
      const nowIso = new Date().toISOString();

      const attemptDoc: Omit<QuizAttemptDoc, 'id'> = {
        user_id: user.uid,
        module_id: moduleId,
        trail_id: trailId,
        score,
        passed,
        answers,
        created_at: nowIso,
      };
      const attemptId = await addDocument('quiz_attempts', attemptDoc);

      // Atualiza histórico local (sem refetch).
      setQuizAttempts((prev) => [{ id: attemptId, ...attemptDoc }, ...prev]);
      setQuizResult({ score, passed });

      // Se passou pela 1ª vez, marca módulo como concluído.
      const previouslyPassed = quizAttempts.some((a) => a.passed === true);
      if (passed && !previouslyPassed) {
        const progress = await incrementTrailProgress();
        if (progress) setUserProgress(progress);
      }
    } catch (err) {
      console.error('Error submitting quiz:', err);
    } finally {
      setQuizSubmitting(false);
    }
  }

  function resetQuiz() {
    if (module?.quiz_questions?.length) {
      setQuizOptionOrder(buildQuizDisplayMap(module.quiz_questions));
    }
    setQuizAnswers({});
    setQuizResult(null);
  }

  const currentIndex = allModules.findIndex((m) => m.id === moduleId);
  const isCurrentModuleCompleted =
    currentIndex >= 0 && currentIndex < (userProgress?.modules_completed || 0);

  async function toggleModuleCompletion() {
    if (!trailId || !module || !user || currentIndex < 0) return;
    setCompleting(true);
    try {
      const currentModulesCompleted = userProgress?.modules_completed || 0;
      const newModulesCompleted = isCurrentModuleCompleted
        ? currentIndex
        : Math.max(currentModulesCompleted, currentIndex + 1);

      const progress = await persistTrailProgress(newModulesCompleted);
      if (progress) setUserProgress(progress);

      if (!isCurrentModuleCompleted) {
        if (currentIndex < allModules.length - 1) {
          navigate(`/dashboard/migrante/trilhas/${trailId}/modulo/${allModules[currentIndex + 1].id}`);
        } else {
          navigate(`/dashboard/migrante/trilhas/${trailId}`);
        }
      }
    } catch (error) {
      console.error('Error toggling module completion:', error);
    } finally {
      setCompleting(false);
    }
  }

  const prevModule = currentIndex > 0 ? allModules[currentIndex - 1] : null;
  const nextModule = currentIndex < allModules.length - 1 ? allModules[currentIndex + 1] : null;
  const progressPercent = userProgress?.progress_percent || 0;

  function ModuleContentIcon({ type, className }: { type: string; className?: string }) {
    const iconClass = cn('shrink-0', className);
    if (type === 'video') return <Play className={iconClass} aria-hidden />;
    if (type === 'pdf') return <File className={iconClass} aria-hidden />;
    if (type === 'quiz') return <HelpCircle className={iconClass} aria-hidden />;
    return <FileText className={iconClass} aria-hidden />;
  }

  function moduleContentTypeLabel(type: string): string {
    if (type === 'video') return 'Vídeo';
    if (type === 'pdf') return 'PDF';
    if (type === 'quiz') return t.get('curriculum.quiz.editor.contentTypeOption');
    return 'Texto';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Módulo não encontrado</p>
        <Link to={`/dashboard/migrante/trilhas/${trailId}`} className="text-primary hover:underline mt-2 inline-block">
          Voltar à trilha
        </Link>
      </div>
    );
  }

  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : url;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb Navigation */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/dashboard/migrante/trilhas" className="hover:text-foreground">
              Trilhas
            </Link>
            <span>/</span>
            <Link to={`/dashboard/migrante/trilhas/${trailId}`} className="hover:text-foreground">
              {trail?.title}
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium truncate max-w-[200px]">{module.title}</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Link
              to={`/dashboard/migrante/trilhas/${trailId}`}
              className="inline-flex items-center text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar para a Trilha
            </Link>

            <div className="flex items-center gap-2 flex-wrap">
              {/* TASK-03: para módulos do tipo 'quiz', a conclusão acontece via submit do quiz; ocultar o botão. */}
              {module.content_type !== 'quiz' ? (
                <Button
                  variant={isCurrentModuleCompleted ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleModuleCompletion}
                  disabled={completing}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {completing
                    ? 'A guardar...'
                    : isCurrentModuleCompleted
                      ? 'Concluída'
                      : 'Marcar como concluída'}
                </Button>
              ) : null}

              {prevModule && (
                <Link to={`/dashboard/migrante/trilhas/${trailId}/modulo/${prevModule.id}`}>
                  <Button variant="outline" size="sm" className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                </Link>
              )}

              {nextModule && (
                <Link to={`/dashboard/migrante/trilhas/${trailId}/modulo/${nextModule.id}`}>
                  <Button variant="outline" size="sm" className="gap-1">
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSidebar(!showSidebar)}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                Ver Módulos
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Content Area */}
          <div className={cn("flex-1 min-w-0", showSidebar ? "lg:pr-6" : "")}>
            {/* Module Title */}
            <h1 className="text-xl md:text-2xl font-bold mb-4">
              {module.title}
            </h1>

            {/* Text module cover */}
            {module.content_type === 'text' && module.cover_image_url ? (
              <div className="mb-6 overflow-hidden rounded-lg border bg-muted/20">
                <img src={module.cover_image_url} alt="" className="h-56 w-full object-cover" />
              </div>
            ) : null}

            {/* Video Content */}
            {module.content_type === 'video' && module.content_url && (
              <div className="aspect-video bg-muted rounded-lg mb-6 overflow-hidden shadow-lg">
                {module.content_url.includes('youtube.com') || module.content_url.includes('youtu.be') ? (
                  <iframe
                    src={getYouTubeEmbedUrl(module.content_url)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={module.content_url}
                    controls
                    className="w-full h-full"
                  />
                )}
              </div>
            )}

            {/* PDF Content */}
            {module.content_type === 'pdf' && module.content_url && (
              <div className="space-y-4 mb-6">
                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden shadow-lg">
                  <iframe
                    src={module.content_url}
                    className="w-full h-full"
                    title={module.title}
                  />
                </div>
                <a
                  href={module.content_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir PDF em nova janela
                </a>
              </div>
            )}

          {/* TASK-03 — Quiz Section: rendered antes do Description quando é quiz. */}
          {module.content_type === 'quiz' && Array.isArray(module.quiz_questions) && module.quiz_questions.length > 0 ? (
            <div data-testid="quiz-viewer-block" className="bg-card rounded-lg border p-6 mb-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold">{t.get('curriculum.quiz.viewer.heading')}</h2>
                <span className="text-xs text-muted-foreground">
                  {t.get('curriculum.quiz.viewer.passingScoreLabel', {
                    score:
                      typeof module.quiz_passing_score === 'number'
                        ? module.quiz_passing_score
                        : DEFAULT_QUIZ_PASSING_SCORE,
                  })}
                </span>
              </div>

              {quizResult ? (
                <div
                  role="status"
                  className={cn(
                    'rounded-lg border p-4 flex items-start gap-3',
                    quizResult.passed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  )}
                >
                  {quizResult.passed ? (
                    <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {quizResult.passed
                        ? t.get('curriculum.quiz.viewer.result.passed')
                        : t.get('curriculum.quiz.viewer.result.failed')}
                    </p>
                    <p className="text-sm">
                      {t.get('curriculum.quiz.viewer.result.score', { score: quizResult.score })}
                    </p>
                    <div className="mt-3">
                      <Button size="sm" variant="outline" onClick={resetQuiz}>
                        {t.get('curriculum.quiz.viewer.tryAgain')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <ol className="space-y-5 list-decimal pl-5">
                    {module.quiz_questions.map((q) => (
                      <li key={q.id}>
                        <p className="font-medium mb-2">{q.question}</p>
                        <div role="radiogroup" aria-label={q.question} className="space-y-2">
                          {(quizOptionOrder[q.id]?.displayOptions ?? q.options).map((opt, displayIdx) => (
                            <label
                              key={`${q.id}-${displayIdx}-${opt}`}
                              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-2 rounded"
                            >
                              <input
                                type="radio"
                                name={`quiz-${q.id}`}
                                value={displayIdx}
                                checked={quizAnswers[q.id] === displayIdx}
                                onChange={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: displayIdx }))}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <Button
                    onClick={submitQuiz}
                    disabled={
                      quizSubmitting ||
                      module.quiz_questions.some((q) => quizAnswers[q.id] === undefined)
                    }
                    className="gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {quizSubmitting
                      ? t.get('curriculum.quiz.viewer.submitting')
                      : t.get('curriculum.quiz.viewer.submit')}
                  </Button>
                </>
              )}

              {/* TASK-03 — Histórico: "Tentativa N" com nota + estado. */}
              {quizAttempts.length > 0 ? (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-2">
                    {t.get('curriculum.quiz.viewer.historyTitle', { count: quizAttempts.length })}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {quizAttempts.map((a, idx) => (
                      <li key={a.id} className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">
                          {t.get('curriculum.quiz.viewer.attemptN', { n: quizAttempts.length - idx })}
                        </span>
                        <span>—</span>
                        <span>{t.get('curriculum.quiz.viewer.result.score', { score: a.score })}</span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            a.passed
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          )}
                        >
                          {a.passed
                            ? t.get('curriculum.quiz.viewer.result.passed')
                            : t.get('curriculum.quiz.viewer.result.failed')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Description Section */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Descrição</h2>
            {module.content_type === 'text' && module.content_text ? (
              <div className="prose prose-slate max-w-none">
                <div dangerouslySetInnerHTML={{ __html: module.content_text }} />
              </div>
            ) : (
              <p className="text-muted-foreground">
                {module.duration_minutes && `Duração estimada: ${module.duration_minutes} minutos`}
              </p>
            )}
          </div>

          <div className="bg-card rounded-lg border p-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">Comentários</h2>
            <div className="flex items-start gap-3 mb-4">
              <Avatar>
                {migrantPhotoUrl ? (
                  <AvatarImage src={migrantPhotoUrl} alt={migrantName} />
                ) : (
                  <AvatarFallback>{migrantName.slice(0, 1)}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder="Escreva um comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="mb-2"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={addComment} disabled={posting || !newComment.trim() || !user?.uid}>
                    {posting ? 'A publicar...' : 'Publicar'}
                  </Button>
                </div>
                {commentError ? <p className="text-sm text-destructive mt-2">{commentError}</p> : null}
              </div>
            </div>

            {visibleComments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não há comentários aprovados. Seja o primeiro a comentar!</p>
            ) : (
              <div className="space-y-4">
                {visibleComments.map((c) => {
                  const statusLabel = getCommentStatusLabel(c.status);
                  const isOwn = c.user_id === user?.uid;
                  return (
                  <div key={c.id} className="flex items-start gap-3">
                    <Avatar>
                      {c.avatar_url ? (
                        <AvatarImage src={c.avatar_url} alt={c.user_name} />
                      ) : (
                        <AvatarFallback>{(c.user_name || 'A').slice(0, 1)}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{c.user_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(c.created_at)}
                        </span>
                        {statusLabel ? (
                          <span
                            className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded-full',
                              c.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            )}
                          >
                            {statusLabel}
                          </span>
                        ) : null}
                      </div>
                      {c.status === 'pending' && isOwn ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          O seu comentário só ficará visível para outros migrantes após aprovação da equipa CPC.
                        </p>
                      ) : null}
                      <p className="text-sm mt-1 break-words">{c.content}</p>
                      {isOwn ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-8 px-2 text-destructive hover:text-destructive"
                          onClick={() => void deleteOwnComment(c.id)}
                          disabled={deletingCommentId === c.id}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {deletingCommentId === c.id ? 'A apagar...' : 'Apagar'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

          {/* Sidebar - Module List */}
          {showSidebar && (
            <div className="hidden lg:block w-80 shrink-0 min-w-0">
              <div className="bg-card rounded-lg border sticky top-4 overflow-hidden">
                {/* Progress Header */}
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-medium leading-snug break-words min-w-0 flex-1">
                      {trail?.title}
                    </span>
                    <span className="text-xs text-primary font-semibold shrink-0">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>

                {/* Module List */}
                <ScrollArea className="h-[400px]">
                  <div className="p-2 pr-3">
                    {allModules.map((mod, index) => {
                      const isCompleted = index < (userProgress?.modules_completed || 0);
                      const isCurrent = mod.id === moduleId;

                      return (
                        <Link
                          key={mod.id}
                          to={`/dashboard/migrante/trilhas/${trailId}/modulo/${mod.id}`}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg transition-colors min-w-0',
                            isCurrent ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                          )}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isCompleted ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : isCurrent ? (
                              <Circle className="h-4 w-4 text-primary fill-primary" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                'text-sm font-medium leading-snug break-words',
                                isCurrent && 'text-primary'
                              )}
                            >
                              {mod.title}
                            </p>
                            {mod.duration_minutes || mod.content_type ? (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <span title={moduleContentTypeLabel(mod.content_type)}>
                                  <ModuleContentIcon type={mod.content_type} className="h-3.5 w-3.5" />
                                </span>
                                {mod.duration_minutes ? <span>{mod.duration_minutes} min</span> : null}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
