/**
 * TASK-07 — Trigger: nova sessão agendada.
 *
 * Dispara em `sessions/{sessionId}` create. Envia confirmação imediata a:
 *  - migrante (`migrant_id`)
 *  - profissional (`specialist_id` ou fallback `professional_id`)
 *
 * Marca a sessão com `reminder_24h_pending: true` e `reminder_1h_pending: true`
 * para o cron `scheduledReminders` processar mais tarde. Idempotente: o cron
 * desliga cada flag depois de enviar.
 *
 * Schema confirmado (BookingSessionWizardDialog:450):
 *   { migrant_id, session_type, scheduled_date, scheduled_time, status,
 *     service_label?, specialist_id?, specialist_name? }
 *
 * O campo do profissional pode ser `specialist_id` (canónico via BookingWizard)
 * ou `professional_id` (legado em alguns docs). Suportamos ambos.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { getFirestore } from './admin';
import {
  enqueueAppNotification,
  enqueueEmail,
  resolveRecipient,
} from './notificationHelpers';
import { formatSessionDateForEmail } from './sessionDateHelpers';

export const onSessionCreated = onDocumentCreated('sessions/{sessionId}', async (event) => {
  const sessionId = event.params.sessionId as string;
  const session = event.data?.data();
  if (!session) return;

  const migrantId = typeof session.migrant_id === 'string' ? session.migrant_id : null;
  const specialistId =
    (typeof session.specialist_id === 'string' && session.specialist_id) ||
    (typeof session.professional_id === 'string' && session.professional_id) ||
    null;

  const sessionType =
    (typeof session.service_label === 'string' && session.service_label.trim()) ||
    (typeof session.session_type === 'string' && session.session_type.trim()) ||
    'Sessão';
  const specialistName =
    typeof session.specialist_name === 'string' && session.specialist_name.trim()
      ? session.specialist_name.trim()
      : 'Equipa CPC';

  // Sempre que possível liga as flags para o cron — mesmo se não houver email
  // disponível neste momento (ex.: criação em background sem perfil completo).
  try {
    await event.data?.ref.update({
      reminder_24h_pending: true,
      reminder_1h_pending: true,
      reminder_flags_set_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('onSessionCreated_flag_update_failed', { sessionId, error: String(err) });
  }

  // ---- Migrante ----
  if (migrantId) {
    const migrantRecipient = await resolveRecipient(migrantId);
    if (migrantRecipient) {
      const sessionDateTime = formatSessionDateForEmail(
        session.scheduled_date,
        session.scheduled_time,
        migrantRecipient.locale
      );
      // Lê nome para personalizar (best effort).
      let migrantName = 'Migrante';
      try {
        const snap = await getFirestore().doc(`profiles/${migrantId}`).get();
        const data = snap.exists ? snap.data() : null;
        if (data && typeof data.name === 'string' && data.name.trim()) {
          migrantName = data.name.trim();
        }
      } catch (err) {
        logger.warn('onSessionCreated_migrant_name_lookup_failed', { sessionId, error: String(err) });
      }
      await enqueueEmail({
        to: migrantRecipient.to,
        templateName: 'sessionConfirmation',
        locale: migrantRecipient.locale,
        vars: { userName: migrantName, sessionType, sessionDateTime, specialistName },
        tag: 'session-confirmation',
        contextId: sessionId,
      });
      await enqueueAppNotification({
        recipientId: migrantId,
        type: 'session_scheduled',
        title: `Sessão marcada: ${sessionType}`,
        body: `Agendada para ${sessionDateTime}.`,
        href: '/dashboard/migrante/sessoes',
        contextId: sessionId,
      });
    }
  } else {
    logger.warn('onSessionCreated_skipped_no_migrant_id', { sessionId });
  }

  // ---- Profissional (consultant) ----
  if (specialistId) {
    const staffRecipient = await resolveRecipient(specialistId);
    if (staffRecipient) {
      const sessionDateTime = formatSessionDateForEmail(
        session.scheduled_date,
        session.scheduled_time,
        staffRecipient.locale
      );
      let migrantName = 'Migrante';
      if (migrantId) {
        try {
          const snap = await getFirestore().doc(`profiles/${migrantId}`).get();
          const data = snap.exists ? snap.data() : null;
          if (data && typeof data.name === 'string' && data.name.trim()) {
            migrantName = data.name.trim();
          }
        } catch (err) {
          logger.warn('onSessionCreated_migrant_lookup_for_staff_failed', { sessionId, error: String(err) });
        }
      }
      let staffName = 'Profissional';
      try {
        const snap = await getFirestore().doc(`profiles/${specialistId}`).get();
        const data = snap.exists ? snap.data() : null;
        if (data && typeof data.name === 'string' && data.name.trim()) {
          staffName = data.name.trim();
        }
      } catch (err) {
        logger.warn('onSessionCreated_staff_name_lookup_failed', { sessionId, error: String(err) });
      }
      await enqueueEmail({
        to: staffRecipient.to,
        templateName: 'sessionConfirmationStaff',
        locale: staffRecipient.locale,
        vars: { userName: staffName, sessionType, sessionDateTime, migrantName },
        tag: 'session-confirmation-staff',
        contextId: sessionId,
      });
      await enqueueAppNotification({
        recipientId: specialistId,
        type: 'session_scheduled',
        title: `Nova sessão: ${sessionType}`,
        body: `Migrante ${migrantName} — ${sessionDateTime}.`,
        href: '/dashboard/cpc/agenda',
        contextId: sessionId,
      });
    }
  } else {
    logger.info('onSessionCreated_no_specialist_assigned', { sessionId });
  }
});
