import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import { getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import type { Language } from '@/lib/i18n';
import {
  itemsForScope,
  resolvePendingScasMoment,
  type PendingScasMoment,
  type ScasMode,
} from '@/lib/scas';
import {
  createInProgressAssessment,
  fetchAssessmentResponses,
  fetchParticipantAssessments,
  fetchPdi,
  findResumableAssessment,
  saveScasResponses,
  submitScasAssessment,
  summarizeParticipantScas,
} from '@/lib/scas/repository';

interface TrailProgressRow {
  trail_id: string;
  completed_at?: string | null;
}

interface TriageRow {
  completed?: boolean | null;
}

export interface UseScasFillArgs {
  participantId: string | null;
  mode: ScasMode;
  assistedByUserId: string | null;
}

export interface UseScasFillResult {
  loading: boolean;
  pending: PendingScasMoment | null;
  items: number[];
  responses: Record<number, number>;
  formLanguage: Language;
  setFormLanguage: (lang: Language) => void;
  answeredCount: number;
  allAnswered: boolean;
  savingItem: number | null;
  submitting: boolean;
  submitted: boolean;
  submitError: string | null;
  handleAnswer: (itemId: number, value: number) => Promise<void>;
  submit: () => Promise<boolean>;
}

/**
 * Lógica partilhada de preenchimento SCAS (migrante autónomo e equipa assistida).
 * O servidor revalida elegibilidade/scores na submissão; aqui é apenas a sessão.
 */
export function useScasFill(args: UseScasFillArgs): UseScasFillResult {
  const { participantId, mode, assistedByUserId } = args;
  const { language: uiLanguage } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingScasMoment | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [formLanguage, setFormLanguage] = useState<Language>(uiLanguage);
  const [savingItem, setSavingItem] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const items = useMemo(
    () => (pending ? itemsForScope(pending.domain_scope) : []),
    [pending]
  );
  const answeredCount = useMemo(
    () => items.filter((id) => typeof responses[id] === 'number').length,
    [items, responses]
  );
  const allAnswered = items.length > 0 && answeredCount === items.length;

  useEffect(() => {
    let cancelled = false;
    if (!participantId) return;

    void (async () => {
      setLoading(true);
      try {
        const [assessments, pdi, progress, triage] = await Promise.all([
          fetchParticipantAssessments(participantId),
          fetchPdi(participantId),
          queryDocuments<TrailProgressRow>('user_trail_progress', [
            { field: 'user_id', operator: '==', value: participantId },
          ]),
          getDocument<TriageRow>('triage', participantId),
        ]);
        if (cancelled) return;

        const summary = summarizeParticipantScas(assessments);
        const next = resolvePendingScasMoment({
          triageCompleted: triage?.completed === true,
          metaReached: summary.improvement?.meta_atingida ?? false,
          assessments: assessments.map((a) => ({
            moment_type: a.moment_type,
            domain_scope: a.domain_scope,
            trail_id: a.trail_id,
            status: a.status,
          })),
          pdiTrails: (pdi?.trails ?? []).map((tr) => ({
            trail_id: tr.trail_id,
            scas_domain: tr.scas_domain,
            state: tr.state,
          })),
          trailProgress: progress.map((p) => ({
            trail_id: p.trail_id,
            completed_at: p.completed_at ?? null,
          })),
        });
        setPending(next);

        if (next) {
          const resumable = await findResumableAssessment({
            participantId,
            momentType: next.moment_type,
            trailId: next.trail_id,
          });
          if (!cancelled && resumable) {
            setAssessmentId(resumable.id);
            setFormLanguage((resumable.language as Language) || uiLanguage);
            const existing = await fetchAssessmentResponses(resumable.id);
            if (!cancelled) {
              const map: Record<number, number> = {};
              for (const r of existing) map[r.item_id] = r.value;
              setResponses(map);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar SCAS', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [participantId, uiLanguage]);

  const ensureAssessment = useCallback(async (): Promise<string | null> => {
    if (assessmentId) return assessmentId;
    if (!participantId || !pending) return null;
    const id = await createInProgressAssessment({
      participantId,
      momentType: pending.moment_type,
      domainScope: pending.domain_scope,
      trailId: pending.trail_id,
      language: formLanguage,
      mode,
      assistedByUserId: mode === 'ASSISTIDO' ? assistedByUserId : null,
    });
    setAssessmentId(id);
    return id;
  }, [assessmentId, participantId, pending, formLanguage, mode, assistedByUserId]);

  const handleAnswer = useCallback(
    async (itemId: number, value: number) => {
      setResponses((prev) => ({ ...prev, [itemId]: value }));
      setSavingItem(itemId);
      try {
        const id = await ensureAssessment();
        if (id) await saveScasResponses(id, { [itemId]: value });
      } catch (error) {
        console.error('Erro ao guardar resposta SCAS', error);
      } finally {
        setSavingItem(null);
      }
    },
    [ensureAssessment]
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (!assessmentId) return false;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitScasAssessment(assessmentId);
      setSubmitted(true);
      return true;
    } catch (error) {
      const code = (error as { details?: { error?: string } })?.details?.error ?? 'GENERIC';
      setSubmitError(code);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [assessmentId]);

  return {
    loading,
    pending,
    items,
    responses,
    formLanguage,
    setFormLanguage,
    answeredCount,
    allAnswered,
    savingItem,
    submitting,
    submitted,
    submitError,
    handleAnswer,
    submit,
  };
}
