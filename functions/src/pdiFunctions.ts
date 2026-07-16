import { randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import admin from 'firebase-admin';

import { getFirestore } from './admin';
import { enqueueAppNotification } from './notificationHelpers';
import {
  allReviewSectionsViewed,
  bumpVersion,
  computeTargetForDomain,
  computeTargetGlobal,
  generateApoiosFromTriage,
  generateAutoTrilhas,
  validatePdiForSend,
  type PdiApoioEntry,
  type PdiTrilhaEntry,
  type ScasDomain,
} from './pdiLogic';

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

type PdiStatus = 'DRAFT_GENERATED' | 'IN_REVIEW' | 'VALIDATED' | 'ACCEPTED' | 'SUPERSEDED';

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
  return [
    'administrador',
    'gestor',
    'consultor',
    'coordenador',
    'mediador',
    'jurista',
    'psicologo',
    'psicóloga',
    'psicologa',
    'formador',
    'cpc',
    'staff',
    'equipa',
    'team',
  ].includes(role);
}

async function findSubmittedT0(db: admin.firestore.Firestore, participantId: string) {
  const snap = await db
    .collection('scas_assessments')
    .where('participant_id', '==', participantId)
    .where('moment_type', '==', 'T0')
    .where('status', '==', 'SUBMITTED')
    .limit(1)
    .get();
  return snap.docs[0] ?? null;
}

async function findActivePdi(db: admin.firestore.Firestore, participantId: string) {
  const snap = await db
    .collection('pdi')
    .where('participant_id', '==', participantId)
    .get();
  const active = snap.docs.filter((d) => {
    const status = d.data().status as PdiStatus;
    return status === 'DRAFT_GENERATED' || status === 'IN_REVIEW' || status === 'VALIDATED';
  });
  return active[0] ?? null;
}

async function loadTrailCatalog(db: admin.firestore.Firestore) {
  const snap = await db.collection('trails').get();
  return snap.docs.map((d) => ({
    id: d.id,
    scas_domain: d.data().scas_domain as ScasDomain | null | undefined,
    is_active: d.data().is_active as boolean | undefined,
  }));
}

