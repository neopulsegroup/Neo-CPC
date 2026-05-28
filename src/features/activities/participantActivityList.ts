import { queryDocuments } from '@/integrations/firebase/firestore';

/** Campos mínimos para listar atividades em que o migrante participa. */
export type ParticipantActivityFirestoreRow = {
  id: string;
  title?: string;
  date?: string;
  startAt?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number | null;
  status?: string | null;
  deletedAt?: unknown;
};

export function sortParticipantActivitiesByStartDesc(rows: ParticipantActivityFirestoreRow[]): ParticipantActivityFirestoreRow[] {
  const active = (rows || []).filter((r) => r.deletedAt == null);
  return active.slice().sort((a, b) => {
    const sa = (a.startAt || `${a.date || ''}T00:00:00`).slice(0, 19);
    const sb = (b.startAt || `${b.date || ''}T00:00:00`).slice(0, 19);
    return sb.localeCompare(sa);
  });
}

/** Máximo por consulta sem orderBy (evita índice composto com array-contains). */
export const MAX_PARTICIPANT_ACTIVITIES_QUERY_LIMIT = 1000;

/** Valores distintos a testar em array-contains (UID + email em várias grafias). */
function participantLookupTokens(uid: string, participantEmail?: string | null): string[] {
  const out = new Set<string>();
  const u = uid.trim();
  if (u) out.add(u);
  const raw = participantEmail?.trim();
  if (raw) {
    out.add(raw);
    out.add(raw.toLowerCase());
  }
  return [...out];
}

async function queryActivitiesContainingParticipant(
  token: string,
  limit: number
): Promise<ParticipantActivityFirestoreRow[]> {
  if (!token) return [];
  return queryDocuments<ParticipantActivityFirestoreRow>(
    'activities',
    [{ field: 'participantMigrantIds', operator: 'array-contains', value: token }],
    undefined,
    limit
  );
}

/**
 * Carrega atividades em que o utilizador figura em `participantMigrantIds`.
 * Faz várias consultas (UID, email, email em minúsculas) e junta por `id`, porque dados antigos
 * ou importações podem guardar o email em vez do UID do Auth.
 */
export async function loadParticipantActivitiesForUser(
  uid: string,
  options?: { firestoreLimit?: number; participantEmail?: string | null }
): Promise<ParticipantActivityFirestoreRow[]> {
  const limit = Math.min(Math.max(options?.firestoreLimit ?? 200, 1), MAX_PARTICIPANT_ACTIVITIES_QUERY_LIMIT);
  const tokens = participantLookupTokens(uid, options?.participantEmail ?? null);
  const seen = new Set<string>();
  const merged: ParticipantActivityFirestoreRow[] = [];

  for (const token of tokens) {
    try {
      const chunk = await queryActivitiesContainingParticipant(token, limit);
      for (const row of chunk) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          merged.push(row);
        }
      }
    } catch (err) {
      console.error('loadParticipantActivitiesForUser: consulta falhou', err);
    }
  }

  return sortParticipantActivitiesByStartDesc(merged);
}
