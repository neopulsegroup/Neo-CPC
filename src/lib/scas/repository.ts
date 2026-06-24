/**
 * SCAS — acesso a Firestore no cliente.
 *
 * A submissão NÃO é feita aqui: passa pela Cloud Function `submitScasAssessment`,
 * que calcula os scores, bloqueia a sessão e escreve o log de auditoria. O
 * cliente apenas cria sessões IN_PROGRESS e grava respostas parciais.
 *
 * PDI: ver `@/lib/pdi`.
 */

import { httpsCallable } from 'firebase/functions';

import {
  addDocument,
  queryDocuments,
  setDocument,
} from '@/integrations/firebase/firestore';
import { functions } from '@/integrations/firebase/functionsClient';
import {
  fetchMigrantAcceptedPdi,
  pdiTrailsForScas,
} from '@/lib/pdi/repository';

import {
  computeImprovement,
  type ScasDomain,
  type ScasImprovement,
  type ScasLanguage,
  type ScasMode,
  type ScasMomentType,
  type ScasTrailRecommendation,
} from './index';

export const SCAS_ASSESSMENTS_COLLECTION = 'scas_assessments';
export const SCAS_RESPONSES_COLLECTION = 'scas_responses';
export const SCAS_ITEMS_COLLECTION = 'scas_items';

/** @deprecated Use `@/lib/pdi` — legado para compatibilidade SCAS pending. */
export interface PdiTrailEntry {
  trail_id: string;
  scas_domain: ScasDomain | null;
  state: ScasTrailRecommendation;
}

/** @deprecated Use `@/lib/pdi` */
export interface PdiDoc {
  id: string;
  user_id: string;
  trails: PdiTrailEntry[];
  status: 'draft' | 'active';
  updated_at?: string;
  updated_by?: string;
}

export interface ScasAssessmentDoc {
  id: string;
  participant_id: string;
  moment_type: ScasMomentType;
  domain_scope: ScasDomain | null;
  trail_id: string | null;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  mode: ScasMode;
  assisted_by_user_id: string | null;
  language: ScasLanguage;
  started_at: string | null;
  submitted_at: string | null;
  is_locked: boolean;
  score_d1: number | null;
  score_d2: number | null;
  score_d3: number | null;
  score_d4: number | null;
  score_global: number | null;
  created_at?: string;
}

export interface ScasResponseDoc {
  id: string;
  assessment_id: string;
  item_id: number;
  value: number;
}

export function scasResponseDocId(assessmentId: string, itemId: number): string {
  return `${assessmentId}_${itemId}`;
}

export interface CreateAssessmentInput {
  participantId: string;
  momentType: ScasMomentType;
  domainScope: ScasDomain | null;
  trailId: string | null;
  language: ScasLanguage;
  mode: ScasMode;
  assistedByUserId: string | null;
}

/** Cria uma sessão IN_PROGRESS (cliente). Scores ficam null até à submissão. */
export async function createInProgressAssessment(
  input: CreateAssessmentInput
): Promise<string> {
  const nowIso = new Date().toISOString();
  return addDocument<Omit<ScasAssessmentDoc, 'id'>>(SCAS_ASSESSMENTS_COLLECTION, {
    participant_id: input.participantId,
    moment_type: input.momentType,
    domain_scope: input.domainScope,
    trail_id: input.trailId,
    status: 'IN_PROGRESS',
    mode: input.mode,
    assisted_by_user_id: input.assistedByUserId,
    language: input.language,
    started_at: nowIso,
    submitted_at: null,
    is_locked: false,
    score_d1: null,
    score_d2: null,
    score_d3: null,
    score_d4: null,
    score_global: null,
    created_at: nowIso,
  });
}

