"use strict";
/**
 * TASK-08 + TASK-07 — Helpers partilhados pelos triggers de notificação.
 *
 * Cada Cloud Function:
 *   1. lê o doc do trigger,
 *   2. enriquece com profile/company/offer conforme necessário,
 *   3. verifica `email_notifications_enabled` no perfil destinatário (default true),
 *   4. resolve template e locale via renderTemplate(),
 *   5. envia via RESEND (sendEmail) — direto, sem fila intermédia.
 *
 * **Migração SMTP→RESEND (consolidate-resend):** antes escrevia em
 * `mail/{id}` para o `onMailCreated` consumir via SMTP. Agora chama
 * `sendEmail()` diretamente. Cada CF que usa enqueueEmail/enqueueAppNotification
 * deve declarar `{ secrets: [RESEND_API_KEY], ... }` na sua config Gen2.
 *
 * Falha de envio não bloqueia operação principal — apenas `logger.error`
 * estruturado. Sem retry custom (RESEND tem retry implícito internamente
 * para erros transitórios).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESEND_API_KEY = void 0;
exports.asEmailLocale = asEmailLocale;
exports.getProfileDoc = getProfileDoc;
exports.getUserDoc = getUserDoc;
exports.getCompanyDoc = getCompanyDoc;
exports.resolveRecipient = resolveRecipient;
exports.enqueueEmail = enqueueEmail;
exports.enqueueAppNotification = enqueueAppNotification;
exports.listCpcModerators = listCpcModerators;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const emailTemplates_1 = require("./emailTemplates");
const sendEmail_1 = require("./email/sendEmail");
Object.defineProperty(exports, "RESEND_API_KEY", { enumerable: true, get: function () { return sendEmail_1.RESEND_API_KEY; } });
/** Set de roles consideradas "admin / equipa CPC" para fins de moderação. */
const CPC_MODERATION_ROLES = new Set([
    'admin',
    'administrador',
    'manager',
    'coordinator',
    'cpc',
    'team',
    'staff',
    'equipa',
]);
/** Set de valores que indicam que o perfil **não quer** receber emails. */
function isEmailOptedOut(profileData) {
    if (!profileData)
        return false;
    return profileData.email_notifications_enabled === false;
}
/** Normaliza valor para EmailLocale com fallback PT. */
function asEmailLocale(value) {
    if (value === 'pt' || value === 'en' || value === 'es' || value === 'fr')
        return value;
    return 'pt';
}
/** Lê profiles/{uid} ou devolve null sem erro. */
async function getProfileDoc(uid) {
    try {
        const snap = await (0, admin_1.getFirestore)().doc(`profiles/${uid}`).get();
        return snap.exists ? (snap.data() ?? null) : null;
    }
    catch (err) {
        firebase_functions_1.logger.warn('notificationHelpers_getProfileDoc_failed', { uid, error: String(err) });
        return null;
    }
}
/** Lê users/{uid} ou devolve null sem erro. */
async function getUserDoc(uid) {
    try {
        const snap = await (0, admin_1.getFirestore)().doc(`users/${uid}`).get();
        return snap.exists ? (snap.data() ?? null) : null;
    }
    catch (err) {
        firebase_functions_1.logger.warn('notificationHelpers_getUserDoc_failed', { uid, error: String(err) });
        return null;
    }
}
/** Lê companies/{uid} ou devolve null sem erro. */
async function getCompanyDoc(uid) {
    try {
        const snap = await (0, admin_1.getFirestore)().doc(`companies/${uid}`).get();
        return snap.exists ? (snap.data() ?? null) : null;
    }
    catch (err) {
        firebase_functions_1.logger.warn('notificationHelpers_getCompanyDoc_failed', { uid, error: String(err) });
        return null;
    }
}
/**
 * Verifica se o destinatário pode receber email:
 *   - tem email válido em `profiles.email` ou `users.email`
 *   - `profiles.email_notifications_enabled !== false`
 * Devolve `{ to, locale }` se ok; null caso contrário.
 */
