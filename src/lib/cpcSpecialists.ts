import { queryDocuments } from '@/integrations/firebase/firestore';
import { normalizeCpcTeamRole, type CpcTeamRole } from '@/lib/cpcRoles';

export type AgendaCategory = 'legal' | 'psychology' | 'mediation' | 'collective';

export type CpcSpecialistOption = {
  id: string;
  name: string;
  role: CpcTeamRole;
};

type UserDoc = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  active?: boolean | null;
};

const CATEGORY_TEAM_ROLES: Record<Exclude<AgendaCategory, 'collective'>, readonly CpcTeamRole[]> = {
  legal: ['lawyer'],
  psychology: ['psychologist'],
  mediation: ['mediator'],
};

export const CATEGORY_SESSION_TYPE: Record<AgendaCategory, string> = {
  legal: 'jurista',
  psychology: 'psicologa',
  mediation: 'mediador',
  collective: 'coletiva',
};

export const CATEGORY_SERVICE_ID: Record<Exclude<AgendaCategory, 'collective'>, string> = {
  legal: 'legal',
  psychology: 'psychology',
  mediation: 'mediation',
};

export async function loadCpcTeamSpecialists(category: Exclude<AgendaCategory, 'collective'>): Promise<CpcSpecialistOption[]> {
  const allowedRoles = new Set<string>(CATEGORY_TEAM_ROLES[category]);
  const users = await queryDocuments<UserDoc>('users', []);
  return (users ?? [])
    .filter((user) => user.active !== false)
    .map((user) => {
      const role = normalizeCpcTeamRole(user.role);
      if (!role || !allowedRoles.has(role)) return null;
      const name = (user.name?.trim() || user.email?.trim() || '').toString();
      if (!name) return null;
      return { id: user.id, name, role };
    })
    .filter((row): row is CpcSpecialistOption => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}