export const generatePdiFromT0 = onCall({ region: 'us-central1' }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid ?? null;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sessão inválida.', { error: 'UNAUTHENTICATED', requestId });
  }

  const role = await loadActorRole(uid);
  if (!isCpcRole(role)) {
    throw new HttpsError('permission-denied', 'Sem permissão.', { error: 'FORBIDDEN', requestId });
  }

  const participantId =
    typeof request.data?.participantId === 'string' ? request.data.participantId.trim() : '';
  if (!participantId) {
    throw new HttpsError('invalid-argument', 'Pedido inválido.', { error: 'VALIDATION_FAILED', requestId });
  }

  const db = getFirestore();
  const existing = await findActivePdi(db, participantId);
  if (existing) {
    throw new HttpsError(
      'failed-precondition',
      'Já existe um PDI ativo para este participante.',
      { error: 'PDI_ALREADY_ACTIVE', requestId, pdiId: existing.id }
    );
  }

  const t0Doc = await findSubmittedT0(db, participantId);
  if (!t0Doc) {
    throw new HttpsError(
      'failed-precondition',
      'SCAS T0 não encontrado.',
      { error: 'T0_NOT_FOUND', requestId }
    );
  }

  const t0 = t0Doc.data();
  const trails = await loadTrailCatalog(db);
  const activeTrails = trails.filter((t) => t.is_active !== false);
  const trilhas = generateAutoTrilhas(
    {
      score_d1: t0.score_d1 ?? null,
      score_d2: t0.score_d2 ?? null,
      score_d3: t0.score_d3 ?? null,
      score_d4: t0.score_d4 ?? null,
    },
    activeTrails
  );

  const triageSnap = await db.doc(`triage/${participantId}`).get();
  const triageData = triageSnap.exists ? triageSnap.data() : null;
  const apoios = generateApoiosFromTriage(
  (triageData?.urgencies as string[] | null | undefined) ??
    (triageData?.identified_needs as string[] | null | undefined)
  );

  const classSnap = await db.doc(`migrant_classifications/${participantId}`).get();
  const perfilRaw = classSnap.exists ? classSnap.data()?.eligibility_profile : null;
  const perfil = perfilRaw === 'A' || perfilRaw === 'B' ? perfilRaw : null;

  const scoreGlobal = t0.score_global ?? null;
  const nowIso = new Date().toISOString();
  const pdiRef = db.collection('pdi').doc();
  const payload = {
    participant_id: participantId,
    version: '1.0',
    status: 'DRAFT_GENERATED' as PdiStatus,
    perfil,
    source_t0_assessment_id: t0Doc.id,
    score_d1: t0.score_d1 ?? null,
    score_d2: t0.score_d2 ?? null,
    score_d3: t0.score_d3 ?? null,
    score_d4: t0.score_d4 ?? null,
    score_global: scoreGlobal,
    target_global: scoreGlobal != null ? computeTargetGlobal(scoreGlobal) : null,
    target_d1: computeTargetForDomain(t0.score_d1 ?? null),
    target_d2: computeTargetForDomain(t0.score_d2 ?? null),
    target_d3: computeTargetForDomain(t0.score_d3 ?? null),
    target_d4: computeTargetForDomain(t0.score_d4 ?? null),
    notes: null,
    review_sections_viewed: [],
    created_by_user_id: uid,
    validated_by_user_id: null,
    created_at: nowIso,
    validated_at: null,
    sent_at: null,
    accepted_at: null,
    supersedes_pdi_id: null,
    is_locked: false,
    trilhas,
    apoios,
    pdf_url: null,
  };

  await pdiRef.set(payload);

  logger.info('pdi_generated_from_t0', { requestId, pdiId: pdiRef.id, participantId, actor: uid });
  return { ok: true, pdiId: pdiRef.id, requestId };
});

export const validateAndSendPdi = onCall({ region: 'us-central1' }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid ?? null;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sessão inválida.', { error: 'UNAUTHENTICATED', requestId });
  }

  const role = await loadActorRole(uid);
  if (!isCpcRole(role)) {
    throw new HttpsError('permission-denied', 'Sem permissão.', { error: 'FORBIDDEN', requestId });
  }

  const pdiId = typeof request.data?.pdiId === 'string' ? request.data.pdiId.trim() : '';
  if (!pdiId) {
    throw new HttpsError('invalid-argument', 'Pedido inválido.', { error: 'VALIDATION_FAILED', requestId });
  }

  const db = getFirestore();
  const pdiRef = db.doc(`pdi/${pdiId}`);
  const snap = await pdiRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'PDI não encontrado.', { error: 'NOT_FOUND', requestId });
  }

  const data = snap.data()!;
  const status = data.status as PdiStatus;
  if (status !== 'DRAFT_GENERATED' && status !== 'IN_REVIEW') {
    throw new HttpsError(
      'failed-precondition',
      'Estado do PDI não permite validação.',
      { error: 'INVALID_STATUS', requestId }
    );
  }

  const validation = validatePdiForSend({
    participant_id: data.participant_id,
    source_t0_assessment_id: data.source_t0_assessment_id,
    score_global: data.score_global,
    target_global: data.target_global,
    trilhas: data.trilhas as PdiTrilhaEntry[],
  });
  if (!validation.ok) {
    throw new HttpsError('failed-precondition', 'Conteúdo do PDI incompleto.', {
      error: 'PDI_INCOMPLETE',
      requestId,
      fields: validation.errors,
    });
  }

  const nowIso = new Date().toISOString();
  await pdiRef.update({
    status: 'VALIDATED',
    validated_by_user_id: uid,
    validated_at: nowIso,
    sent_at: nowIso,
    review_sections_viewed: [],
  });

  const participantId = data.participant_id as string;
  await enqueueAppNotification({
    recipientId: participantId,
    type: 'PDI_DISPONIVEL',
    title: 'O seu Plano de Desenvolvimento Individual está disponível',
    body: 'Consulte o seu plano personalizado e aceite após rever todo o conteúdo.',
    href: '/dashboard/migrante/pdi',
    createdBy: uid,
    contextId: pdiId,
    documentId: `pdi_notify_${pdiId}`,
  });

  logger.info('pdi_validated_sent', { requestId, pdiId, participantId, actor: uid });
  return { ok: true, requestId };
});

