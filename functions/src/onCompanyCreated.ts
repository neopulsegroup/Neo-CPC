/**
 * TASK-08 — Trigger: nova empresa registada.
 *
 * Dispara em `companies/{uid}` create. Email lido de `profiles/{uid}` ou
 * `users/{uid}` (companies/ não armazena email diretamente). Idioma do
 * perfil (default PT). Respeita opt-out.
 *
 * Plano: `company_profiles` foi confirmado como `companies` em TASK-05.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { enqueueEmail, resolveRecipient } from './notificationHelpers';

export const onCompanyCreated = onDocumentCreated('companies/{uid}', async (event) => {
  const uid = event.params.uid as string;
  const data = event.data?.data();
  if (!data) return;

  // Empresa pode ter opt-out gravado direto no doc companies/.
  if (data.email_notifications_enabled === false) {
    logger.info('onCompanyCreated_skipped_opted_out_company_doc', { uid });
    return;
  }

  const recipient = await resolveRecipient(uid);
  if (!recipient) return; // helper já loga motivo (opt-out ou no_email).

  const companyName =
    typeof data.company_name === 'string' && data.company_name.trim()
      ? data.company_name.trim()
      : typeof data.name === 'string' && data.name.trim()
      ? data.name.trim()
      : 'Empresa';

  await enqueueEmail({
    to: recipient.to,
    templateName: 'welcomeCompany',
    locale: recipient.locale,
    vars: { companyName },
    tag: 'welcome-company',
    contextId: uid,
  });
});
