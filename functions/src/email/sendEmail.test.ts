import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock do SDK do Resend ANTES do import do sendEmail (sendEmail importa Resend).
const mockSend = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

// Mock do helper defineSecret — em ambiente de teste devolve um stub com .value().
vi.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    name,
    value: () => 'test-api-key',
  }),
}));

import { sendEmail } from './sendEmail';

describe('sendEmail (RESEND wrapper)', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('envia com sucesso e devolve o id', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 're_abc123' }, error: null });

    const result = await sendEmail({
      to: 'destinatario@exemplo.pt',
      subject: 'Assunto',
      html: '<p>olá</p>',
    });

    expect(result.id).toBe('re_abc123');
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0] as { from?: string; to?: unknown; subject?: string; html?: string };
    expect(call.to).toBe('destinatario@exemplo.pt');
    expect(call.subject).toBe('Assunto');
    expect(call.html).toBe('<p>olá</p>');
    // from default aplicado quando não especificado.
    expect(call.from).toMatch(/CPC <.*>/);
  });

  it('lança Error quando Resend devolve erro estruturado', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'rate limit' } });

    await expect(
      sendEmail({
        to: 'destinatario@exemplo.pt',
        subject: 'Assunto',
        html: '<p>olá</p>',
      })
    ).rejects.toThrow(/RESEND falhou/);
  });

  it('aceita from override e mantém os outros parâmetros intactos', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 're_xyz' }, error: null });

    await sendEmail({
      to: ['a@b.pt', 'c@d.pt'],
      subject: 'Multi',
      html: '<p>x</p>',
      text: 'x',
      from: 'contacto@portalcpc.com',
      replyTo: 'reply@cpc.pt',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0] as {
      from?: string;
      to?: string[];
      subject?: string;
      text?: string;
      replyTo?: string;
    };
    expect(call.from).toBe('contacto@portalcpc.com');
    expect(call.to).toEqual(['a@b.pt', 'c@d.pt']);
    expect(call.subject).toBe('Multi');
    expect(call.text).toBe('x');
    expect(call.replyTo).toBe('reply@cpc.pt');
  });
});
