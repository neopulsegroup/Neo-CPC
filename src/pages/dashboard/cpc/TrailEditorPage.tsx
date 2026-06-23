import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { addDocument, deleteDocument, getDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { storage } from '@/integrations/firebase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppDateTime } from '@/hooks/useAppDateTime';
import {
  buildQuizQuestionFromDraft,
  makeEmptyQuizQuestionDraft,
  MAX_QUIZ_OPTIONS,
  quizQuestionDataToDraft,
  validateQuizQuestionDrafts,
  type QuizQuestionData,
  type QuizQuestionDraft,
} from '@/lib/quizOptions';
import { deleteTrailCoverFromStorage } from '@/lib/trailCoverStorage';
import {
  buildTrailModuleCoverPath,
  buildTrailModulePdfPath,
  deleteTrailModuleCoverFromStorage,
  deleteTrailModulePdfFromStorage,
} from '@/lib/trailModuleStorage';
import { queryTrailModules } from '@/lib/trailModules';
import {
  queryPendingTrailComments,
  TRAIL_MODULE_COMMENTS_COLLECTION,
  type TrailModuleComment,
} from '@/lib/moduleComments';
import { SimpleHtmlEditor } from '@/components/trails/SimpleHtmlEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getDownloadURL, ref as makeStorageRef, uploadBytes } from 'firebase/storage';
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
  Image as ImageIcon,
  Upload,
  Loader2,
  Pencil,
  X,
  MessageSquare,
  Check,
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
  image_url?: string | null;
  image_path?: string | null;
}

interface Module {
  id: string;
  title: string;
  content_type: string;
  content_text: string | null;
  content_url: string | null;
  content_path?: string | null;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  duration_minutes: number | null;
  order_index: number;
  trail_id: string;
  quiz_questions?: QuizQuestionData[] | null;
  quiz_passing_score?: number | null;
}

type ModuleFormState = {
  title: string;
  content_type: string;
  content_url: string;
  content_text: string;
  duration_minutes: number;
  cover_image_url: string;
  cover_image_path: string;
  content_path: string;
};

function makeEmptyModuleForm(): ModuleFormState {
  return {
    title: '',
    content_type: 'video',
    content_url: '',
    content_text: '',
    duration_minutes: 10,
    cover_image_url: '',
    cover_image_path: '',
    content_path: '',
  };
}

function moduleToForm(module: Module): ModuleFormState {
  return {
    title: module.title,
    content_type: module.content_type,
    content_url: module.content_url || '',
    content_text: module.content_text || '',
    duration_minutes: module.duration_minutes || 10,
    cover_image_url: module.cover_image_url || '',
    cover_image_path: module.cover_image_path || '',
    content_path: module.content_path || '',
  };
}

const DEFAULT_QUIZ_PASSING_SCORE = 70;
const COVER_ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const COVER_MAX_BYTES = 6 * 1024 * 1024;
const MODULE_PDF_MAX_BYTES = 10 * 1024 * 1024;

