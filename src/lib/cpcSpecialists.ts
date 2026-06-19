import { queryDocuments } from '@/integrations/firebase/firestore';
import { normalizeCpcTeamRole, type CpcTeamRole } from '@/lib/cpcRoles';
import { supportRequestTypeToAgendaCategory, type SupportRequestType } from '@/lib/supportRequests';

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

/** Perfis CPC que podem ser atribuídos como especialista em pedidos urgentes. */
const SUPPORT_APPROVAL_FALLBACK_ROLES: readonly CpcTeamRole[] = ['consultant', 'coordinator', 'manager'];

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

function querySpecialistsByRoles(allowedRoles: Set<string>): Promise<CpcSpecialistOption[]> {
  return queryDocuments<UserDoc>('users', []).then((users) =>
    (users ?? [])
      .filter((user) => user.active !== false)
      .map((user) => {
        const role = normalizeCpcTeamRole(user.role);
        if (!role || !allowedRoles.has(role)) return null;
        const name = (user.name?.trim() || user.email?.trim() || '').toString();
        if (!name) return null;
        return { id: user.id, name, role };
      })
      .filter((row): row is CpcSpecialistOption => row !== null)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  );
}

export async function loadCpcTeamSpecialists(category: Exclude<AgendaCategory, 'collective'>): Promise<CpcSpecialistOption[]> {
  const allowedRoles = new Set<string>(CATEGORY_TEAM_ROLES[category]);
  return querySpecialistsByRoles(allowedRoles);
}

/** Especialistas para aprovação de pedido urgente (área + consultores/coordenadores/gestores). */
export async function loadCpcTeamSpecialistsForSupport(
  category: Exclude<AgendaCategory, 'collective'>
): Promise<CpcSpecialistOption[]> {
  const allowedRoles = new Set<string>([...CATEGORY_TEAM_ROLES[category], ...SUPPORT_APPROVAL_FALLBACK_ROLES]);
  return querySpecialistsByRoles(allowedRoles);
}

export async function loadSpecialistsForSupportRequestType(type: SupportRequestType): Promise<CpcSpecialistOption[]> {
  return loadCpcTeamSpecialistsForSupport(supportRequestTypeToAgendaCategory(type));
}
