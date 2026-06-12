import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { getAdminApp } from './admin';
import { sendEmailViaSmtp } from './sendEmail';
import admin from 'firebase-admin';

const RESET_CORS_ORIGINS: Array<string | RegExp> = [
  'https://www.portalcpc.com',
  'https://portalcpc.com',
  'https://cpc-projeto-app.web.app',
  'https://cpc-projeto-app.firebaseapp.com',
  'https://saas-cpc.vercel.app',
  /^https:\/\/[\w-]+\.portalcpc\.com$/,
  /^https:\/\/[\w-]+\.vercel\.app$/,
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8090',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8090',
];

const DEFAULT_CONTINUE_URL = 'https://www.portalcpc.com/entrar';

/** Hosts autorizados para o continueUrl (evita open redirect via param). */
const ALLOWED_CONTINUE_HOSTS = [/(^|\.)portalcpc\.com$/, /(^|\.)vercel\.app$/];

type ResetPayload = {
  email?: unknown;
  continueUrl?: unknown;
};

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveContinueUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_CONTINUE_URL;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_CONTINUE_URL;
    const host = url.hostname;
    const allowed = ALLOWED_CONTINUE_HOSTS.some((re) => re.test(host));
    return allowed ? url.toString() : DEFAULT_CONTINUE_URL;
  } catch {
    return DEFAULT_CONTINUE_URL;
  }
}

function buildEmail(link: string): { subject: string; text: string; html: string } {
  const subject = 'Redefinição de palavra-passe — Portal Conecta Caminhos';
  const text =
    `Recebemos um pedido para redefinir a sua palavra-passe no Portal Conecta Caminhos.\n\n` +
    `Abra o link seguinte para criar uma nova palavra-passe:\n${link}\n\n` +
    `Se não foi você a fazer este pedido, pode ignorar este email com segurança.\n`;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0a0a0a; max-width: 520px; margin: 0 auto;">
      <h2 style="margin: 0 0 16px;">Redefinição de palavra-passe</h2>
      <p style="margin: 0 0 12px; line-height: 1.5;">
        Recebemos um pedido para redefinir a sua palavra-passe no <strong>Portal Conecta Caminhos</strong>.
      </p>
      <p style="margin: 0 0 20px; line-height: 1.5;">
        Clique no botão abaixo para criar uma nova palavra-passe:
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${escapeHtml(link)}" style="display: inline-block; background: #0d6efd; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
          Redefinir palavra-passe
        </a>
      </p>
      <p style="margin: 0 0 12px; line-height: 1.5; font-size: 13px; color: #555;">
        Se o botão não funcionar, copie e cole este endereço no navegador:<br />
        <a href="${escapeHtml(link)}" style="color: #0d6efd; word-break: break-all;">${escapeHtml(link)}</a>
      </p>
      <p style="margin: 16px 0 0; line-height: 1.5; font-size: 13px; color: #555;">
        Se não foi você a fazer este pedido, pode ignorar este email com segurança.
      </p>
    </div>
  `.trim();
  return { subject, text, html };
}

/**
 * Gera o link de redefinição de palavra-passe via Admin SDK e envia-o
 * pelo SMTP configurado em `system_settings/smtp` (substitui o email
 * nativo do Firebase Auth). Devolve sempre `{ ok: true }` para não
 * revelar se o email existe (proteção contra enumeração).
 */
export const requestPasswordReset = onCall(
  {
    region: 'us-central1',
    invoker: 'public',
    cors: RESET_CORS_ORIGINS,
  },
  async (request) => {
    const payload = (request.data || {}) as ResetPayload;
    const email = normalizeEmail(payload.email);
    if (!isValidEmail(email)) {
      throw new HttpsError('invalid-argument', 'Email inválido.');
    }

    const continueUrl = resolveContinueUrl(payload.continueUrl);

    let link: string;
    try {
      link = await admin
        .auth(getAdminApp())
        .generatePasswordResetLink(email, { url: continueUrl });
    } catch (error: unknown) {
      const code = (error as { code?: string } | null)?.code ?? '';
      // Não revelar inexistência do utilizador.
      if (code === 'auth/user-not-found' || code === 'auth/email-not-found') {
        logger.info('password_reset_unknown_email');
        return { ok: true };
      }
      logger.error('password_reset_link_error', {
        code,
        message: error instanceof Error ? error.message : String(error ?? ''),
      });
      throw new HttpsError('internal', 'Não foi possível processar o pedido neste momento.');
    }

    try {
      const { subject, text, html } = buildEmail(link);
      await sendEmailViaSmtp({ to: email, subject, text, html });
    } catch (error: unknown) {
      logger.error('password_reset_send_error', {
        message: error instanceof Error ? error.message : String(error ?? ''),
      });
      throw new HttpsError('internal', 'Não foi possível enviar o email neste momento.');
    }

    return { ok: true };
  }
);
