import { getFirestore } from './admin';

function normalizeRole(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const role = value.trim().toLowerCase();
  if (!role) return null;
  if (role === 'administrador') return 'admin';
  if (role === 'gestor') return 'manager';
  return role;
}

export async function canManageSystemSettings(uid: string): Promise<boolean> {
  const db = getFirestore();
  const [userSnap, profileSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`profiles/${uid}`).get()]);

  const roleFrom = (data?: FirebaseFirestore.DocumentData | undefined): string | null => {
    if (!data) return null;
    return normalizeRole(data.role ?? data.profile ?? data.perfil ?? data.type);
  };

  const role =
    roleFrom(userSnap.exists ? userSnap.data() : undefined) ??
    roleFrom(profileSnap.exists ? profileSnap.data() : undefined);

  return role === 'admin' || role === 'manager';
}
