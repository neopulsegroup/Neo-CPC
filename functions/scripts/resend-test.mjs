import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey?.trim()) {
  console.error('Defina RESEND_API_KEY no ambiente antes de executar.');
  console.error('Exemplo: RESEND_API_KEY=re_xxx npm run resend:test');
  process.exit(1);
}

const resend = new Resend(apiKey.trim());

async function main() {
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to: process.env.RESEND_TEST_TO || 'mkt.neopulsegroup@gmail.com',
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
  });

  console.log('Resposta do Resend:', result);
}

main().catch((error) => {
  console.error('Erro ao enviar email com Resend:', error);
  process.exit(1);
});
