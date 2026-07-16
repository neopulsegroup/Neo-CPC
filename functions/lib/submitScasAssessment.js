"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitScasAssessment = void 0;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const admin_1 = require("./admin");
const scasScoring_1 = require("./scasScoring");
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
function normalizeRole(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
async function loadActorRole(uid) {
    const db = (0, admin_1.getFirestore)();
    const [userSnap, profileSnap] = await Promise.all([
        db.doc(`users/${uid}`).get(),
        db.doc(`profiles/${uid}`).get(),
    ]);
    const fromUser = normalizeRole(userSnap.exists ? userSnap.data()?.role : null);
    if (fromUser)
        return fromUser;
    return normalizeRole(profileSnap.exists ? profileSnap.data()?.role : null);
}
function isCpcRole(role) {
    if (CPC_TEAM_ROLES.includes(role))
        return true;
    // Aceita aliases PT comuns.
    return ['administrador', 'gestor', 'consultor', 'coordenador', 'mediador', 'jurista', 'psicologo', 'psicóloga', 'psicologa', 'formador', 'cpc', 'staff', 'equipa', 'team'].includes(role);
}
function payloadHash(responses) {
    const ordered = Object.keys(responses)
        .map((k) => Number(k))
        .sort((a, b) => a - b)
        .map((id) => `${id}:${responses[id]}`)
        .join('|');
    return (0, node_crypto_1.createHash)('sha256').update(ordered).digest('hex');
}
exports.submitScasAssessment = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    const requestId = (0, node_crypto_1.randomUUID)();
    const uid = request.auth?.uid ?? null;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sessão inválida.', { error: 'UNAUTHENTICATED', requestId });
    }
    const payload = (request.data || {});
    const assessmentId = typeof payload.assessmentId === 'string' ? payload.assessmentId.trim() : '';
    if (!assessmentId) {
        throw new https_1.HttpsError('invalid-argument', 'Pedido inválido.', { error: 'VALIDATION_FAILED', requestId });
    }
    const db = (0, admin_1.getFirestore)();
    const assessmentRef = db.doc(`scas_assessments/${assessmentId}`);
    const snap = await assessmentRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Avaliação não encontrada.', { error: 'NOT_FOUND', requestId });
    }
    const assessment = snap.data();
    const participantId = String(assessment.participant_id || '');
    const momentType = String(assessment.moment_type || '');
    const domainScope = (assessment.domain_scope ?? null);
    const trailId = (assessment.trail_id ?? null);
    const mode = String(assessment.mode || 'AUTONOMO');
    const language = String(assessment.language || 'pt');
    // Autorização: o próprio participante (autónomo) ou equipa CPC (assistido).
    const actorRole = await loadActorRole(uid);
    const isParticipant = uid === participantId;
    const isStaff = isCpcRole(actorRole);
    if (!isParticipant && !isStaff) {
        throw new https_1.HttpsError('permission-denied', 'Sem permissão.', { error: 'FORBIDDEN', requestId });
    }
    if (mode === 'ASSISTIDO' && !isStaff) {
        throw new https_1.HttpsError('permission-denied', 'Sem permissão.', { error: 'FORBIDDEN', requestId });
    }
    // Migrante autónomo: SCAS só para Perfil A.
    if (isParticipant && !isStaff) {
        const classSnap = await db.doc(`migrant_classifications/${participantId}`).get();
        const eligibility = classSnap.exists ? classSnap.data()?.eligibility_profile : null;
        if (eligibility !== 'A') {
            throw new https_1.HttpsError('permission-denied', 'SCAS disponível apenas para Perfil A.', {
                error: 'PROFILE_A_REQUIRED',
                requestId,
            });
        }
    }
    if (assessment.is_locked === true || assessment.status === 'SUBMITTED') {
        throw new https_1.HttpsError('failed-precondition', 'Avaliação já submetida.', {
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
        throw new https_1.HttpsError('failed-precondition', 'Momento já avaliado.', {
            error: 'NOT_ELIGIBLE',
            requestId,
        });
    }
    // Carrega respostas e valida completude/valores no servidor.
    const responsesSnap = await db
        .collection('scas_responses')
        .where('assessment_id', '==', assessmentId)
        .get();
    const responses = {};
    for (const doc of responsesSnap.docs) {
        const data = doc.data();
        const itemId = Number(data.item_id);
        const value = Number(data.value);
        if (Number.isInteger(itemId) && (0, scasScoring_1.isValidResponseValue)(value)) {
            responses[itemId] = value;
        }
    }
    if (!(0, scasScoring_1.isAssessmentComplete)(responses, domainScope)) {
        throw new https_1.HttpsError('failed-precondition', 'Respostas incompletas.', {
            error: 'INCOMPLETE',
            requestId,
        });
    }
    const scores = (0, scasScoring_1.computeScores)(responses, domainScope);
    const hash = payloadHash(responses);
    const submittedAtIso = new Date().toISOString();
    // Transação: garante que só uma submissão vence (edge de concorrência).
    await db.runTransaction(async (tx) => {
        const fresh = await tx.get(assessmentRef);
        const freshData = fresh.data();
        if (!freshData) {
            throw new https_1.HttpsError('not-found', 'Avaliação não encontrada.', { error: 'NOT_FOUND', requestId });
        }
        if (freshData.is_locked === true || freshData.status === 'SUBMITTED') {
            throw new https_1.HttpsError('failed-precondition', 'Avaliação já submetida.', {
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
            updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
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
            timestamp: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
            request_id: requestId,
        });
    });
    firebase_functions_1.logger.info('scas_submitted', { requestId, assessmentId, momentType, participantId, mode });
    return { ok: true, requestId, scores };
});