/** Procura uma sessão IN_PROGRESS já existente para retomar. */
export async function findResumableAssessment(
  input: Pick<CreateAssessmentInput, 'participantId' | 'momentType' | 'trailId'>
): Promise<ScasAssessmentDoc | null> {
  const docs = await queryDocuments<ScasAssessmentDoc>(SCAS_ASSESSMENTS_COLLECTION, [
    { field: 'participant_id', operator: '==', value: input.participantId },
    { field: 'moment_type', operator: '==', value: input.momentType },
    { field: 'status', operator: '==', value: 'IN_PROGRESS' },
  ]);
  const match = docs.find((d) => (d.trail_id ?? null) === (input.trailId ?? null));
  return match ?? null;
}

/** Grava (merge) respostas parciais. Permitido apenas enquanto IN_PROGRESS. */
export async function saveScasResponses(
  assessmentId: string,
  responses: Record<number, number>
): Promise<void> {
  const entries = Object.entries(responses);
  await Promise.all(
    entries.map(([itemId, value]) =>
      setDocument<Omit<ScasResponseDoc, 'id'>>(
        SCAS_RESPONSES_COLLECTION,
        scasResponseDocId(assessmentId, Number(itemId)),
        {
          assessment_id: assessmentId,
          item_id: Number(itemId),
          value,
        },
        true
      )
    )
  );
}

export async function fetchAssessmentResponses(
  assessmentId: string
): Promise<ScasResponseDoc[]> {
  return queryDocuments<ScasResponseDoc>(SCAS_RESPONSES_COLLECTION, [
    { field: 'assessment_id', operator: '==', value: assessmentId },
  ]);
}

export interface SubmitScasResult {
  ok: boolean;
  requestId?: string;
  scores?: {
    score_d1: number | null;
    score_d2: number | null;
    score_d3: number | null;
    score_d4: number | null;
    score_global: number | null;
  };
}

/** Submete a sessão via Cloud Function (cálculo + bloqueio + auditoria). */
export async function submitScasAssessment(assessmentId: string): Promise<SubmitScasResult> {
  const call = httpsCallable<{ assessmentId: string }, SubmitScasResult>(
    functions,
    'submitScasAssessment'
  );
  const response = await call({ assessmentId });
  return response.data;
}

/** Todas as sessões de um participante (ordenadas por criação asc., client-side). */
export async function fetchParticipantAssessments(
  participantId: string
): Promise<ScasAssessmentDoc[]> {
  const docs = await queryDocuments<ScasAssessmentDoc>(SCAS_ASSESSMENTS_COLLECTION, [
    { field: 'participant_id', operator: '==', value: participantId },
  ]);
  return docs.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
}

/**
 * PDI aceite adaptado ao formato legado usado pelo SCAS pending (T_TRILHA / T_PDI).
 */
export async function fetchPdi(uid: string): Promise<PdiDoc | null> {
  const accepted = await fetchMigrantAcceptedPdi(uid);
  if (!accepted) return null;
  return {
    id: accepted.id,
    user_id: accepted.participant_id,
    trails: pdiTrailsForScas(accepted),
    status: 'active',
  };
}

/** Resumo do percurso SCAS de um participante para a equipa CPC. */
export interface ScasParticipantSummary {
  t0: ScasAssessmentDoc | null;
  latestFinal: ScasAssessmentDoc | null;
  improvement: ScasImprovement | null;
  submitted: ScasAssessmentDoc[];
}

export function summarizeParticipantScas(
  assessments: ScasAssessmentDoc[]
): ScasParticipantSummary {
  const submitted = assessments.filter((a) => a.status === 'SUBMITTED');
  const t0 = submitted.find((a) => a.moment_type === 'T0') ?? null;
  const finals = submitted.filter(
    (a) => a.moment_type === 'T_PDI' || a.moment_type === 'T_ADICIONAL'
  );
  const latestFinal =
    finals.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '')).at(-1) ?? null;

  let improvement: ScasImprovement | null = null;
  if (t0?.score_global != null && latestFinal?.score_global != null) {
    improvement = computeImprovement(t0.score_global, latestFinal.score_global);
  }

  return { t0, latestFinal, improvement, submitted };
}