export const acceptPdi = onCall({ region: 'us-central1' }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid ?? null;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sessão inválida.', { error: 'UNAUTHENTICATED', requestId });
  }

  const pdiId = typeof request.data?.pdiId === 'string' ? request.data.pdiId.trim() : '';
  const viewedSections = Array.isArray(request.data?.viewedSections)
    ? request.data.viewedSections.filter((s: unknown) => typeof s === 'string')
    : [];

  if (!pdiId) {
    throw new HttpsError('invalid-argument', 'Pedido inválido.', { error: 'VALIDATION_FAILED', requestId });
  }

  const db = getFirestore();
  const pdiRef = db.doc(`pdi/${pdiId}`);
  const snap = await pdiRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'PDI não encontrado.', { error: 'NOT_FOUND', requestId });
  }

  const data = snap.data()!;
  const participantId = data.participant_id as string;
  if (uid !== participantId) {
    throw new HttpsError('permission-denied', 'Sem permissão.', { error: 'FORBIDDEN', requestId });
  }

  const classSnap = await db.doc(`migrant_classifications/${participantId}`).get();
  const eligibility = classSnap.exists ? classSnap.data()?.eligibility_profile : null;
  if (eligibility !== 'A') {
    throw new HttpsError('permission-denied', 'PDI disponível apenas para Perfil A.', {
      error: 'PROFILE_A_REQUIRED',
      requestId,
    });
  }

  if (data.status !== 'VALIDATED') {
    throw new HttpsError(
      'failed-precondition',
      'O PDI não está disponível para aceite.',
      { error: 'INVALID_STATUS', requestId }
    );
  }

  if (!allReviewSectionsViewed(viewedSections)) {
    throw new HttpsError(
      'failed-precondition',
      'É necessário percorrer todo o conteúdo antes de aceitar.',
      { error: 'SECTIONS_NOT_VIEWED', requestId }
    );
  }

  const existingAccept = await db
    .collection('pdi_acceptance')
    .where('pdi_id', '==', pdiId)
    .limit(1)
    .get();
  if (!existingAccept.empty) {
    throw new HttpsError('failed-precondition', 'PDI já aceite.', { error: 'ALREADY_ACCEPTED', requestId });
  }

  const nowIso = new Date().toISOString();
  const acceptanceRef = db.collection('pdi_acceptance').doc();
  const raw = request.rawRequest;
  await acceptanceRef.set({
    pdi_id: pdiId,
    pdi_version: data.version,
    participant_id: participantId,
    accepted_at: nowIso,
    ip: raw?.ip ?? null,
    user_agent: raw?.headers?.['user-agent'] ?? null,
    pdf_snapshot_ref: null,
  });

  await pdiRef.update({
    status: 'ACCEPTED',
    accepted_at: nowIso,
    is_locked: true,
    review_sections_viewed: viewedSections,
  });

  // Notificar equipa CPC (recipient genérico via notificação ao técnico validador se existir)
  const validatorId = data.validated_by_user_id as string | null;
  if (validatorId) {
    await enqueueAppNotification({
      recipientId: validatorId,
      type: 'PDI_ACEITE',
      title: 'PDI aceite pelo participante',
      body: `O participante aceitou o PDI versão ${data.version}.`,
      href: `/dashboard/cpc/migrantes/${participantId}/perfil`,
      createdBy: uid,
      contextId: pdiId,
      documentId: `pdi_accept_notify_${pdiId}`,
    });
  }

  logger.info('pdi_accepted', { requestId, pdiId, participantId });
  return { ok: true, acceptanceId: acceptanceRef.id, requestId };
});

