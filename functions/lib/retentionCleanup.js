"use strict";
/**
 * T-10 (LGPD/RGPD) — Cron mensal de retenção de dados.
 *
 * Política (ver `Privacy.tsx` secção 8): conta inativa há mais de 24 meses
 * (730 dias) é eliminada permanentemente, com aviso por e-mail enviado
 * 30 dias antes.
 *
 * Estratégia:
 *  1. Identifica contas com `last_login` há > 700 dias (730-30) que ainda
 *     não receberam aviso → envia retentionWarning + grava
 *     `retention_warning_sent_at`.
 *  2. Identifica contas com `last_login` há > 730 dias que já receberam
 *     aviso há > 30 dias → cascade-delete (Firestore + Auth) + audit.
 *  3. Se um utilizador reactivou (last_login recente) mas tinha flag de
 *     aviso, limpa a flag — `loginUser` já o faz no client, isto é
 *     defensivo.
 *
 * Cloud Scheduler quota Spark: 3 jobs grátis. Este é o 2º (junto com
 * `scheduledReminders`), por isso fica dentro da quota.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.retentionCleanup = void 0;
exports.lastLoginToMillis = lastLoginToMillis;
exports.formatDeletionDate = formatDeletionDate;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const notificationHelpers_1 = require("./notificationHelpers");
const sendEmail_1 = require("./email/sendEmail");
const emailTemplates_1 = require("./emailTemplates");
const deleteOwnAccount_1 = require("./deleteOwnAccount");
const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 730;
const WARNING_DAYS_BEFORE = 30;
const WARNING_THRESHOLD_DAYS = RETENTION_DAYS - WARNING_DAYS_BEFORE; // 700
/** Lê um valor de last_login num formato seguro (Timestamp do admin ou ISO string). */
function lastLoginToMillis(value) {
    if (!value)
        return null;
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const t = Date.parse(value);
        return Number.isFinite(t) ? t : null;
    }
    if (typeof value === 'object') {
        const v = value;
        if (typeof v.toMillis === 'function') {
            try {
                return v.toMillis();
            }
            catch {
                return null;
            }
        }
        if (typeof v.toDate === 'function') {
            try {
                return v.toDate().getTime();
            }
            catch {
                return null;
            }
        }
    }
    return null;
}
function formatDeletionDate(ms) {
    // Formato dd/mm/yyyy — neutro em PT/ES/FR/EN.
    const d = new Date(ms);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
}
async function sendRetentionWarning(args) {
    const rendered = (0, emailTemplates_1.renderTemplate)('retentionWarning', args.locale, {
        userName: args.userName,
        deletionDate: args.deletionDate,
    });
    await (0, sendEmail_1.sendEmail)({
        to: args.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tag: 'retention-warning',
    });
}
exports.retentionCleanup = (0, scheduler_1.onSchedule)({
    // Dia 1 de cada mês às 03:00 (Europe/Lisbon).
    schedule: '0 3 1 * *',
    timeZone: 'Europe/Lisbon',
    secrets: [notificationHelpers_1.RESEND_API_KEY],
}, async () => {
    const db = (0, admin_1.getFirestore)();
    const now = Date.now();
    const warningCutoff = now - WARNING_THRESHOLD_DAYS * DAY_MS;
    const deleteCutoff = now - RETENTION_DAYS * DAY_MS;
    const snap = await db.collection('users').get();
    let warned = 0;
    let deleted = 0;
    let reactivated = 0;
    let skipped = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        const uid = doc.id;
        const lastLoginMs = lastLoginToMillis(data.last_login);
        // Sem last_login → não há sinal claro de uso; o seguro é assumir
        // que ainda não inicializou (registo recente) — saltar.
        if (lastLoginMs === null) {
            skipped += 1;
            continue;
        }
        const warningSentMs = lastLoginToMillis(data.retention_warning_sent_at);
        try {
            // Caso 1 — passou de 730 dias E já avisado há > 30 dias → eliminar.
            if (lastLoginMs < deleteCutoff && warningSentMs !== null) {
                if (now - warningSentMs >= WARNING_DAYS_BEFORE * DAY_MS) {
                    const role = typeof data.role === 'string' ? data.role : 'migrant';
                    const report = await (0, deleteOwnAccount_1.cascadeDeleteUserDataServer)(db, uid, {
                        includeCompanyDoc: role === 'company',
                    });
                    await db
                        .collection('audit_logs')
                        .doc(`retention_${uid}_${now}`)
                        .set({
                        action: 'retention_auto_delete',
                        actor_id: 'system_cron',
                        target_id: uid,
                        last_login_ms: lastLoginMs,
                        cascade_report: report,
                        createdAt: new Date().toISOString(),
                    });
                    try {
                        await (0, admin_1.getAdminApp)().auth().deleteUser(uid);
                    }
                    catch (authErr) {
                        firebase_functions_1.logger.warn('retention_auth_delete_failed', { uid, error: String(authErr) });
                    }
                    deleted += 1;
                }
                continue;
            }
            // Caso 2 — passou de 700 dias, ainda não avisado → enviar warning.
            if (lastLoginMs < warningCutoff && warningSentMs === null) {
                const email = typeof data.email === 'string' ? data.email : null;
                const userName = typeof data.name === 'string' && data.name.trim() ? data.name : 'utilizador';
                const locale = (0, notificationHelpers_1.asEmailLocale)(data.language ?? data.preferred_language);
                const deletionDate = formatDeletionDate(lastLoginMs + RETENTION_DAYS * DAY_MS);
                if (email) {
                    try {
                        await sendRetentionWarning({ email, userName, locale, deletionDate });
                    }
                    catch (sendErr) {
                        firebase_functions_1.logger.warn('retention_warning_send_failed', { uid, error: String(sendErr) });
                    }
                }
                await doc.ref.set({ retention_warning_sent_at: new Date().toISOString() }, { merge: true });
                warned += 1;
                continue;
            }
            // Caso 3 — reativou (last_login recente) mas tinha aviso → limpar.
            if (lastLoginMs >= warningCutoff && warningSentMs !== null) {
                await doc.ref.set({ retention_warning_sent_at: null }, { merge: true });
                reactivated += 1;
                continue;
            }
            skipped += 1;
        }
        catch (err) {
            firebase_functions_1.logger.error('retention_user_processing_failed', {
                uid,
                error: String(err),
            });
        }
    }
    firebase_functions_1.logger.info('retention_cleanup_summary', {
        scanned: snap.size,
        warned,
        deleted,
        reactivated,
        skipped,
    });
});
