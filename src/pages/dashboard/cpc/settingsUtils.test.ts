import { describe, expect, it } from 'vitest';

import { buildContactNotificationMail, buildSmtpTestMail, isValidEmail } from './settingsUtils';

describe('settingsUtils', () => {
  it('valida email', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('gera payload de email de contacto com subject e html', () => {
    const mail = buildContactNotificationMail({
      to: 'Admin@CPC.PT',
      from: 'noreply@cpc.pt',
      replyTo: 'user@example.com',
      name: 'João',
      email: 'user@example.com',
      message: 'Olá!',
      createdAtISO: '2026-04-07T12:00:00.000Z',
    });

    expect(mail.to).toBe('admin@cpc.pt');
    expect(mail.message.subject).toContain('Novo contacto');
    expect(mail.message.html).toContain('Novo contacto');
    expect(mail.message.text).toContain('Mensagem');
    expect(mail.message.replyTo).toBe('user@example.com');
    expect(mail.message.from).toBe('noreply@cpc.pt');
  });

  it('gera payload de email de teste SMTP', () => {
    const mail = buildSmtpTestMail({
      to: 'admin@cpc.pt',
      from: 'no-reply@cpc.pt',
      summary: 'Servidor: smtp.example.com',
    });
    expect(mail.to).toBe('admin@cpc.pt');
    expect(mail.message.from).toBe('no-reply@cpc.pt');
    expect(mail.message.subject).toContain('Teste SMTP');
  });
});
