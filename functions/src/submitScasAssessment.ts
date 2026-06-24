import { createHash, randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import admin from 'firebase-admin';

import { getFirestore } from './admin';
import {
  computeScores,
  isAssessmentComplete,
  isValidResponseValue,
  type ScasDomain,
  type ScasResponseMap,
} from './scasScoring';

const CPC_TEAM_ROLES = [
  'admin',
  'manager',
  'consultant',
  'coordinator',
  'mediator',
  'lawyer',
  'psychologist',
  'trainer',
];

type SubmitPayload = { assessmentId?: unknown };

function normalizeRole(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function loadActorRole(uid: string): Promise<string> {
  const db = getFirestore();
  const [userSnap, profileSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`profiles/${uid}`).get(),
  ]);
  const fromUser = normalizeRole(userSnap.exists ? userSnap.data()?.role : null);
  if (fromUser) return fromUser;
  return normalizeRole(profileSnap.exists ? profileSnap.data()?.role : null);
}

function isCpcRole(role: string): boolean {
  if (CPC_TEAM_ROLES.includes(role)) return true;
  // Aceita aliases PT comuns.
  return ['administrador', 'gestor', 'consultor', 'coordenador', 'mediador', 'jurista', 'psicologo', 'psicóloga', 'psicologa', 'formador', 'cpc', 'staff', 'equipa', 'team'].includes(
    role
  );
}

function payloadHash(responses: ScasResponseMap): string {
  const ordered = Object.keys(responses)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((id) => `${id}:${responses[id]}`)
    .join('|');
  return createHash('sha256').update(ordered).digest('hex');
}

export const submitScasAssessment = onCall(
  { region: 'us-central1' },
  async (request) => {
    const requestId = randomUUID();
    const uid = request.auth?.uid ?? null;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sessão inválida.', { error: 'UNAUTHENTICATED', requestId });
    }

    const payload = (request.data || {}) as SubmitPayload;
    const assessmentId = typeof payload.assessmentId === 'string' ? payload.assessmentId.trim() : '';
    if (!assessmentId) {
      throw new HttpsError('invalid-argument', 'Pedido inválido.', { error: 'VALIDATION_FAILED', requestId });
    }

    const db = getFirestore();
    const assessmentRef = db.doc(`scas_assessments/${assessmentId}`);
    const snap = await assessmentRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Avaliação não encontrada.', { error: 'NOT_FOUND', requestId });
    }
    const assessment = snap.data() as Record<string, unknown>;

    const participantId = String(assessment.participant_id || '');
    const momentType = String(assessment.moment_type || '');
    const domainScope = (assessment.domain_scope ?? null) as ScasDomain | null;
    const trailId = (assessment.trail_id ?? null) as string | null;
    const mode = String(assessment.mode || 'AUTONOMO');
    const language = String(assessment.language || 'pt');

    // Autorização: o próprio participante (autónomo) ou equipa CPC (assistido).
    const actorRole = await loadActorRole(uid);
    const isParticipant = uid === participantId;
    const isStaff = isCpcRole(actorRole);
    if (!isParticipant && !isStaff) {
      throw new HttpsError('permission-denied', 'Sem permissão.', { error: 'FORBIDDEN', requestId });
    }
    if (mode === 'ASSISTIDO' && !isStaff) {
      throw new HttpsError('permission-denied', 'Sem permissão.', { error: 'FORBIDDEN', requestId });
    }

    if (assessment.is_locked === true || assessment.status === 'SUBMITTED') {
      throw new HttpsError('failed-precondition', 'Avaliação já submetida.', {
        error: 'ALREADY_SUBMITTED',
        requestId,
      });
    }

    // Revalidação de elegibilidade: não permitir 2.ª submissão do mesmo momento
    // (T0 único; T_TRILHA único por trilha). Server é a fonte de verdade.
    const dupQuery = await db
      .collection('scas_assessments')
      .where('participant_id', '==', participantId)
      .where('moment_type', '==', momentType)
      .where('status', '==', 'SUBMITTED')
      .get();
    const duplicate = dupQuery.docs.some((d) => {
      if (momentType === 'T_TRILHA') {
        return (d.data().trail_id ?? null) === (trailId ?? null);
      }
      return momentType === 'T0' || momentType === 'T_PDI';
    });
    if (duplicate) {
      throw new HttpsError('failed-precondition', 'Momento já avaliado.', {
        error: 'NOT_ELIGIBLE',
        requestId,
      });
    }

    // Carrega respostas e valida completude/valores no servidor.
    const responsesSnap = await db
      .collection('scas_responses')
      .where('assessment_id', '==', assessmentId)
      .get();
    const responses: ScasResponseMap = {};
    for (const doc of responsesSnap.docs) {
      const data = doc.data();
      const itemId = Number(data.item_id);
      const value = Number(data.value);
      if (Number.isInteger(itemId) && isValidResponseValue(value)) {
        responses[itemId] = value;
      }
    }

    if (!isAssessmentComplete(responses, domainScope)) {
      throw new HttpsError('failed-precondition', 'Respostas incompletas.', {
        error: 'INCOMPLETE',
        requestId,
      });
    }

    const scores = computeScores(responses, domainScope);
    const hash = payloadHash(responses);
    const submittedAtIso = new Date().toISOString();

    // Transação: garante que só uma submissão vence (edge de concorrência).
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(assessmentRef);
      const freshData = fresh.data() as Record<string, unknown> | undefined;
      if (!freshData) {
        throw new HttpsError('not-found', 'Avaliação não encontrada.', { error: 'NOT_FOUND', requestId });
      }
      if (freshData.is_locked === true || freshData.status === 'SUBMITTED') {
        throw new HttpsError('failed-precondition', 'Avaliação já submetida.', {
          error: 'ALREADY_SUBMITTED',
          requestId,
        });
      }

      tx.update(assessmentRef, {
        status: 'SUBMITTED',
        is_locked: true,
        submitted_at: submittedAtIso,
        score_d1: scores.score_d1,
        score_d2: scores.score_d2,
        score_d3: scores.score_d3,
        score_d4: scores.score_d4,
        score_global: scores.score_global,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log de auditoria imutável (append-only por regras).
      const auditRef = db.collection('scas_audit_log').doc();
      tx.set(auditRef, {
        assessment_id: assessmentId,
        participant_id: participantId,
        event: 'SUBMITTED',
        actor_user_id: uid,
        actor_role: actorRole || null,
        moment_type: momentType,
        mode,
        language,
        payload_hash: hash,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        request_id: requestId,
      });
    });

    logger.info('scas_submitted', { requestId, assessmentId, momentType, participantId, mode });
    return { ok: true, requestId, scores };
  }
);
