/**
 * T-01 · Email verification (Bloco 4).
 *
 * Cláusula "grandfather": utilizadores criados antes de `VERIFICATION_CUTOFF`
 * não são bloqueados pelo guard. Quando quisermos exigir verificação a todos,
 * basta apagar a verificação por `createdAt` no helper.
 *
 * Para personalizar o template enviado pelo Firebase:
 *   Firebase Console > Authentication > Templates > Email Address Verification
 */

import type { Timestamp } from 'firebase/firestore';

import type { UserProfile } from '@/integrations/firebase/auth';

/** ISO instant do dia de ativação do feature. Antes disto = grandfather. */
export const VERIFICATION_CUTOFF_ISO = '2026-06-01T00:00:00.000Z';

/** Em ms para comparar com Timestamps Firestore. */
export const VERIFICATION_CUTOFF_MS = Date.parse(VERIFICATION_CUTOFF_ISO);

/** Converte um `createdAt` (Timestamp / Date / ISO string / number) para ms. */
export function createdAtToMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === 'object') {
    const v = value as Partial<Timestamp> & { toDate?: () => Date };
    if (typeof v.toMillis === 'function') {
      try {
        return v.toMillis();
      } catch {
        return null;
      }
    }
    if (typeof v.toDate === 'function') {
      try {
        return v.toDate().getTime();
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Decide se o fluxo de verificação de email deve bloquear este utilizador.
 * Devolve `false` (não bloqueia) quando:
 *  - o utilizador já verificou o email; OU
 *  - o profile foi criado antes do `VERIFICATION_CUTOFF` (grandfather).
 *
 * `null` para profile (perfil ainda a carregar) → não bloqueia. O guard
 * só intervém com dados completos.
 */
export function shouldRequireEmailVerification(args: {
  emailVerified: boolean | null | undefined;
  profile: UserProfile | null | undefined;
}): boolean {
  const { emailVerified, profile } = args;
  if (emailVerified) return false;
  if (!profile) return false;
  const ms = createdAtToMillis(profile.createdAt);
  if (ms !== null && ms < VERIFICATION_CUTOFF_MS) return false;
  return true;
}
