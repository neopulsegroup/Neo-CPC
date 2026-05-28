export type SmtpSecurity = 'tls' | 'ssl';

export type CpcSystemSettings = {
  contactNotificationEmail: string;
  smtp: {
    host: string;
    port: number;
    security: SmtpSecurity;
    username: string;
    passwordSet: boolean;
    fromEmail: string;
  };
  updatedBy?: string | null;
  updatedAt?: unknown;
};

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function sanitizeHost(value: string): string {
  return value.trim();
}

export function sanitizeUsername(value: string): string {
  return value.trim();
}

export function parsePort(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const i = Math.floor(n);
  if (i < 1 || i > 65535) return 0;
  return i;
}

export function buildContactNotificationMail(args: {
  to: string;
  from?: string;
  replyTo?: string;
  name: string;
  email: string;
  message: string;
  createdAtISO: string;
}): { to: string; message: { subject: string; text: string; html: string; replyTo?: string; from?: string } } {
  const to = normalizeEmail(args.to);
  const senderEmail = normalizeEmail(args.email);
  const name = args.name.trim();
  const message = args.message.trim();
  const createdAt = args.createdAtISO;

  const subject = `Novo contacto — ${name || senderEmail}`;
  const text = `Novo contacto recebido.\n\nNome: ${name}\nEmail: ${senderEmail}\nData: ${createdAt}\n\nMensagem:\n${message}\n`;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0a0a0a;">
      <h2 style="margin: 0 0 12px;">Novo contacto</h2>
      <p style="margin: 0 0 6px;"><strong>Nome:</strong> ${escapeHtml(name || '—')}</p>
      <p style="margin: 0 0 6px;"><strong>Email:</strong> ${escapeHtml(senderEmail)}</p>
      <p style="margin: 0 0 12px;"><strong>Data:</strong> ${escapeHtml(createdAt)}</p>
      <div style="padding: 12px; background: #f6f7f9; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(message)}</div>
    </div>
  `.trim();

  const mail: { to: string; message: { subject: string; text: string; html: string; replyTo?: string; from?: string } } = {
    to,
    message: {
      subject,
      text,
      html,
    },
  };
  if (args.replyTo && isValidEmail(args.replyTo)) mail.message.replyTo = normalizeEmail(args.replyTo);
  if (args.from && isValidEmail(args.from)) mail.message.from = normalizeEmail(args.from);
  return mail;
}

export function buildSmtpTestMail(args: { to: string; from: string; summary: string }): {
  to: string;
  message: { subject: string; text: string; html: string; from: string };
} {
  const to = normalizeEmail(args.to);
  const from = normalizeEmail(args.from);
  const summary = args.summary.trim();
  const subject = 'Teste SMTP — CPC';
  const text = `Teste SMTP.\n\n${summary}\n`;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0a0a0a;">
      <h2 style="margin: 0 0 12px;">Teste SMTP</h2>
      <p style="margin: 0 0 12px;">${escapeHtml(summary)}</p>
    </div>
  `.trim();

  return { to, message: { subject, text, html, from } };
}

export function redactSettingsForAudit(input: Partial<CpcSystemSettings> | null | undefined) {
  if (!input) return null;
  return {
    ...input,
    smtp: input.smtp
      ? {
          host: input.smtp.host,
          port: input.smtp.port,
          security: input.smtp.security,
          username: input.smtp.username,
          passwordSet: input.smtp.passwordSet,
          fromEmail: input.smtp.fromEmail,
        }
      : undefined,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

