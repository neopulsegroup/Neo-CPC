import { getUserProfile, type UserProfile } from '@/integrations/firebase/auth';
import { getDocument, queryDocuments, serverTimestamp, updateDocument } from '@/integrations/firebase/firestore';

export type MigrantSession = {
  id: string;
  migrant_id: string;
  session_type: string;
  scheduled_date: string;
  scheduled_time: string;
  professional_id?: string | null;
  status?: string | null;
};

export type TrailProgress = {
  id: string;
  user_id: string;
  trail_id: string;
  progress_percent?: number | null;
  modules_completed?: number | null;
  completed_at?: string | null;
};

export type TrailInfo = {
  id: string;
  title?: string;
  modules_count?: number | null;
};

export type MigrantProfileDoc = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  registeredAt?: unknown | null;
  /**
   * Ano em que o migrante entrou no programa CIBEA (fins estatísticos).
   * Distinto de `registeredAt` (timestamp técnico de criação do perfil).
   * TODO(D8): confirmar com CIBEA o ano mínimo aceito (default usa ano atual-5).
   */
  registrationYear?: number | null;
  photoUrl?: string | null;
  currentLocation?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  /** Código postal (rótulo CEP no formulário). */
  cep?: string | null;
  /** Legado; não exposto no UI — migração para `cep`. */
  identificationNumber?: string | null;
  region?: 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Outra' | null;
  regionOther?: string | null;
  arrivalDate?: string | null;
  resumeUrl?: string | null;
  professionalTitle?: string | null;
  professionalExperience?: string | null;
  skills?: string | null;
  languagesList?: string | null;
  mainNeeds?: string | null;
  contactPreference?: 'email' | 'phone' | null;
  availableForWork?: boolean | null;
};

export type MigrantTriageDoc = {
  id: string;
  userId: string;
  completed?: boolean;
  completedAt?: string | null;
  answers?: Record<string, unknown> | null;
  legal_status?: string | null;
  housing_status?: string | null;
  work_status?: string | null;
  language_level?: string | null;
  interests?: string[] | null;
  urgencies?: string[] | null;
};

export type MigrantProfileResponse = {
  userProfile: UserProfile | null;
  profile: MigrantProfileDoc | null;
  triage: MigrantTriageDoc | null;
  sessions: MigrantSession[];
  progress: TrailProgress[];
  trails: Record<string, TrailInfo | null>;
};

export async function fetchMigrantProfile(uid: string): Promise<MigrantProfileResponse> {
  async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  const userProfile = await safe(() => getUserProfile(uid), null);

  const profileFs = await safe(() => getDocument<Partial<MigrantProfileDoc>>('profiles', uid), null);
  if (profileFs && !('registeredAt' in profileFs)) {
    void safe(
      () =>
        updateDocument('profiles', uid, {
          registeredAt: userProfile?.createdAt ?? serverTimestamp(),
        }),
      null
    );
  }

  const profile: MigrantProfileDoc | null = (() => {
    const name = profileFs?.name || userProfile?.name || '';
    const email = profileFs?.email || userProfile?.email || '';
    if (!name && !email) return null;
    return {
      id: uid,
      name,
      email,
      phone: profileFs?.phone ?? null,
      birthDate: profileFs?.birthDate ?? null,
      nationality: profileFs?.nationality ?? null,
      registeredAt: profileFs?.registeredAt ?? userProfile?.createdAt ?? null,
      registrationYear:
        typeof profileFs?.registrationYear === 'number' && Number.isFinite(profileFs.registrationYear)
          ? profileFs.registrationYear
          : null,
      photoUrl: profileFs?.photoUrl ?? null,
      currentLocation: profileFs?.currentLocation ?? null,
      address: profileFs?.address ?? null,
      addressNumber: profileFs?.addressNumber ?? null,
      cep: profileFs?.cep ?? null,
      identificationNumber: profileFs?.identificationNumber ?? null,
      region: (profileFs?.region as MigrantProfileDoc['region']) ?? null,
      regionOther: profileFs?.regionOther ?? null,
      arrivalDate: profileFs?.arrivalDate ?? null,
      resumeUrl: profileFs?.resumeUrl ?? null,
      professionalTitle: profileFs?.professionalTitle ?? null,
      professionalExperience: profileFs?.professionalExperience ?? null,
      skills: profileFs?.skills ?? null,
      languagesList: profileFs?.languagesList ?? null,
      mainNeeds: profileFs?.mainNeeds ?? null,
      contactPreference: profileFs?.contactPreference ?? null,
      availableForWork: typeof profileFs?.availableForWork === 'boolean' ? profileFs.availableForWork : null,
    };
  })();

  const triage = await safe(() => getDocument<MigrantTriageDoc>('triage', uid), null);

  const sessions = await safe(
    () => queryDocuments<MigrantSession>('sessions', [{ field: 'migrant_id', operator: '==', value: uid }], { field: 'scheduled_date', direction: 'desc' }),
    []
  );

  const progress = await safe(
    () => queryDocuments<TrailProgress>('user_trail_progress', [{ field: 'user_id', operator: '==', value: uid }]),
    []
  );

  const trails = await safe(async () => {
    const trailIds = Array.from(new Set(progress.map((p) => p.trail_id).filter(Boolean)));
    const map: Record<string, TrailInfo | null> = {};
    if (trailIds.length === 0) return map;
    const docs = await Promise.all(trailIds.map((id) => getDocument<TrailInfo>('trails', id)));
    trailIds.forEach((id, idx) => {
      map[id] = docs[idx] || null;
    });
    return map;
  }, {});

  return { userProfile, profile, triage, sessions, progress, trails };
}
