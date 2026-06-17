/**
 * CAPTCHA self-contained (sem dependências externas) usado no registo.
 *
 * Objetivo: travar bots/scripts ingénuos e spam de formulário no cliente,
 * complementando as proteções de servidor já existentes (rate limiting em
 * `registerUserSecure` + verificação reCAPTCHA v3 quando configurada).
 *
 * Estas funções são puras (sem DOM) para serem testáveis isoladamente.
 */

/**
 * Alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L) para reduzir erros
 * de leitura humana mantendo entropia suficiente.
 */
const CAPTCHA_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const DEFAULT_CAPTCHA_LENGTH = 5;

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

/** Gera um código aleatório com o alfabeto não ambíguo. */
export function generateCaptchaCode(length: number = DEFAULT_CAPTCHA_LENGTH): string {
  const size = Number.isFinite(length) && length > 0 ? Math.floor(length) : DEFAULT_CAPTCHA_LENGTH;
  let code = '';
  for (let i = 0; i < size; i += 1) {
    code += CAPTCHA_ALPHABET.charAt(randomInt(CAPTCHA_ALPHABET.length));
  }
  return code;
}

/** Normaliza a resposta do utilizador para comparação tolerante. */
export function normalizeCaptchaInput(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Verifica a resposta de forma case-insensitive e ignorando espaços.
 * Devolve `false` para código ou resposta vazios.
 */
export function isCaptchaSolved(input: string | null | undefined, code: string | null | undefined): boolean {
  const normalizedCode = normalizeCaptchaInput(code);
  if (!normalizedCode) return false;
  return normalizeCaptchaInput(input) === normalizedCode;
}
