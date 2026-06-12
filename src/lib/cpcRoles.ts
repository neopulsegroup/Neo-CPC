export const CPC_TEAM_ROLES = [
  'admin',
  'manager',
  'consultant',
  'coordinator',
  'mediator',
  'lawyer',
  'psychologist',
  'trainer',
] as const;

export type CpcTeamRole = (typeof CPC_TEAM_ROLES)[number];

/** Perfis com atribuições de gestão (admin, gestor, consultor, coordenador). */
export const CPC_MANAGEMENT_ROLES = ['admin', 'manager', 'consultant', 'coordinator'] as const;

export type CpcManagementRole = (typeof CPC_MANAGEMENT_ROLES)[number];

export function isCpcTeamRole(value: string | null | undefined): value is CpcTeamRole {
  return typeof value === 'string' && (CPC_TEAM_ROLES as readonly string[]).includes(value);
}

export function isCpcManagementRole(value: string | null | undefined): value is CpcManagementRole {
  return typeof value === 'string' && (CPC_MANAGEMENT_ROLES as readonly string[]).includes(value);
}

const CPC_ROLE_ALIASES: Record<string, CpcTeamRole> = {
  administrador: 'admin',
  gestor: 'manager',
  consultor: 'consultant',
  coordenador: 'coordinator',
  mediador: 'mediator',
  jurista: 'lawyer',
  psicologo: 'psychologist',
  psicologa: 'psychologist',
  formador: 'trainer',
};

export function normalizeCpcTeamRole(value: string | null | undefined): CpcTeamRole | null {
  if (!value) return null;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (isCpcTeamRole(normalized)) return normalized;
  return CPC_ROLE_ALIASES[normalized] ?? null;
}
