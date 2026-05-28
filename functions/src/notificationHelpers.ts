/**
 * TASK-08 — Helpers partilhados pelos 5 triggers de notificação por email.
 *
 * Cada Cloud Function:
 *   1. lê o doc do trigger,
 *   2. enriquece com profile/company/offer conforme necessário,
 *   3. verifica `email_notifications_enabled` no perfil destinatário (default true),
 *   4. resolve template e locale via renderTemplate(),
 *   5. enfileira em `mail/{auto-id}` (consumido pelo `onMailCreated`).
 *
 * Falha de envio não bloqueia operação principal — apenas `logger.error`
 * estruturado. Sem retry custom (Firestore trigger já retry automaticamente
 * em erros não-handled).
 */

import admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { getFirestore } from './admin';
import { renderTemplate, type EmailLocale, type EmailTemplateName } from './emailTemplates';

/** Set de roles consideradas "admin / equipa CPC" para fins de moderação. */
const CPC_MODERATION_ROLES = new Set<string>([
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
function isEmailOptedOut(profileData: Record<string, unknown> | null | undefined): boolean {
  if (!profileData) return false;
  return profileData.email_notifications_enabled === false;
}

/** Normaliza valor para EmailLocale com fallback PT. */
export function asEmailLocale(value: unknown): EmailLocale {
  if (value === 'pt' || value === 'en' || value === 'es' || value === 'fr') return value;
  return 'pt';
}

/** Lê profiles/{uid} ou devolve null sem erro. */
export async function getProfileDoc(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const snap = await getFirestore().doc(`profiles/${uid}`).get();
    return snap.exists ? (snap.data() ?? null) : null;
  } catch (err) {
    logger.warn('notificationHelpers_getProfileDoc_failed', { uid, error: String(err) });
    return null;
  }
}

/** Lê users/{uid} ou devolve null sem erro. */
export async function getUserDoc(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const snap = await getFirestore().doc(`users/${uid}`).get();
    return snap.exists ? (snap.data() ?? null) : null;
  } catch (err) {
    logger.warn('notificationHelpers_getUserDoc_failed', { uid, error: String(err) });
    return null;
  }
}

/** Lê companies/{uid} ou devolve null sem erro. */
export async function getCompanyDoc(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const snap = await getFirestore().doc(`companies/${uid}`).get();
    return snap.exists ? (snap.data() ?? null) : null;
  } catch (err) {
    logger.warn('notificationHelpers_getCompanyDoc_failed', { uid, error: String(err) });
    return null;
  }
}

/**
 * Verifica se o destinatário pode receber email:
 *   - tem email válido em `profiles.email` ou `users.email`
 *   - `profiles.email_notifications_enabled !== false`
 * Devolve `{ to, locale }` se ok; null caso contrário.
 */
export async function resolveRecipient(uid: string): Promise<{ to: string; locale: EmailLocale } | null> {
  const profile = await getProfileDoc(uid);
  if (isEmailOptedOut(profile)) {
    logger.info('notification_skipped_opted_out', { uid });
    return null;
  }
  const profileEmail =
    typeof profile?.email === 'string' && profile.email.trim() ? profile.email.trim() : null;
  const user = profileEmail ? null : await getUserDoc(uid);
  const userEmail = typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null;
  const to = profileEmail || userEmail;
  if (!to) {
    logger.warn('notification_skipped_no_email', { uid });
    return null;
  }
  const locale = asEmailLocale(profile?.language ?? profile?.preferred_language);
  return { to, locale };
}

/**
 * Enfileira um email em `mail/{auto-id}` no formato consumido pelo
 * `onMailCreated`. Falhas são logadas e devolve null — nunca lança.
 */
export async function enqueueEmail(args: {
  to: string;
  templateName: EmailTemplateName;
  locale: EmailLocale;
  vars: Record<string, string | number>;
  tag: string;
  /** ID do trigger (uid, appId, etc.) — usado para audit. */
  contextId?: string;
}): Promise<string | null> {
  try {
    const rendered = renderTemplate(args.templateName, args.locale, args.vars);
    const ref = await getFirestore().collection('mail').add({
      to: args.to,
      message: {
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
      tag: args.tag,
      status: 'queued',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info('notification_enqueued', {
      mailId: ref.id,
      to: args.to,
      template: args.templateName,
      locale: args.locale,
      tag: args.tag,
      contextId: args.contextId ?? null,
    });
    return ref.id;
  } catch (err) {
    logger.error('notification_enqueue_failed', {
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
export async function enqueueAppNotification(args: {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  /** Quem despoletou (uid ou identificador system como 'system_cron'). */
  createdBy?: string;
  /** ID do trigger para audit. */
  contextId?: string;
}): Promise<string | null> {
  try {
    const ref = await getFirestore().collection('notifications').add({
      recipient_id: args.recipientId,
      title: args.title,
      body: args.body,
      type: args.type,
      href: args.href ?? null,
      created_by: args.createdBy ?? 'system',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info('app_notification_enqueued', {
      notificationId: ref.id,
      recipientId: args.recipientId,
      type: args.type,
      contextId: args.contextId ?? null,
    });
    return ref.id;
  } catch (err) {
    logger.error('app_notification_enqueue_failed', {
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
export async function listCpcModerators(): Promise<Array<{ uid: string; to: string; locale: EmailLocale }>> {
  const db = getFirestore();
  const out: Array<{ uid: string; to: string; locale: EmailLocale }> = [];
  try {
    const snap = await db.collection('users').get();
    const targets: string[] = [];
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
      if (resolved) out.push({ uid, ...resolved });
    }
  } catch (err) {
    logger.error('listCpcModerators_failed', { error: String(err) });
  }
  return out;
}
