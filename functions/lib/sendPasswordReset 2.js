"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPasswordReset = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const sendEmail_1 = require("./sendEmail");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const RESET_CORS_ORIGINS = [
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
function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function resolveContinueUrl(value) {
    if (typeof value !== 'string' || !value.trim())
        return DEFAULT_CONTINUE_URL;
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:' && url.protocol !== 'http:')
            return DEFAULT_CONTINUE_URL;
        const host = url.hostname;
        const allowed = ALLOWED_CONTINUE_HOSTS.some((re) => re.test(host));
        return allowed ? url.toString() : DEFAULT_CONTINUE_URL;
    }
    catch {
        return DEFAULT_CONTINUE_URL;
    }
}
function buildEmail(link) {
    const subject = 'Redefinição de palavra-passe — Portal Conecta Caminhos';
    const text = `Recebemos um pedido para redefinir a sua palavra-passe no Portal Conecta Caminhos.\n\n` +
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
exports.requestPasswordReset = (0, https_1.onCall)({
    region: 'us-central1',
    invoker: 'public',
    cors: RESET_CORS_ORIGINS,
}, async (request) => {
    const payload = (request.data || {});
    const email = normalizeEmail(payload.email);
    if (!isValidEmail(email)) {
        throw new https_1.HttpsError('invalid-argument', 'Email inválido.');
    }
    const continueUrl = resolveContinueUrl(payload.continueUrl);
    let link;
    try {
        link = await firebase_admin_1.default
            .auth((0, admin_1.getAdminApp)())
            .generatePasswordResetLink(email, { url: continueUrl });
    }
    catch (error) {
        const code = error?.code ?? '';
        // Não revelar inexistência do utilizador.
        if (code === 'auth/user-not-found' || code === 'auth/email-not-found') {
            firebase_functions_1.logger.info('password_reset_unknown_email');
            return { ok: true };
        }
        firebase_functions_1.logger.error('password_reset_link_error', {
            code,
            message: error instanceof Error ? error.message : String(error ?? ''),
        });
        throw new https_1.HttpsError('internal', 'Não foi possível processar o pedido neste momento.');
    }
    try {
        const { subject, text, html } = buildEmail(link);
        await (0, sendEmail_1.sendEmailViaSmtp)({ to: email, subject, text, html });
    }
    catch (error) {
        firebase_functions_1.logger.error('password_reset_send_error', {
            message: error instanceof Error ? error.message : String(error ?? ''),
        });
        throw new https_1.HttpsError('internal', 'Não foi possível enviar o email neste momento.');
    }
    return { ok: true };
});
