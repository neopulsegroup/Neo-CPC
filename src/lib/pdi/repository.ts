import {
  getDocument,
  queryDocuments,
  updateDocument,
} from '@/integrations/firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/integrations/firebase/functionsClient';

import type { PdiAcceptanceDoc, PdiDoc, PdiVersionLogDoc } from './types';
import { migrantVisiblePdi, hasActiveEditablePdi } from './validation';

export const PDI_COLLECTION = 'pdi';
export const PDI_ACCEPTANCE_COLLECTION = 'pdi_acceptance';
export const PDI_VERSION_LOG_COLLECTION = 'pdi_version_log';

export async function fetchPdiById(pdiId: string): Promise<PdiDoc | null> {
  return getDocument<PdiDoc>(PDI_COLLECTION, pdiId);
}

export async function fetchParticipantPdiHistory(participantId: string): Promise<PdiDoc[]> {
  const docs = await queryDocuments<PdiDoc>(PDI_COLLECTION, [
    { field: 'participant_id', operator: '==', value: participantId },
  ]);
  return docs.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

/** PDIs visíveis ao migrante (query alinhada com firestore.rules). */
export async function fetchMigrantVisiblePdiDocs(participantId: string): Promise<PdiDoc[]> {
  const docs = await queryDocuments<PdiDoc>(PDI_COLLECTION, [
    { field: 'participant_id', operator: '==', value: participantId },
    { field: 'status', operator: 'in', value: ['VALIDATED', 'ACCEPTED'] },
  ]);
  return docs.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

/** PDI aceite (para SCAS T_TRILHA / T_PDI). */
export async function fetchMigrantAcceptedPdi(participantId: string): Promise<PdiDoc | null> {
  const docs = await queryDocuments<PdiDoc>(PDI_COLLECTION, [
    { field: 'participant_id', operator: '==', value: participantId },
    { field: 'status', operator: '==', value: 'ACCEPTED' },
  ]);
  return docs.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0] ?? null;
}

export async function fetchActivePdiForParticipant(participantId: string): Promise<PdiDoc | null> {
  const docs = await fetchParticipantPdiHistory(participantId);
  return hasActiveEditablePdi(docs) ?? migrantVisiblePdi(docs);
}

export async function fetchMigrantPdi(participantId: string): Promise<PdiDoc | null> {
  const docs = await fetchMigrantVisiblePdiDocs(participantId);
  return migrantVisiblePdi(docs);
}

export async function fetchPdiAcceptance(pdiId: string): Promise<PdiAcceptanceDoc | null> {
  const docs = await queryDocuments<PdiAcceptanceDoc>(PDI_ACCEPTANCE_COLLECTION, [
    { field: 'pdi_id', operator: '==', value: pdiId },
  ]);
  return docs[0] ?? null;
}

export async function fetchParticipantAcceptances(participantId: string): Promise<PdiAcceptanceDoc[]> {
  return queryDocuments<PdiAcceptanceDoc>(PDI_ACCEPTANCE_COLLECTION, [
    { field: 'participant_id', operator: '==', value: participantId },
  ]);
}

export async function updatePdiDraft(
  pdiId: string,
  patch: Partial<Pick<PdiDoc, 'trilhas' | 'apoios' | 'notes' | 'target_global' | 'target_d1' | 'target_d2' | 'target_d3' | 'target_d4' | 'status'>>
): Promise<void> {
  await updateDocument(PDI_COLLECTION, pdiId, {
    ...patch,
    ...(patch.status === 'IN_REVIEW' ? {} : {}),
  });
}

export async function markPdiSectionViewed(
  pdiId: string,
  section: string,
  current: string[] | undefined
): Promise<void> {
  const viewed = new Set(current ?? []);
  viewed.add(section);
  await updateDocument(PDI_COLLECTION, pdiId, {
    review_sections_viewed: Array.from(viewed),
  });
}

export interface GeneratePdiResult {
  ok: boolean;
  pdiId?: string;
  requestId?: string;
}

export async function generatePdiFromT0(participantId: string): Promise<GeneratePdiResult> {
  const call = httpsCallable<{ participantId: string }, GeneratePdiResult>(
    functions,
    'generatePdiFromT0'
  );
  const response = await call({ participantId });
  return response.data;
}

export interface ValidateSendPdiResult {
  ok: boolean;
  requestId?: string;
}

export async function validateAndSendPdi(pdiId: string): Promise<ValidateSendPdiResult> {
  const call = httpsCallable<{ pdiId: string }, ValidateSendPdiResult>(
    functions,
    'validateAndSendPdi'
  );
  const response = await call({ pdiId });
  return response.data;
}

export interface AcceptPdiResult {
  ok: boolean;
  acceptanceId?: string;
  requestId?: string;
}

export async function acceptPdi(pdiId: string, viewedSections: string[]): Promise<AcceptPdiResult> {
  const call = httpsCallable<{ pdiId: string; viewedSections: string[] }, AcceptPdiResult>(
    functions,
    'acceptPdi'
  );
  const response = await call({ pdiId, viewedSections });
  return response.data;
}

export interface RevisePdiResult {
  ok: boolean;
  newPdiId?: string;
  requestId?: string;
}

export async function revisePdi(pdiId: string, reason: string): Promise<RevisePdiResult> {
  const call = httpsCallable<{ pdiId: string; reason: string }, RevisePdiResult>(
    functions,
    'revisePdi'
  );
  const response = await call({ pdiId, reason });
  return response.data;
}

export async function fetchPdiVersionLogs(participantId: string): Promise<PdiVersionLogDoc[]> {
  const docs = await queryDocuments<PdiVersionLogDoc>(PDI_VERSION_LOG_COLLECTION, [
    { field: 'participant_id', operator: '==', value: participantId },
  ]);
  return docs.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

/** Trilhas do PDI ativo para o módulo SCAS (T_TRILHA / T_PDI). */
export function pdiTrailsForScas(pdi: PdiDoc | null): Array<{
  trail_id: string;
  scas_domain: import('@/lib/scas').ScasDomain | null;
  state: 'obrigatoria' | 'recomendada' | 'opcional';
}> {
  if (!pdi) return [];
  return pdi.trilhas
    .filter((t) => t.recommended_state !== 'NAO_INCLUIDA')
    .map((t) => ({
      trail_id: t.trail_id,
      scas_domain: t.scas_domain ?? null,
      state:
        t.recommended_state === 'OBRIGATORIA'
          ? 'obrigatoria'
          : t.recommended_state === 'RECOMENDADA'
            ? 'recomendada'
            : 'opcional',
    }));
}