export const revisePdi = onCall({ region: 'us-central1' }, async (request) => {
  const requestId = randomUUID();
  const uid = request.auth?.uid ?? null;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sessão inválida.', { error: 'UNAUTHENTICATED', requestId });
  }

  const role = await loadActorRole(uid);
  if (!isCpcRole(role)) {
    throw new HttpsError('permission-denied', 'Sem permissão.', { error: 'FORBIDDEN', requestId });
  }

  const pdiId = typeof request.data?.pdiId === 'string' ? request.data.pdiId.trim() : '';
  const reason = typeof request.data?.reason === 'string' ? request.data.reason.trim() : '';
  if (!pdiId || reason.length < 3) {
    throw new HttpsError('invalid-argument', 'Pedido inválido.', { error: 'VALIDATION_FAILED', requestId });
  }

  const db = getFirestore();
  const pdiRef = db.doc(`pdi/${pdiId}`);
  const snap = await pdiRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'PDI não encontrado.', { error: 'NOT_FOUND', requestId });
  }

  const data = snap.data()!;
  const status = data.status as PdiStatus;
  if (status !== 'VALIDATED' && status !== 'ACCEPTED') {
    throw new HttpsError(
      'failed-precondition',
      'Estado do PDI não permite revisão.',
      { error: 'INVALID_STATUS', requestId }
    );
  }

  const participantId = data.participant_id as string;
  const existingActive = await findActivePdi(db, participantId);
  if (existingActive && existingActive.id !== pdiId) {
    throw new HttpsError(
      'failed-precondition',
      'Já existe outro PDI ativo.',
      { error: 'PDI_ALREADY_ACTIVE', requestId }
    );
  }

  const nowIso = new Date().toISOString();
  await pdiRef.update({ status: 'SUPERSEDED', is_locked: true });

  const newVersion = bumpVersion(String(data.version ?? '1.0'));
  const newRef = db.collection('pdi').doc();
  const copyPayload = {
    participant_id: participantId,
    version: newVersion,
    status: 'IN_REVIEW' as PdiStatus,
    perfil: data.perfil ?? null,
    source_t0_assessment_id: data.source_t0_assessment_id,
    score_d1: data.score_d1 ?? null,
    score_d2: data.score_d2 ?? null,
    score_d3: data.score_d3 ?? null,
    score_d4: data.score_d4 ?? null,
    score_global: data.score_global ?? null,
    target_global: data.target_global ?? null,
    target_d1: data.target_d1 ?? null,
    target_d2: data.target_d2 ?? null,
    target_d3: data.target_d3 ?? null,
    target_d4: data.target_d4 ?? null,
    notes: data.notes ?? null,
    review_sections_viewed: [],
    created_by_user_id: uid,
    validated_by_user_id: null,
    created_at: nowIso,
    validated_at: null,
    sent_at: null,
    accepted_at: null,
    supersedes_pdi_id: pdiId,
    is_locked: false,
    trilhas: (data.trilhas as PdiTrilhaEntry[]) ?? [],
    apoios: (data.apoios as PdiApoioEntry[]) ?? [],
    pdf_url: null,
  };
  await newRef.set(copyPayload);

  await db.collection('pdi_version_log').doc().set({
    participant_id: participantId,
    pdi_id: newRef.id,
    version: newVersion,
    reason,
    technician_user_id: uid,
    created_at: nowIso,
    superseded_pdi_id: pdiId,
  });

  await enqueueAppNotification({
    recipientId: participantId,
    type: 'PDI_REVISTO',
    title: 'O seu Plano foi revisto',
    body: 'A equipa CPC atualizou o seu Plano de Desenvolvimento Individual. Consulte a nova versão.',
    href: '/dashboard/migrante/pdi',
    createdBy: uid,
    contextId: newRef.id,
    documentId: `pdi_revise_notify_${newRef.id}`,
  });

  logger.info('pdi_revised', { requestId, oldPdiId: pdiId, newPdiId: newRef.id, participantId, actor: uid });
  return { ok: true, newPdiId: newRef.id, requestId };
});
