"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPasswordReset = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const admin_1 = require("./admin");
const smtp_1 = require("./smtp");
const mailProcessor_1 = require("./mailProcessor");
const PASSWORD_RESET_CORS_ORIGINS = [
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
function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
exports.requestPasswordReset = (0, https_1.onCall)({
    region: 'us-central1',
    /** Sem invoker público o preflight OPTIONS falha (erro de CORS no browser). */
    invoker: 'public',
    cors: PASSWORD_RESET_CORS_ORIGINS,
}, async (request) => {
    const email = normalizeEmail(request.data?.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new https_1.HttpsError('invalid-argument', 'Email inválido.');
    }
    const continueUrl = typeof request.data?.continueUrl === 'string' && request.data.continueUrl.trim()
        ? request.data.continueUrl.trim()
        : DEFAULT_CONTINUE_URL;
    try {
        const auth = firebase_admin_1.default.auth((0, admin_1.getAdminApp)());
        const link = await auth.generatePasswordResetLink(email, { url: continueUrl });
        const smtp = await (0, mailProcessor_1.loadSmtpSettings)();
        const transport = (0, smtp_1.createTransport)(smtp);
        const subject = 'Recuperação de palavra-passe — Portal CPC';
        const text = [
            'Recebemos um pedido para repor a sua palavra-passe no Portal CPC.',
            '',
            'Use o link abaixo (válido por tempo limitado):',
            link,
            '',
            'Se não pediu esta alteração, ignore este email.',
        ].join('\n');
        const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0a0a0a;">
        <h2 style="margin: 0 0 12px;">Recuperação de palavra-passe</h2>
        <p style="margin: 0 0 12px;">Recebemos um pedido para repor a sua palavra-passe no Portal CPC.</p>
        <p style="margin: 0 0 12px;"><a href="${escapeHtml(link)}">Redefinir palavra-passe</a></p>
        <p style="margin: 0 0 12px; font-size: 12px; color: #555;">Se o botão não funcionar, copie e cole este link no navegador:<br/>${escapeHtml(link)}</p>
        <p style="margin: 0; font-size: 12px; color: #555;">Se não pediu esta alteração, ignore este email.</p>
      </div>
    `.trim();
        await transport.sendMail({
            to: email,
            from: smtp.fromEmail,
            subject,
            text,
            html,
        });
    }
    catch (error) {
        firebase_functions_1.logger.warn('requestPasswordReset: falha ao enviar (resposta genérica ao cliente)', {
            email,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    return { ok: true };
});
