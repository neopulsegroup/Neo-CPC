import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDocument, deleteDocument, getDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  BookOpen,
  ArrowLeft,
  Save,
  Plus,
  Clock,
  FileText,
  Video,
  File as FileIcon,
  ArrowUp,
  ArrowDown,
  Trash2,
  HelpCircle,
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
}

/** TASK-03: estrutura de uma pergunta de quiz dentro de um módulo. */
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
  duration_minutes: number | null;
  order_index: number;
  trail_id: string;
  // TASK-03 — campos do quiz (opcionais; só populados quando content_type === 'quiz').
  quiz_questions?: QuizQuestion[] | null;
  quiz_passing_score?: number | null;
}

/**
 * Default da nota mínima para passar no quiz.
 * TODO(D2): confirmar com CIBEA antes de produção (ver docs/CLIENT_DECISIONS.md).
 */
const DEFAULT_QUIZ_PASSING_SCORE = 70;

function generateQuestionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeEmptyQuestion(): QuizQuestion {
  return { id: generateQuestionId(), question: '', options: ['', ''], correctIndex: 0 };
}

/** Validação centralizada do quiz; devolve null se ok ou chave i18n do erro. */
function validateQuizDraft(args: {
  questions: QuizQuestion[];
  passing_score: number;
}): string | null {
  if (args.questions.length < 1) return 'curriculum.quiz.editor.validation.minQuestions';
  for (const q of args.questions) {
    if (!q.question.trim()) return 'curriculum.quiz.editor.validation.questionEmpty';
    if (q.options.length < 2) return 'curriculum.quiz.editor.validation.minOptions';
    if (q.options.length > 6) return 'curriculum.quiz.editor.validation.maxOptions';
    if (q.options.some((o) => !o.trim())) return 'curriculum.quiz.editor.validation.optionEmpty';
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      return 'curriculum.quiz.editor.validation.markCorrect';
    }
  }
  if (!Number.isFinite(args.passing_score) || args.passing_score < 0 || args.passing_score > 100) {
    return 'curriculum.quiz.editor.validation.scoreRange';
  }
  return null;
}

