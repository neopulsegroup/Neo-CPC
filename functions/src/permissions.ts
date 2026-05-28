import { getFirestore } from './admin';

export async function isAdminUser(uid: string): Promise<boolean> {
  const db = getFirestore();
  const [userSnap, profileSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`profiles/${uid}`).get()]);

  const roleFrom = (data?: FirebaseFirestore.DocumentData | undefined): string | null => {
    if (!data) return null;
    const raw = data.role ?? data.profile ?? data.perfil ?? data.type;
    return typeof raw === 'string' ? raw.toLowerCase() : null;
  };

  const role = roleFrom(userSnap.exists ? userSnap.data() : undefined) ?? roleFrom(profileSnap.exists ? profileSnap.data() : undefined);
  if (!role) return false;
  if (role === 'admin' || role === 'administrador') return true;
  if (role === 'cpc' || role === 'team' || role === 'staff' || role === 'equipa') return true;
  return false;
}

