/**
 * Wrapper unificado de envio de email via Resend.
 *
 * Este é o ÚNICO ponto de envio de email do sistema desde a consolidação
 * SMTP→RESEND (ver CHANGELOG e docs/SETUP_SECRETS.md secção 6).
 *
 * Antes: notificationHelpers.enqueueEmail() escrevia em `mail/{id}` e o
 * trigger `onMailCreated` enviava via SMTP. Hoje: chama direto.
 *
 * Secret necessário: RESEND_API_KEY (via `firebase functions:secrets:set`).
 * Env opcional: RESEND_FROM_EMAIL (default `CPC <geral@portalcpc.com>`).
 */

import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';

/** Secret definido aqui — qualquer CF que use sendEmail deve declarar:
 *    { secrets: [RESEND_API_KEY], ... }
 *  na sua config Gen2.
 */
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

const FROM_DEFAULT = process.env.RESEND_FROM_EMAIL || 'CPC <geral@portalcpc.com>';

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** Tag opcional para audit/log (não vai no email). */
  tag?: string;
}

export interface SendEmailResult {
  id: string;
}

/**
 * Envia um email via Resend.
 *
 * Lança Error se Resend devolver erro estruturado. Não captura exceções
 * de rede — chamadores devem decidir se retry / log / silenciar.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const resend = new Resend(RESEND_API_KEY.value());
  const result = await resend.emails.send({
    from: args.from || FROM_DEFAULT,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    replyTo: args.replyTo,
  });
  if (result.error) {
    throw new Error(`RESEND falhou: ${result.error.message ?? 'erro desconhecido'}`);
  }
  return { id: result.data?.id || '' };
}