export default function TrailEditorPage() {
  const { trailId } = useParams();
  const { t } = useLanguage();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newModule, setNewModule] = useState({
    title: '',
    content_type: 'video',
    content_url: '',
    content_text: '',
    duration_minutes: 10,
  });
  // TASK-03 — estado do rascunho de quiz (separado para não poluir newModule quando type !== 'quiz').
  const [newQuiz, setNewQuiz] = useState<{ passing_score: number; questions: QuizQuestion[] }>({
    passing_score: DEFAULT_QUIZ_PASSING_SCORE,
    questions: [makeEmptyQuestion()],
  });
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    if (trailId) fetchData();
  }, [trailId]);

  async function fetchData() {
    try {
      if (!trailId) return;
      const [trailDoc, mods] = await Promise.all([
        getDocument<Trail>('trails', trailId),
        queryDocuments<Module>(
          'trail_modules',
          [{ field: 'trail_id', operator: '==', value: trailId }],
          { field: 'order_index', direction: 'asc' }
        ),
      ]);
      if (trailDoc) setTrail(trailDoc);
      setModules(mods || []);
    } catch (e) {
      console.error('Erro ao carregar trilha/módulos', e);
    } finally {
      setLoading(false);
    }
  }

  const totalDuration = useMemo(
    () => modules.reduce((sum, m) => sum + (m.duration_minutes || 0), 0),
    [modules]
  );

  async function saveTrail(e: FormEvent) {
    e.preventDefault();
    if (!trail) return;
    setSaving(true);
    try {
      await updateDocument('trails', trail.id, {
        title: trail.title,
        description: trail.description,
        category: trail.category,
        difficulty: trail.difficulty,
        is_active: trail.is_active,
        modules_count: modules.length,
        duration_minutes: totalDuration,
      });
    } catch (e) {
      console.error('Erro ao guardar trilha', e);
    } finally {
      setSaving(false);
    }
  }

  async function addModule(e: FormEvent) {
    e.preventDefault();
    if (!trailId || !newModule.title) return;
    setQuizError(null);

    // TASK-03 — validar estrutura do quiz antes de gravar (mínimo 1 pergunta, opções, correcta marcada).
    let quizPayload: { quiz_questions: QuizQuestion[]; quiz_passing_score: number } | null = null;
    if (newModule.content_type === 'quiz') {
      const errKey = validateQuizDraft(newQuiz);
      if (errKey) {
        setQuizError(errKey);
        return;
      }
      quizPayload = {
        quiz_questions: newQuiz.questions.map((q) => ({
          id: q.id,
          question: q.question.trim(),
          options: q.options.map((o) => o.trim()),
          correctIndex: q.correctIndex,
        })),
        quiz_passing_score: newQuiz.passing_score,
      };
    }

    try {
      const order_index = modules.length + 1;
      const isQuiz = newModule.content_type === 'quiz';
      const isText = newModule.content_type === 'text';
      const baseDoc = {
        trail_id: trailId,
        title: newModule.title,
        content_type: newModule.content_type,
        content_url: !isText && !isQuiz ? (newModule.content_url || null) : null,
        content_text: isText ? (newModule.content_text || null) : null,
        duration_minutes: newModule.duration_minutes || null,
        order_index,
        created_at: new Date().toISOString(),
        ...(quizPayload ?? {}),
      };
      const id = await addDocument('trail_modules', baseDoc);
      setModules([
        ...modules,
        {
          id,
          trail_id: trailId,
          title: newModule.title,
          content_type: newModule.content_type,
          content_url: !isText && !isQuiz ? (newModule.content_url || null) : null,
          content_text: isText ? (newModule.content_text || null) : null,
          duration_minutes: newModule.duration_minutes || null,
          order_index,
          quiz_questions: quizPayload?.quiz_questions ?? null,
          quiz_passing_score: quizPayload?.quiz_passing_score ?? null,
        },
      ]);
      setNewModule({ title: '', content_type: 'video', content_url: '', content_text: '', duration_minutes: 10 });
      setNewQuiz({ passing_score: DEFAULT_QUIZ_PASSING_SCORE, questions: [makeEmptyQuestion()] });
    } catch (e) {
      console.error('Erro ao adicionar módulo', e);
    }
  }

  async function reorderModule(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;
    const a = modules[index];
    const b = modules[targetIndex];
    try {
      await updateDocument('trail_modules', a.id, { order_index: b.order_index });
      await updateDocument('trail_modules', b.id, { order_index: a.order_index });
      const updated = [...modules];
      updated[index] = { ...b, order_index: a.order_index };
      updated[targetIndex] = { ...a, order_index: b.order_index };
      setModules(updated);
    } catch (e) {
      console.error('Erro ao reordenar módulo', e);
    }
  }

  async function deleteModule(moduleId: string) {
    try {
      await deleteDocument('trail_modules', moduleId);
      const remaining = modules.filter(m => m.id !== moduleId).map((m, i) => ({ ...m, order_index: i + 1 }));
      setModules(remaining);
      for (const m of remaining) {
        await updateDocument('trail_modules', m.id, { order_index: m.order_index });
      }
    } catch (e) {
      console.error('Erro ao apagar módulo', e);
    }
  }

  function ContentIcon({ type }: { type: string }) {
    if (type === 'video') return <Video className="h-4 w-4" />;
    if (type === 'pdf') return <FileIcon className="h-4 w-4" />;
    if (type === 'quiz') return <HelpCircle className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  }

  /* ------------------------------------------------------------------ */
  /* TASK-03 — Helpers de edição do quiz draft.                         */
  /* ------------------------------------------------------------------ */
  function addQuizQuestion() {
    if (newQuiz.questions.length >= 5) return; // 3-5 é a recomendação do plano; cap em 5.
    setNewQuiz((q) => ({ ...q, questions: [...q.questions, makeEmptyQuestion()] }));
  }
  function removeQuizQuestion(qid: string) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.length <= 1 ? q.questions : q.questions.filter((qq) => qq.id !== qid),
    }));
  }
  function updateQuizQuestionText(qid: string, text: string) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) => (qq.id === qid ? { ...qq, question: text } : qq)),
    }));
  }
  function addQuizOption(qid: string) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) =>
        qq.id === qid && qq.options.length < 6 ? { ...qq, options: [...qq.options, ''] } : qq
      ),
    }));
  }
  function removeQuizOption(qid: string, optIdx: number) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) => {
        if (qq.id !== qid || qq.options.length <= 2) return qq;
        const nextOptions = qq.options.filter((_, i) => i !== optIdx);
        const nextCorrect =
          qq.correctIndex === optIdx
            ? 0
            : qq.correctIndex > optIdx
            ? qq.correctIndex - 1
            : qq.correctIndex;
        return { ...qq, options: nextOptions, correctIndex: nextCorrect };
      }),
    }));
  }
  function updateQuizOptionText(qid: string, optIdx: number, text: string) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) =>
        qq.id === qid
          ? { ...qq, options: qq.options.map((o, i) => (i === optIdx ? text : o)) }
          : qq
      ),
    }));
  }
  function markQuizCorrect(qid: string, optIdx: number) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) => (qq.id === qid ? { ...qq, correctIndex: optIdx } : qq)),
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!trail) {
    return (
      <p className="text-muted-foreground">Trilha não encontrada</p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Editar Trilha</h1>
        </div>
        <Link to="/dashboard/cpc/trilhas">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="cpc-card p-6 lg:col-span-2">
          <form onSubmit={saveTrail} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Título</label>
              <Input value={trail.title} onChange={(e) => setTrail({ ...trail, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Descrição</label>
              <Textarea rows={4} value={trail.description || ''} onChange={(e) => setTrail({ ...trail, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Categoria</label>
                <select
                  value={trail.category}
                  onChange={(e) => setTrail({ ...trail, category: e.target.value })}
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
                  value={trail.difficulty || 'beginner'}
                  onChange={(e) => setTrail({ ...trail, difficulty: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="beginner">Iniciante</option>
                  <option value="intermediate">Intermédio</option>
                  <option value="advanced">Avançado</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {modules.length} módulos
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {totalDuration} min
              </span>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'A guardar...' : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar alterações
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="cpc-card p-6">
          <h2 className="font-semibold mb-4">Módulos</h2>
          <div className="space-y-2 mb-6">
            {modules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum módulo ainda.</p>
            ) : (
              modules.map((m, index) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        <ContentIcon type={m.content_type} />
                        {m.title}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {m.duration_minutes ? (<><Clock className="h-3 w-3" />{m.duration_minutes} min</>) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => reorderModule(index, 'up')} disabled={index === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => reorderModule(index, 'down')} disabled={index === modules.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteModule(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <h3 className="font-medium mb-2">Adicionar módulo</h3>
          <form onSubmit={addModule} className="space-y-3">
            <div>
              <label htmlFor="newmodule-title" className="text-sm font-medium mb-1 block">Título *</label>
              <Input
                id="newmodule-title"
                value={newModule.title}
                onChange={(e) => setNewModule({ ...newModule, title: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="newmodule-content-type" className="text-sm font-medium mb-1 block">Tipo de conteúdo</label>
                <select
                  id="newmodule-content-type"
                  value={newModule.content_type}
                  onChange={(e) => setNewModule({ ...newModule, content_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="video">Vídeo</option>
                  <option value="text">Texto</option>
                  <option value="pdf">PDF</option>
                  {/* TASK-03 — novo content_type 'quiz'. */}
                  <option value="quiz">{t.get('curriculum.quiz.editor.contentTypeOption')}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Duração (min)</label>
                <Input
                  type="number"
                  min={0}
                  value={newModule.duration_minutes}
                  onChange={(e) => setNewModule({ ...newModule, duration_minutes: Number(e.target.value) })}
                />
              </div>
            </div>
            {newModule.content_type === 'text' ? (
              <div>
                <label className="text-sm font-medium mb-1 block">Conteúdo (HTML/Markdown simples)</label>
                <Textarea rows={5} value={newModule.content_text} onChange={(e) => setNewModule({ ...newModule, content_text: e.target.value })} />
              </div>
            ) : newModule.content_type === 'quiz' ? (
              /* TASK-03 — editor de quiz: perguntas + opções + radio correto + score. */
              <div
                data-testid="quiz-editor-block"
                className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{t.get('curriculum.quiz.editor.heading')}</p>
                  <div className="flex items-center gap-2">
                    <label htmlFor="quiz-passing-score" className="text-xs text-muted-foreground">
                      {t.get('curriculum.quiz.editor.passingScore')}
                    </label>
                    <Input
                      id="quiz-passing-score"
                      type="number"
                      min={0}
                      max={100}
                      value={newQuiz.passing_score}
                      onChange={(e) =>
                        setNewQuiz((q) => ({ ...q, passing_score: Number(e.target.value) || 0 }))
                      }
                      className="w-20 h-9"
                    />
                  </div>
                </div>

                {newQuiz.questions.map((q, qIdx) => (
                  <div key={q.id} className="rounded-md border bg-background p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t.get('curriculum.quiz.editor.questionN', { n: qIdx + 1 })}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuizQuestion(q.id)}
                        disabled={newQuiz.questions.length <= 1}
                        aria-label={t.get('curriculum.quiz.editor.removeQuestion')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder={t.get('curriculum.quiz.editor.questionPlaceholder')}
                      value={q.question}
                      onChange={(e) => updateQuizQuestionText(q.id, e.target.value)}
                    />
                    <div role="radiogroup" aria-label={t.get('curriculum.quiz.editor.markCorrect')} className="space-y-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={q.correctIndex === optIdx}
                            onChange={() => markQuizCorrect(q.id, optIdx)}
                            aria-label={t.get('curriculum.quiz.editor.markCorrectOption', { n: optIdx + 1 })}
                          />
                          <Input
                            placeholder={t.get('curriculum.quiz.editor.optionPlaceholder', { n: optIdx + 1 })}
                            value={opt}
                            onChange={(e) => updateQuizOptionText(q.id, optIdx, e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuizOption(q.id, optIdx)}
                            disabled={q.options.length <= 2}
                            aria-label={t.get('curriculum.quiz.editor.removeOption')}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addQuizOption(q.id)}
                        disabled={q.options.length >= 6}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {t.get('curriculum.quiz.editor.addOption')}
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addQuizQuestion}
                  disabled={newQuiz.questions.length >= 5}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t.get('curriculum.quiz.editor.addQuestion')}
                </Button>

                {quizError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {t.get(quizError)}
                  </p>
                ) : null}
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-1 block">URL do conteúdo</label>
                <Input placeholder={newModule.content_type === 'video' ? 'https://youtu.be/...' : 'https://...pdf'} value={newModule.content_url} onChange={(e) => setNewModule({ ...newModule, content_url: e.target.value })} />
              </div>
            )}
            <Button type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar módulo
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
