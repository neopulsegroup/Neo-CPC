import { getDocument } from '@/integrations/firebase/firestore';

export type ApplicantIdentity = {
  name: string;
  email: string;
  /** Perfil inacessível à empresa (ex.: availableForWork desativado). */
  profileUnavailable: boolean;
};

function shortId(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function loadApplicantIdentityMap(
  applicantIds: string[],
  unknownApplicantLabel: string
): Promise<Map<string, ApplicantIdentity>> {
  const uniqueIds = Array.from(new Set(applicantIds.filter(Boolean)));
  const byId = new Map<string, ApplicantIdentity>();

  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const profile = await getDocument<{ name?: string | null; email?: string | null }>('profiles', id);
        byId.set(id, {
          name: profile?.name?.trim() || `${unknownApplicantLabel} (${shortId(id)})`,
          email: profile?.email?.trim() || '',
          profileUnavailable: false,
        });
      } catch {
        byId.set(id, {
          name: `${unknownApplicantLabel} (${shortId(id)})`,
          email: '',
          profileUnavailable: true,
        });
      }
    })
  );

  return byId;
}
