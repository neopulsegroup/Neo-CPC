"use strict";
/**
 * TASK-07 — Cron de lembretes de sessão.
 *
 * Corre a cada 15 minutos via Cloud Scheduler. Procura sessões com
 * `reminder_24h_pending: true` ou `reminder_1h_pending: true` cuja data
 * (`scheduled_date` + `scheduled_time`, interpretadas em Europe/Lisbon)
 * caia na janela respectiva:
 *
 *   - 24h: [now+23h, now+25h]   (largura 2h)
 *   - 1h:  [now+45min, now+75min] (largura 30min)
 *
 * Para cada sessão na janela:
 *   1. Envia email + notif in-app a migrante e profissional.
 *   2. Marca o flag como `false` (idempotente — não envia 2x).
 *
 * Documentar deploy: Cloud Scheduler tem 3 jobs grátis no plano Spark; este
 * é o único cron novo, por isso fica dentro da quota.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledReminders = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const notificationHelpers_1 = require("./notificationHelpers");
const sessionDateHelpers_1 = require("./sessionDateHelpers");
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
/** Determina se um instante `targetMs` cai dentro de uma janela [nowMs+min, nowMs+max]. */
function inWindow(targetMs, nowMs, minOffset, maxOffset) {
    const diff = targetMs - nowMs;
    return diff >= minOffset && diff <= maxOffset;
}
async function sendSessionReminder(args) {
    const { sessionId, session, templateName, notificationType } = args;
    const sessionType = (typeof session.service_label === 'string' && session.service_label.trim()) ||
        (typeof session.session_type === 'string' && session.session_type.trim()) ||
        'Sessão';
    // Resolve destinatários.
    const targets = [];
    if (typeof session.migrant_id === 'string' && session.migrant_id) {
        targets.push({ uid: session.migrant_id, role: 'migrant' });
    }
    const staffUid = (typeof session.specialist_id === 'string' && session.specialist_id) ||
        (typeof session.professional_id === 'string' && session.professional_id) ||
        null;
    if (staffUid)
        targets.push({ uid: staffUid, role: 'staff' });
    for (const target of targets) {
        const recipient = await (0, notificationHelpers_1.resolveRecipient)(target.uid);
        if (!recipient)
            continue;
        const sessionDateTime = (0, sessionDateHelpers_1.formatSessionDateForEmail)(session.scheduled_date, session.scheduled_time, recipient.locale);
        let userName = target.role === 'migrant' ? 'Migrante' : 'Profissional';
        try {
            const snap = await (0, admin_1.getFirestore)().doc(`profiles/${target.uid}`).get();
            const data = snap.exists ? snap.data() : null;
            if (data && typeof data.name === 'string' && data.name.trim()) {
                userName = data.name.trim();
            }
        }
        catch {
            // best effort
        }
        await (0, notificationHelpers_1.enqueueEmail)({
            to: recipient.to,
            templateName,
            locale: recipient.locale,
            vars: { userName, sessionType, sessionDateTime },
            tag: templateName === 'sessionReminder24h' ? 'session-reminder-24h' : 'session-reminder-1h',
            contextId: sessionId,
        });
        await (0, notificationHelpers_1.enqueueAppNotification)({
            recipientId: target.uid,
            type: notificationType,
            title: templateName === 'sessionReminder24h'
                ? `Lembrete: ${sessionType} amanhã`
                : `${sessionType} daqui a 1h`,
            body: `Agendada para ${sessionDateTime}.`,
            href: target.role === 'migrant' ? '/dashboard/migrante/sessoes' : '/dashboard/cpc/agenda',
            createdBy: 'system_cron',
            contextId: sessionId,
        });
    }
}
exports.scheduledReminders = (0, scheduler_1.onSchedule)({
    schedule: 'every 15 minutes',
    timeZone: 'Europe/Lisbon',
}, async () => {
    const db = (0, admin_1.getFirestore)();
    const nowMs = Date.now();
    /* -------- 24h reminder (janela [now+23h, now+25h]) -------- */
    try {
        const snap24 = await db
            .collection('sessions')
            .where('reminder_24h_pending', '==', true)
            .get();
        let processed24 = 0;
        let skippedOutOfWindow24 = 0;
        for (const doc of snap24.docs) {
            const session = doc.data();
            const targetMs = (0, sessionDateHelpers_1.sessionLisbonTimestampMs)(session.scheduled_date, session.scheduled_time);
            if (targetMs === null) {
                // Sessão sem data válida — limpa flag para não tentar mais.
                await doc.ref.update({ reminder_24h_pending: false });
                continue;
            }
            if (!inWindow(targetMs, nowMs, 23 * HOUR_MS, 25 * HOUR_MS)) {
                skippedOutOfWindow24 += 1;
                // Se já passou da janela (sessão no passado), limpa flag para idempotência.
                if (targetMs < nowMs) {
                    await doc.ref.update({ reminder_24h_pending: false });
                }
                continue;
            }
            await sendSessionReminder({
                sessionId: doc.id,
                session,
                templateName: 'sessionReminder24h',
                notificationType: 'session_reminder_24h',
            });
            await doc.ref.update({
                reminder_24h_pending: false,
                reminder_24h_sent_at: new Date().toISOString(),
            });
            processed24 += 1;
        }
        firebase_functions_1.logger.info('scheduledReminders_24h_summary', {
            scanned: snap24.size,
            processed: processed24,
            skippedOutOfWindow: skippedOutOfWindow24,
        });
    }
    catch (err) {
        firebase_functions_1.logger.error('scheduledReminders_24h_failed', { error: String(err) });
    }
    /* -------- 1h reminder (janela [now+45min, now+75min]) -------- */
    try {
        const snap1 = await db
            .collection('sessions')
            .where('reminder_1h_pending', '==', true)
            .get();
        let processed1 = 0;
        let skippedOutOfWindow1 = 0;
        for (const doc of snap1.docs) {
            const session = doc.data();
            const targetMs = (0, sessionDateHelpers_1.sessionLisbonTimestampMs)(session.scheduled_date, session.scheduled_time);
            if (targetMs === null) {
                await doc.ref.update({ reminder_1h_pending: false });
                continue;
            }
            if (!inWindow(targetMs, nowMs, 45 * MIN_MS, 75 * MIN_MS)) {
                skippedOutOfWindow1 += 1;
                if (targetMs < nowMs) {
                    await doc.ref.update({ reminder_1h_pending: false });
                }
                continue;
            }
            await sendSessionReminder({
                sessionId: doc.id,
                session,
                templateName: 'sessionReminder1h',
                notificationType: 'session_reminder_1h',
            });
            await doc.ref.update({
                reminder_1h_pending: false,
                reminder_1h_sent_at: new Date().toISOString(),
            });
            processed1 += 1;
        }
        firebase_functions_1.logger.info('scheduledReminders_1h_summary', {
            scanned: snap1.size,
            processed: processed1,
            skippedOutOfWindow: skippedOutOfWindow1,
        });
    }
    catch (err) {
        firebase_functions_1.logger.error('scheduledReminders_1h_failed', { error: String(err) });
    }
});
