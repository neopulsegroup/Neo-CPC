import { addDocument, deleteDocument, getDocument, serverTimestamp, setDocument } from '@/integrations/firebase/firestore';
import { isCpcManagementRole } from '@/lib/cpcRoles';

/**
 * Classificação interna de migrantes (uso exclusivo da equipa de gestão CPC).
 *
 * - Perfil A: elegível no âmbito do projeto (migrante residente no Algarve).
 * - Perfil B: não elegível.
 * - `null`: ainda sem perfil definido.
 *
 * Esta classificação é interna: fica numa coleção (`migrant_classifications`)
 * que os migrantes não conseguem ler (ver firestore.rules).
 */
export type EligibilityProfile = 'A' | 'B';

/** Valor do filtro: todos, A, B, ou ainda sem classificação. */
export type EligibilityFilter = 'all' | EligibilityProfile | 'unset';

/** Coleção Firestore onde fica a classificação (id do doc === user_id). */
export const MIGRANT_CLASSIFICATIONS_COLLECTION = 'migrant_classifications';

export const ELIGIBILITY_PROFILE_OPTIONS: EligibilityProfile[] = ['A', 'B'];

export function isEligibilityProfile(value: unknown): value is EligibilityProfile {
  return value === 'A' || value === 'B';
}

/** Normaliza o valor vindo do Firestore para `EligibilityProfile | null`. */
export function normalizeEligibilityProfile(value: unknown): EligibilityProfile | null {
  return isEligibilityProfile(value) ? value : null;
}

export function canManageMigrantEligibility(role: string | undefined | null): boolean {
  return isCpcManagementRole(role ?? null);
}

export async function loadMigrantEligibilityClassification(userId: string): Promise<EligibilityProfile | null> {
  const doc = await getDocument<{ eligibility_profile?: unknown }>(MIGRANT_CLASSIFICATIONS_COLLECTION, userId);
  if (!doc) return null;
  return normalizeEligibilityProfile(doc.eligibility_profile);
}

export async function saveMigrantEligibilityClassification(input: {
  userId: string;
  next: EligibilityProfile | null;
  actorId: string | null;
}): Promise<void> {
  const { userId, next, actorId } = input;
  if (next === null) {
    await deleteDocument(MIGRANT_CLASSIFICATIONS_COLLECTION, userId);
  } else {
    await setDocument(
      MIGRANT_CLASSIFICATIONS_COLLECTION,
      userId,
      {
        eligibility_profile: next,
        user_id: userId,
        updatedBy: actorId,
        updatedAt: serverTimestamp(),
      },
      true,
    );
  }

  if (actorId) {
    await addDocument('audit_logs', {
      action: next === null ? 'migrant.eligibility_cleared' : 'migrant.eligibility_set',
      actor_id: actorId,
      target_id: userId,
      context: 'migrant_profile',
      detail: next ?? 'cleared',
      createdAt: serverTimestamp(),
    });
  }
}
