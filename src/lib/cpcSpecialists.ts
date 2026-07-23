import { getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import type { ServiceArea } from '@/features/serviceAreas/serviceAreas';
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

/**
 * Responsáveis definidos em `service_areas` (áreas-serviço).
 * É a fonte de verdade partilhada com o wizard do migrante.
 */
async function loadSpecialistsFromServiceArea(
  category: Exclude<AgendaCategory, 'collective'>
): Promise<CpcSpecialistOption[]> {
  const serviceId = CATEGORY_SERVICE_ID[category];
  const defaultRole = CATEGORY_TEAM_ROLES[category][0];
  const area = await getDocument<ServiceArea>('service_areas', serviceId).catch(() => null);
  if (!area || area.is_active === false) return [];
  if (!Array.isArray(area.responsible_uids) || area.responsible_uids.length === 0) return [];

  const users = await queryDocuments<UserDoc>('users', []).catch(() => [] as UserDoc[]);
  const byId = new Map((users ?? []).map((user) => [user.id, user]));

  return area.responsible_uids
    .map((uid, index) => {
      const user = byId.get(uid);
      if (user && user.active === false) return null;
      const name = (
        area.responsible_names?.[index]?.trim() ||
        user?.name?.trim() ||
        user?.email?.trim() ||
        ''
      ).toString();
      if (!name) return null;
      const role = normalizeCpcTeamRole(user?.role) ?? defaultRole;
      return { id: uid, name, role };
    })
    .filter((row): row is CpcSpecialistOption => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}

export async function loadCpcTeamSpecialists(category: Exclude<AgendaCategory, 'collective'>): Promise<CpcSpecialistOption[]> {
  const fromArea = await loadSpecialistsFromServiceArea(category);
  if (fromArea.length > 0) return fromArea;
  // Fallback legado: filtrar pela role típica da categoria (quando a área ainda não tem responsáveis).
  return querySpecialistsByRoles(new Set(CATEGORY_TEAM_ROLES[category]));
}

/** Especialistas para aprovação de pedido urgente (área + consultores/coordenadores/gestores). */
export async function loadCpcTeamSpecialistsForSupport(
  category: Exclude<AgendaCategory, 'collective'>
): Promise<CpcSpecialistOption[]> {
  const fromArea = await loadSpecialistsFromServiceArea(category);
  if (fromArea.length > 0) return fromArea;
  const allowedRoles = new Set<string>([...CATEGORY_TEAM_ROLES[category], ...SUPPORT_APPROVAL_FALLBACK_ROLES]);
  return querySpecialistsByRoles(allowedRoles);
}

export async function loadSpecialistsForSupportRequestType(type: SupportRequestType): Promise<CpcSpecialistOption[]> {
  return loadCpcTeamSpecialistsForSupport(supportRequestTypeToAgendaCategory(type));
}