export default function TrailEditorPage() {
  const { trailId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatDateTime } = useAppDateTime();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const moduleCoverInputRef = useRef<HTMLInputElement>(null);
  const modulePdfInputRef = useRef<HTMLInputElement>(null);
  const [trail, setTrail] = useState<Trail | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState<ModuleFormState>(makeEmptyModuleForm);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [moduleAssetError, setModuleAssetError] = useState<string | null>(null);
  const [savingModule, setSavingModule] = useState(false);
  const [newQuiz, setNewQuiz] = useState<{ passing_score: number; questions: QuizQuestionDraft[] }>({
    passing_score: DEFAULT_QUIZ_PASSING_SCORE,
    questions: [makeEmptyQuizQuestionDraft()],
  });
  const [quizError, setQuizError] = useState<string | null>(null);
  const [pendingComments, setPendingComments] = useState<TrailModuleComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [moderatingCommentId, setModeratingCommentId] = useState<string | null>(null);

  useEffect(() => {
    if (trailId) fetchData();
  }, [trailId]);

  async function fetchData() {
    if (!trailId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setTrail(null);
    setModules([]);
    setPendingComments([]);

    try {
      const trailDoc = await getDocument<Trail>('trails', trailId);
      if (trailDoc) setTrail(trailDoc);
    } catch (e) {
      console.error('Erro ao carregar trilha', e);
    }

    try {
      const sorted = await queryTrailModules<Module>(trailId);
      setModules(sorted);
    } catch (e) {
      console.error('Erro ao carregar módulos', e);
      setModules([]);
    }

    try {
      setLoadingComments(true);
      const comments = await queryPendingTrailComments(trailId);
      setPendingComments(comments);
    } catch (e) {
      console.error('Erro ao carregar comentários pendentes', e);
      setPendingComments([]);
    } finally {
      setLoadingComments(false);
      setLoading(false);
    }
  }

  const moduleTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const module of modules) map.set(module.id, module.title);
    return map;
  }, [modules]);

  async function refreshPendingComments() {
    if (!trailId) return;
    setLoadingComments(true);
    try {
      const comments = await queryPendingTrailComments(trailId);
      setPendingComments(comments);
    } catch (e) {
      console.error('Erro ao carregar comentários pendentes', e);
      setPendingComments([]);
    } finally {
      setLoadingComments(false);
    }
  }

  async function moderateComment(commentId: string, status: 'approved' | 'rejected') {
    if (!user?.uid) return;
    setModeratingCommentId(commentId);
    try {
      await updateDocument(TRAIL_MODULE_COMMENTS_COLLECTION, commentId, {
        status,
        moderated_at: new Date().toISOString(),
        moderated_by: user.uid,
      });
      setPendingComments((prev) => prev.filter((comment) => comment.id !== commentId));
    } catch (e) {
      console.error('Erro ao moderar comentário', e);
    } finally {
      setModeratingCommentId(null);
    }
  }

  const totalDuration = useMemo(
    () => modules.reduce((sum, m) => sum + (m.duration_minutes || 0), 0),
    [modules]
  );

  async function handleCoverPick(file: File | null) {
    setCoverError(null);
    if (!file || !user?.uid || !trail) return;

    if (!COVER_ALLOWED_MIME.has(file.type)) {
      setCoverError('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }
    if (file.size > COVER_MAX_BYTES) {
      setCoverError('A imagem deve ter no máximo 6 MB.');
      return;
    }

    setUploadingCover(true);
    const previousPath = trail.image_path;
    const previousUrl = trail.image_url;
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `profile_photos/${user.uid}/trail_covers/${trail.id}_${Date.now()}_${safeName}`;
      const storageRef = makeStorageRef(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);

      await deleteTrailCoverFromStorage(previousPath, previousUrl);

      setTrail({ ...trail, image_url: url, image_path: path });
      await updateDocument('trails', trail.id, {
        image_url: url,
        image_path: path,
      });
    } catch (e) {
      console.error('Erro ao enviar imagem de capa', e);
      setCoverError('Não foi possível enviar a imagem de capa.');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  }

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
        image_url: trail.image_url ?? null,
        image_path: trail.image_path ?? null,
        modules_count: modules.length,
        duration_minutes: totalDuration,
      });
    } catch (e) {
      console.error('Erro ao guardar trilha', e);
    } finally {
      setSaving(false);
    }
  }

  function resetModuleForm() {
    setModuleForm(makeEmptyModuleForm());
    setEditingModuleId(null);
    setPendingCoverFile(null);
    setPendingPdfFile(null);
    setModuleAssetError(null);
    setQuizError(null);
    setNewQuiz({ passing_score: DEFAULT_QUIZ_PASSING_SCORE, questions: [makeEmptyQuizQuestionDraft()] });
    if (moduleCoverInputRef.current) moduleCoverInputRef.current.value = '';
    if (modulePdfInputRef.current) modulePdfInputRef.current.value = '';
  }

  function startEditModule(module: Module) {
    setEditingModuleId(module.id);
    setModuleForm(moduleToForm(module));
    setPendingCoverFile(null);
    setPendingPdfFile(null);
    setModuleAssetError(null);
    setQuizError(null);
    if (module.content_type === 'quiz' && Array.isArray(module.quiz_questions) && module.quiz_questions.length > 0) {
      setNewQuiz({
        passing_score: module.quiz_passing_score ?? DEFAULT_QUIZ_PASSING_SCORE,
        questions: module.quiz_questions.map(quizQuestionDataToDraft),
      });
    } else {
      setNewQuiz({ passing_score: DEFAULT_QUIZ_PASSING_SCORE, questions: [makeEmptyQuizQuestionDraft()] });
    }
  }

  async function uploadModuleCoverFile(file: File, moduleId: string): Promise<{ url: string; path: string }> {
    if (!user?.uid || !trailId) throw new Error('missing-user');
    const path = buildTrailModuleCoverPath(user.uid, trailId, moduleId, file.name);
    const storageRef = makeStorageRef(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return { url, path };
  }

  async function uploadModulePdfFile(file: File, moduleId: string): Promise<{ url: string; path: string }> {
    if (!user?.uid || !trailId) throw new Error('missing-user');
    const path = buildTrailModulePdfPath(user.uid, trailId, moduleId, file.name);
    const storageRef = makeStorageRef(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type || 'application/pdf' });
    const url = await getDownloadURL(storageRef);
    return { url, path };
  }

  function handleModuleCoverPick(file: File | null) {
    setModuleAssetError(null);
    if (!file) return;
    if (!COVER_ALLOWED_MIME.has(file.type)) {
      setModuleAssetError('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }
    if (file.size > COVER_MAX_BYTES) {
      setModuleAssetError('A imagem de capa deve ter no máximo 6 MB.');
      return;
    }
    setPendingCoverFile(file);
    setModuleForm((prev) => ({ ...prev, cover_image_url: URL.createObjectURL(file) }));
  }

  function handleModulePdfPick(file: File | null) {
    setModuleAssetError(null);
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setModuleAssetError('Envie um ficheiro PDF.');
      return;
    }
    if (file.size > MODULE_PDF_MAX_BYTES) {
      setModuleAssetError('O PDF deve ter no máximo 10 MB.');
      return;
    }
    setPendingPdfFile(file);
  }

  async function removeModuleCoverAsset() {
    setModuleAssetError(null);
    if (pendingCoverFile) {
      if (moduleForm.cover_image_url.startsWith('blob:')) URL.revokeObjectURL(moduleForm.cover_image_url);
      setPendingCoverFile(null);
      setModuleForm((prev) => ({ ...prev, cover_image_url: '', cover_image_path: '' }));
      if (moduleCoverInputRef.current) moduleCoverInputRef.current.value = '';
      return;
    }
    if (moduleForm.cover_image_path || moduleForm.cover_image_url) {
      await deleteTrailModuleCoverFromStorage(moduleForm.cover_image_path, moduleForm.cover_image_url);
    }
    setModuleForm((prev) => ({ ...prev, cover_image_url: '', cover_image_path: '' }));
    if (moduleCoverInputRef.current) moduleCoverInputRef.current.value = '';
  }

  async function saveModule(e: FormEvent) {
    e.preventDefault();
    if (!trailId || !moduleForm.title) return;
    setQuizError(null);
    setModuleAssetError(null);

    const isQuiz = moduleForm.content_type === 'quiz';
    const isText = moduleForm.content_type === 'text';
    const isPdf = moduleForm.content_type === 'pdf';

    if (isPdf && !pendingPdfFile && !moduleForm.content_url) {
      setModuleAssetError('Selecione um ficheiro PDF.');
      return;
    }

    let quizPayload: { quiz_questions: QuizQuestionData[]; quiz_passing_score: number } | null = null;
    if (isQuiz) {
      const errKey = validateQuizQuestionDrafts(newQuiz);
      if (errKey) {
        setQuizError(errKey);
        return;
      }
      quizPayload = {
        quiz_questions: newQuiz.questions.map(buildQuizQuestionFromDraft),
        quiz_passing_score: newQuiz.passing_score,
      };
    }

    setSavingModule(true);
    try {
      const basePayload = {
        title: moduleForm.title,
        content_type: moduleForm.content_type,
        content_url: !isText && !isQuiz ? (moduleForm.content_url || null) : isPdf ? (moduleForm.content_url || null) : null,
        content_text: isText ? (moduleForm.content_text || null) : null,
        content_path: isPdf ? (moduleForm.content_path || null) : null,
        cover_image_url: isText ? (moduleForm.cover_image_url || null) : null,
        cover_image_path: isText ? (moduleForm.cover_image_path || null) : null,
        duration_minutes: moduleForm.duration_minutes || null,
        ...(quizPayload ?? {}),
      };

      if (editingModuleId) {
        const existing = modules.find((m) => m.id === editingModuleId);
        if (!existing) return;

        let nextCoverUrl = isText ? moduleForm.cover_image_url || null : null;
        let nextCoverPath = isText ? moduleForm.cover_image_path || null : null;
        let nextContentUrl = !isText && !isQuiz ? moduleForm.content_url || null : isPdf ? moduleForm.content_url || null : null;
        let nextContentPath = isPdf ? moduleForm.content_path || null : null;

        if (isText && pendingCoverFile) {
          await deleteTrailModuleCoverFromStorage(existing.cover_image_path, existing.cover_image_url);
          const uploaded = await uploadModuleCoverFile(pendingCoverFile, editingModuleId);
          nextCoverUrl = uploaded.url;
          nextCoverPath = uploaded.path;
        } else if (isText && !nextCoverUrl && (existing.cover_image_path || existing.cover_image_url)) {
          await deleteTrailModuleCoverFromStorage(existing.cover_image_path, existing.cover_image_url);
          nextCoverPath = null;
        } else if (!isText && (existing.cover_image_path || existing.cover_image_url)) {
          await deleteTrailModuleCoverFromStorage(existing.cover_image_path, existing.cover_image_url);
        }

        if (isPdf && pendingPdfFile) {
          await deleteTrailModulePdfFromStorage(existing.content_path, existing.content_url);
          const uploaded = await uploadModulePdfFile(pendingPdfFile, editingModuleId);
          nextContentUrl = uploaded.url;
          nextContentPath = uploaded.path;
        } else if (!isPdf && (existing.content_path || (existing.content_type === 'pdf' && existing.content_url))) {
          await deleteTrailModulePdfFromStorage(existing.content_path, existing.content_url);
          nextContentPath = null;
        }

        const updatePayload = {
          ...basePayload,
          content_url: nextContentUrl,
          content_path: nextContentPath,
          cover_image_url: nextCoverUrl,
          cover_image_path: nextCoverPath,
        };

        await updateDocument('trail_modules', editingModuleId, updatePayload);
        setModules((prev) =>
          prev.map((m) =>
            m.id === editingModuleId
              ? {
                  ...m,
                  ...updatePayload,
                  quiz_questions: quizPayload?.quiz_questions ?? (isQuiz ? m.quiz_questions : null),
                  quiz_passing_score: quizPayload?.quiz_passing_score ?? (isQuiz ? m.quiz_passing_score : null),
                }
              : m
          )
        );
        resetModuleForm();
        return;
      }

      const order_index = modules.length + 1;
      const id = await addDocument('trail_modules', {
        trail_id: trailId,
        ...basePayload,
        order_index,
        created_at: new Date().toISOString(),
      });

      let nextCoverUrl = isText ? moduleForm.cover_image_url || null : null;
      let nextCoverPath = isText ? moduleForm.cover_image_path || null : null;
      let nextContentUrl = !isText && !isQuiz ? moduleForm.content_url || null : null;
      let nextContentPath: string | null = null;

      if (isText && pendingCoverFile) {
        const uploaded = await uploadModuleCoverFile(pendingCoverFile, id);
        nextCoverUrl = uploaded.url;
        nextCoverPath = uploaded.path;
      }

      if (isPdf && pendingPdfFile) {
        const uploaded = await uploadModulePdfFile(pendingPdfFile, id);
        nextContentUrl = uploaded.url;
        nextContentPath = uploaded.path;
      }

      const assetPatch: Partial<Module> = {};
      if (nextCoverUrl !== moduleForm.cover_image_url || nextCoverPath !== moduleForm.cover_image_path) {
        assetPatch.cover_image_url = nextCoverUrl;
        assetPatch.cover_image_path = nextCoverPath;
      }
      if (nextContentUrl !== moduleForm.content_url || nextContentPath) {
        assetPatch.content_url = nextContentUrl;
        assetPatch.content_path = nextContentPath;
      }
      if (Object.keys(assetPatch).length > 0) {
        await updateDocument('trail_modules', id, assetPatch);
      }

      setModules([
        ...modules,
        {
          id,
          trail_id: trailId,
          title: moduleForm.title,
          content_type: moduleForm.content_type,
          content_url: nextContentUrl,
          content_text: isText ? (moduleForm.content_text || null) : null,
          content_path: nextContentPath,
          cover_image_url: nextCoverUrl,
          cover_image_path: nextCoverPath,
          duration_minutes: moduleForm.duration_minutes || null,
          order_index,
          quiz_questions: quizPayload?.quiz_questions ?? null,
          quiz_passing_score: quizPayload?.quiz_passing_score ?? null,
        },
      ]);
      resetModuleForm();
    } catch (err) {
      console.error('Erro ao guardar módulo', err);
      setModuleAssetError('Não foi possível guardar o módulo. Tente novamente.');
    } finally {
      setSavingModule(false);
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
    const target = modules.find((m) => m.id === moduleId);
    if (editingModuleId === moduleId) resetModuleForm();
    try {
      if (target) {
        await deleteTrailModuleCoverFromStorage(target.cover_image_path, target.cover_image_url);
        if (target.content_type === 'pdf') {
          await deleteTrailModulePdfFromStorage(target.content_path, target.content_url);
        }
      }
      await deleteDocument('trail_modules', moduleId);
      const remaining = modules.filter((m) => m.id !== moduleId).map((m, i) => ({ ...m, order_index: i + 1 }));
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

  function addQuizQuestion() {
    if (newQuiz.questions.length >= 5) return;
    setNewQuiz((q) => ({ ...q, questions: [...q.questions, makeEmptyQuizQuestionDraft()] }));
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

  function updateQuizCorrectAnswer(qid: string, text: string) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) => (qq.id === qid ? { ...qq, correctAnswer: text } : qq)),
    }));
  }

  function updateQuizIncorrectAnswer(qid: string, index: number, text: string) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) =>
        qq.id === qid
          ? {
              ...qq,
              incorrectAnswers: qq.incorrectAnswers.map((answer, i) => (i === index ? text : answer)),
            }
          : qq
      ),
    }));
  }

  function addQuizIncorrectAnswer(qid: string) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) => {
        if (qq.id !== qid) return qq;
        const filledCount = 1 + qq.incorrectAnswers.filter((answer) => answer.trim()).length;
        if (filledCount >= MAX_QUIZ_OPTIONS) return qq;
        return { ...qq, incorrectAnswers: [...qq.incorrectAnswers, ''] };
      }),
    }));
  }

  function removeQuizIncorrectAnswer(qid: string, index: number) {
    setNewQuiz((q) => ({
      ...q,
      questions: q.questions.map((qq) => {
        if (qq.id !== qid || qq.incorrectAnswers.length <= 1) return qq;
        return { ...qq, incorrectAnswers: qq.incorrectAnswers.filter((_, i) => i !== index) };
      }),
    }));
  }

  function renderQuizErrorMessage(errorKey: string) {
    if (errorKey === 'curriculum.quiz.editor.validation.maxOptions') {
      return t.get(errorKey, { max: MAX_QUIZ_OPTIONS });
    }
    return t.get(errorKey);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!trail) {
    return <p className="text-muted-foreground">Trilha não encontrada</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="cpc-card p-6 w-full min-w-0">
          <h2 className="font-semibold text-lg mb-4">Configurações da trilha</h2>
          <form onSubmit={saveTrail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trail-cover-edit">{t.get('curriculum.quiz.editor.coverImage')}</Label>
            <div className="overflow-hidden rounded-xl border bg-muted/20">
              {trail.image_url ? (
                <img src={trail.image_url} alt="" className="h-48 w-full object-cover" />
              ) : (
                <div className="flex h-48 w-full items-center justify-center text-muted-foreground">
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
                disabled={uploadingCover || saving}
              >
                {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {trail.image_url
                  ? t.get('curriculum.quiz.editor.changeCoverImage')
                  : t.get('curriculum.quiz.editor.selectCoverImage')}
              </Button>
              <span className="text-xs text-muted-foreground">JPG, PNG ou WebP (máx. 6 MB)</span>
            </div>
            {coverError ? <p className="text-sm text-red-600">{coverError}</p> : null}
            <input
              ref={coverInputRef}
              id="trail-cover-edit"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => void handleCoverPick(e.currentTarget.files?.[0] ?? null)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Título</label>
            <Input value={trail.title} onChange={(e) => setTrail({ ...trail, title: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Descrição</label>
            <Textarea
              rows={4}
              value={trail.description || ''}
              onChange={(e) => setTrail({ ...trail, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <option value="finance">Finanças</option>
                <option value="housing">Habitação</option>
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
          <Button type="submit" disabled={saving || uploadingCover}>
            {saving ? 'A guardar...' : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar alterações
              </>
            )}
          </Button>
        </form>
        </div>

        <div className="cpc-card p-6 w-full min-w-0">
          <h2 className="font-semibold text-lg mb-4">Módulos</h2>
        <div className="space-y-2 mb-8">
          {modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum módulo ainda.</p>
          ) : (
            modules.map((m, index) => (
              <div
                key={m.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${editingModuleId === m.id ? 'border-primary bg-primary/5' : ''}`}
              >
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
                      {m.duration_minutes ? (
                        <>
                          <Clock className="h-3 w-3" />
                          {m.duration_minutes} min
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => reorderModule(index, 'up')} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reorderModule(index, 'down')}
                    disabled={index === modules.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => startEditModule(m)} aria-label="Editar módulo">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteModule(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-medium">{editingModuleId ? 'Editar módulo' : 'Adicionar módulo'}</h3>
          {editingModuleId ? (
            <Button type="button" variant="ghost" size="sm" onClick={resetModuleForm}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          ) : null}
        </div>
        <form onSubmit={saveModule} className="space-y-3">
          <div>
            <label htmlFor="newmodule-title" className="text-sm font-medium mb-1 block">
              Título *
            </label>
            <Input
              id="newmodule-title"
              value={moduleForm.title}
              onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="newmodule-content-type" className="text-sm font-medium mb-1 block">
                Tipo de conteúdo
              </label>
              <select
                id="newmodule-content-type"
                value={moduleForm.content_type}
                onChange={(e) => {
                  const content_type = e.target.value;
                  setModuleForm({
                    ...makeEmptyModuleForm(),
                    title: moduleForm.title,
                    content_type,
                    duration_minutes: moduleForm.duration_minutes,
                  });
                  setPendingCoverFile(null);
                  setPendingPdfFile(null);
                  setModuleAssetError(null);
                  if (moduleCoverInputRef.current) moduleCoverInputRef.current.value = '';
                  if (modulePdfInputRef.current) modulePdfInputRef.current.value = '';
                }}
                className="w-full px-4 py-2 rounded-lg border border-input bg-background"
              >
                <option value="video">Vídeo</option>
                <option value="text">Texto</option>
                <option value="pdf">PDF</option>
                <option value="quiz">{t.get('curriculum.quiz.editor.contentTypeOption')}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Duração (min)</label>
              <Input
                type="number"
                min={0}
                value={moduleForm.duration_minutes}
                onChange={(e) => setModuleForm({ ...moduleForm, duration_minutes: Number(e.target.value) })}
              />
            </div>
          </div>
          {moduleForm.content_type === 'text' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.get('curriculum.quiz.editor.coverImage')} (opcional)</Label>
                <div className="overflow-hidden rounded-xl border bg-muted/20">
                  {moduleForm.cover_image_url ? (
                    <img src={moduleForm.cover_image_url} alt="" className="h-40 w-full object-cover" />
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
                    onClick={() => moduleCoverInputRef.current?.click()}
                    disabled={savingModule}
                  >
                    <Upload className="h-4 w-4" />
                    {moduleForm.cover_image_url
                      ? t.get('curriculum.quiz.editor.changeCoverImage')
                      : t.get('curriculum.quiz.editor.selectCoverImage')}
                  </Button>
                  {moduleForm.cover_image_url ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => void removeModuleCoverAsset()} disabled={savingModule}>
                      Remover capa
                    </Button>
                  ) : null}
                  <span className="text-xs text-muted-foreground">JPG, PNG ou WebP (máx. 6 MB)</span>
                </div>
                <input
                  ref={moduleCoverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => handleModuleCoverPick(e.currentTarget.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Conteúdo (HTML/Markdown simples)</label>
                <SimpleHtmlEditor
                  id="module-content-editor"
                  value={moduleForm.content_text}
                  onChange={(content_text) => setModuleForm((prev) => ({ ...prev, content_text }))}
                />
              </div>
            </div>
          ) : moduleForm.content_type === 'quiz' ? (
            <div
              data-testid="quiz-editor-block"
              className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
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
                    onChange={(e) => setNewQuiz((q) => ({ ...q, passing_score: Number(e.target.value) || 0 }))}
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
                  <div className="space-y-2">
                    <Label htmlFor={`correct-${q.id}`}>{t.get('curriculum.quiz.editor.correctAnswer')}</Label>
                    <Input
                      id={`correct-${q.id}`}
                      placeholder={t.get('curriculum.quiz.editor.correctAnswerPlaceholder')}
                      value={q.correctAnswer}
                      onChange={(e) => updateQuizCorrectAnswer(q.id, e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.get('curriculum.quiz.editor.incorrectAnswers')}</Label>
                    {q.incorrectAnswers.map((answer, answerIdx) => (
                      <div key={answerIdx} className="flex items-center gap-2">
                        <Input
                          placeholder={t.get('curriculum.quiz.editor.incorrectAnswerPlaceholder', { n: answerIdx + 1 })}
                          value={answer}
                          onChange={(e) => updateQuizIncorrectAnswer(q.id, answerIdx, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuizIncorrectAnswer(q.id, answerIdx)}
                          disabled={q.incorrectAnswers.length <= 1}
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
                      onClick={() => addQuizIncorrectAnswer(q.id)}
                      disabled={1 + q.incorrectAnswers.filter((answer) => answer.trim()).length >= MAX_QUIZ_OPTIONS}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t.get('curriculum.quiz.editor.addIncorrectAnswer')}
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
                  {renderQuizErrorMessage(quizError)}
                </p>
              ) : null}
            </div>
          ) : moduleForm.content_type === 'pdf' ? (
            <div className="space-y-2">
              <Label htmlFor="module-pdf-upload">Ficheiro PDF *</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => modulePdfInputRef.current?.click()}
                  disabled={savingModule}
                >
                  <Upload className="h-4 w-4" />
                  {pendingPdfFile || moduleForm.content_url ? 'Substituir PDF' : 'Selecionar PDF'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {pendingPdfFile?.name ||
                    (moduleForm.content_url ? 'PDF carregado' : 'Nenhum ficheiro selecionado')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">PDF até 10 MB</p>
              <input
                ref={modulePdfInputRef}
                id="module-pdf-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleModulePdfPick(e.currentTarget.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium mb-1 block">URL do conteúdo</label>
              <Input
                placeholder={moduleForm.content_type === 'video' ? 'https://youtu.be/...' : 'https://...'}
                value={moduleForm.content_url}
                onChange={(e) => setModuleForm({ ...moduleForm, content_url: e.target.value })}
              />
            </div>
          )}
          {moduleAssetError ? <p className="text-sm text-destructive">{moduleAssetError}</p> : null}
          <Button type="submit" disabled={savingModule}>
            {savingModule ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                {editingModuleId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingModuleId ? 'Guardar módulo' : 'Adicionar módulo'}
              </>
            )}
          </Button>
        </form>
        </div>
      </div>

      <div className="cpc-card p-6 w-full">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Moderação de comentários
            {pendingComments.length > 0 ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {pendingComments.length}
              </span>
            ) : null}
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshPendingComments()} disabled={loadingComments}>
            {loadingComments ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
          </Button>
        </div>

        {loadingComments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : pendingComments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Não há comentários pendentes de moderação nesta trilha.</p>
        ) : (
          <div className="space-y-3">
            {pendingComments.map((comment) => (
              <div key={comment.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{comment.user_name}</span>
                  <span>•</span>
                  <span>{moduleTitleById.get(comment.module_id) || 'Módulo desconhecido'}</span>
                  <span>•</span>
                  <span>{formatDateTime(comment.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void moderateComment(comment.id, 'approved')}
                    disabled={moderatingCommentId === comment.id}
                  >
                    {moderatingCommentId === comment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void moderateComment(comment.id, 'rejected')}
                    disabled={moderatingCommentId === comment.id}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
