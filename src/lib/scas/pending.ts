/**
 * SCAS — resolução do momento pendente (disparo) para um participante.
 *
 * Regras (prompt 4.6 / 6.1):
 * - T0: após triagem concluída, uma única vez.
 * - T_TRILHA: ao concluir uma trilha do PDI que tenha domínio mapeado,
 *   uma vez por trilha. Trilhas sem domínio mapeado não disparam (edge 9).
 * - T_PDI: quando todas as trilhas do PDI estão concluídas, uma vez.
 * - Se a meta já foi atingida, não obriga a mais preenchimentos.
 *
 * Camada pura e testável. O servidor revalida a elegibilidade na submissão.
 */

import type { ScasDomain, ScasMomentType } from './constants';
import type { ScasTrailRecommendation } from './constants';

export interface ScasAssessmentSummary {
  moment_type: ScasMomentType;
  domain_scope: ScasDomain | null;
  trail_id: string | null;
  status: 'IN_PROGRESS' | 'SUBMITTED';
}

export interface PdiTrailRef {
  trail_id: string;
  scas_domain: ScasDomain | null;
  state: ScasTrailRecommendation;
}

export interface TrailProgressRef {
  trail_id: string;
  completed_at?: string | null;
}

export interface PendingScasMoment {
  moment_type: ScasMomentType;
  domain_scope: ScasDomain | null;
  trail_id: string | null;
}

export function resolvePendingScasMoment(args: {
  triageCompleted: boolean;
  metaReached: boolean;
  assessments: ScasAssessmentSummary[];
  pdiTrails: PdiTrailRef[];
  trailProgress: TrailProgressRef[];
}): PendingScasMoment | null {
  if (!args.triageCompleted || args.metaReached) return null;

  const submitted = args.assessments.filter((a) => a.status === 'SUBMITTED');

  // T0 — base line, obrigatório antes de tudo.
  const hasT0 = submitted.some((a) => a.moment_type === 'T0');
  if (!hasT0) {
    return { moment_type: 'T0', domain_scope: null, trail_id: null };
  }

  const completedTrailIds = new Set(
    args.trailProgress.filter((p) => !!p.completed_at).map((p) => p.trail_id)
  );
  const trailhaDone = new Set(
    submitted
      .filter((a) => a.moment_type === 'T_TRILHA' && a.trail_id)
      .map((a) => a.trail_id as string)
  );

  // T_TRILHA — primeira trilha do PDI concluída (com domínio) ainda sem avaliação.
  for (const trail of args.pdiTrails) {
    if (!trail.scas_domain) continue; // trilha sem domínio mapeado não dispara
    if (completedTrailIds.has(trail.trail_id) && !trailhaDone.has(trail.trail_id)) {
      return {
        moment_type: 'T_TRILHA',
        domain_scope: trail.scas_domain,
        trail_id: trail.trail_id,
      };
    }
  }

  // T_PDI — todas as trilhas do PDI concluídas e sem avaliação final.
  const hasPdiTrails = args.pdiTrails.length > 0;
  const allPdiCompleted =
    hasPdiTrails && args.pdiTrails.every((t) => completedTrailIds.has(t.trail_id));
  const hasTpdi = submitted.some((a) => a.moment_type === 'T_PDI');
  if (allPdiCompleted && !hasTpdi) {
    return { moment_type: 'T_PDI', domain_scope: null, trail_id: null };
  }

  return null;
}
