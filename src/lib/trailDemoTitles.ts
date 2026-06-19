/** Títulos das trilhas criadas pelo antigo seed de demonstração (CPC e migrante). */
export const DEMO_TRAIL_TITLES = [
  'Situação Legal',
  'Teste - Testar',
  'Direitos Laborais em Portugal',
  'Cultura e Costumes Portugueses',
  'Sistema de Saúde em Portugal',
  'Preparação para o Trabalho',
  'Finanças do Dia a Dia',
  'Habitação e Arrendamento',
  'Contratos e Recibos: o Essencial',
  'Comunicação no Dia a Dia',
  'Saúde Mental e Bem-estar',
  'Entrevistas e Integração na Equipa',
] as const;

export function isDemoTrailTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return DEMO_TRAIL_TITLES.some((demoTitle) => demoTitle.toLowerCase() === normalized);
}

export function isDemoTrail(trail: { id?: string; title: string }): boolean {
  if (trail.id?.startsWith('demo-trail-')) return true;
  return isDemoTrailTitle(trail.title);
}

export function filterNonDemoTrails<T extends { id?: string; title: string }>(trails: T[]): T[] {
  return trails.filter((trail) => !isDemoTrail(trail));
}