async function resolveRecipient(uid) {
    const profile = await getProfileDoc(uid);
    if (isEmailOptedOut(profile)) {
        firebase_functions_1.logger.info('notification_skipped_opted_out', { uid });
        return null;
    }
    const profileEmail = typeof profile?.email === 'string' && profile.email.trim() ? profile.email.trim() : null;
    const user = profileEmail ? null : await getUserDoc(uid);
    const userEmail = typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null;
    const to = profileEmail || userEmail;
    if (!to) {
        firebase_functions_1.logger.warn('notification_skipped_no_email', { uid });
        return null;
    }
    const locale = asEmailLocale(profile?.language ?? profile?.preferred_language);
    return { to, locale };
}
/**
 * Envia um email transacional via RESEND.
 *
 * Resolve o template + locale, chama `sendEmail()` direto (sem fila `mail/`).
 * Falhas são logadas com chave `notification_send_failed` e devolve null —
 * nunca lança. Histórico mantido em log estruturado (não em Firestore).
 *
 * Nome mantido (`enqueueEmail`) para minimizar diff nos 7 call sites; o
 * comportamento mudou — agora envia direto em vez de enfileirar.
 */
async function enqueueEmail(args) {
    try {
        const rendered = (0, emailTemplates_1.renderTemplate)(args.templateName, args.locale, args.vars);
        const result = await (0, sendEmail_1.sendEmail)({
            to: args.to,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            tag: args.tag,
        });
        firebase_functions_1.logger.info('notification_sent', {
            resendId: result.id,
            to: args.to,
            template: args.templateName,
            locale: args.locale,
            tag: args.tag,
            contextId: args.contextId ?? null,
        });
        return result.id;
    }
    catch (err) {
        firebase_functions_1.logger.error('notification_send_failed', {
            to: args.to,
            template: args.templateName,
            locale: args.locale,
            tag: args.tag,
            contextId: args.contextId ?? null,
            error: String(err),
        });
        return null;
    }
}
/**
 * TASK-07 — Enfileira uma notificação in-app em `notifications/{auto-id}`.
 * Schema confirmado (MigrantDashboard subscribeQuery + CPCMessagesPage write):
 *   { recipient_id, title, body, type, href?, created_by, created_at }
 *
 * Falhas só logam — não bloqueiam.
 */
async function enqueueAppNotification(args) {
    try {
        const ref = await (0, admin_1.getFirestore)().collection('notifications').add({
            recipient_id: args.recipientId,
            title: args.title,
            body: args.body,
            type: args.type,
            href: args.href ?? null,
            created_by: args.createdBy ?? 'system',
            created_at: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
        });
        firebase_functions_1.logger.info('app_notification_enqueued', {
            notificationId: ref.id,
            recipientId: args.recipientId,
            type: args.type,
            contextId: args.contextId ?? null,
        });
        return ref.id;
    }
    catch (err) {
        firebase_functions_1.logger.error('app_notification_enqueue_failed', {
            recipientId: args.recipientId,
            type: args.type,
            contextId: args.contextId ?? null,
            error: String(err),
        });
        return null;
    }
}
/**
 * Devolve emails (+locale) de todos os utilizadores com roles de moderação CPC
 * (admin/manager/coordinator/etc.). Usado por `onJobOfferCreated`.
 *
 * Implementação: scan da collection `users` (não há índice composto fácil para
 * `role IN (...)` sem custos extra). Para o universo da CPC (~dezenas de admins
 * no máximo) isto é aceitável.
 */
async function listCpcModerators() {
    const db = (0, admin_1.getFirestore)();
    const out = [];
    try {
        const snap = await db.collection('users').get();
        const targets = [];
        snap.forEach((doc) => {
            const data = doc.data();
            const role = typeof data?.role === 'string' ? data.role.toLowerCase() : null;
            if (role && CPC_MODERATION_ROLES.has(role)) {
                targets.push(doc.id);
            }
        });
        // Resolve cada destinatário via profile (para email + locale + opt-out).
        for (const uid of targets) {
            const resolved = await resolveRecipient(uid);
            if (resolved)
                out.push({ uid, ...resolved });
        }
    }
    catch (err) {
        firebase_functions_1.logger.error('listCpcModerators_failed', { error: String(err) });
    }
    return out;
}
