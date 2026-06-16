"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESEND_API_KEY = void 0;
exports.sendEmail = sendEmail;
const resend_1 = require("resend");
const params_1 = require("firebase-functions/params");
/** Secret definido aqui — qualquer CF que use sendEmail deve declarar:
 *    { secrets: [RESEND_API_KEY], ... }
 *  na sua config Gen2.
 */
exports.RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
const FROM_DEFAULT = process.env.RESEND_FROM_EMAIL || 'CPC <geral@portalcpc.com>';
/**
 * Envia um email via Resend.
 *
 * Lança Error se Resend devolver erro estruturado. Não captura exceções
 * de rede — chamadores devem decidir se retry / log / silenciar.
 */
async function sendEmail(args) {
    const resend = new resend_1.Resend(exports.RESEND_API_KEY.value());
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
