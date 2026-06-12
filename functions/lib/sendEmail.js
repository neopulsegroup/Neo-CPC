"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailViaSmtp = sendEmailViaSmtp;
const mailProcessor_1 = require("./mailProcessor");
const smtp_1 = require("./smtp");
/**
 * Envia um email imediatamente através do SMTP configurado em
 * `system_settings/smtp`. Usado por callables que precisam de feedback
 * síncrono (ex.: formulário de contacto, recuperação de palavra-passe),
 * ao contrário da fila `mail/` consumida por `onMailCreated`.
 */
async function sendEmailViaSmtp(email) {
    const to = email.to.trim();
    const subject = email.subject.trim();
    const text = (email.text ?? '').trim();
    const html = (email.html ?? '').trim();
    if (!to)
        throw new Error('Destinatário em falta.');
    if (!subject)
        throw new Error('Assunto em falta.');
    if (!text && !html)
        throw new Error('Conteúdo do email em falta.');
    const smtp = await (0, mailProcessor_1.loadSmtpSettings)();
    const transporter = (0, smtp_1.createTransport)(smtp);
    const from = email.from?.trim() || smtp.fromEmail;
    const replyTo = email.replyTo?.trim() || undefined;
    await transporter.sendMail({
        to,
        from,
        replyTo,
        subject,
        text: text || undefined,
        html: html || undefined,
    });
}
