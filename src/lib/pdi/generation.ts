import {
  recommendTrail,
  roundScore,
  type ScasDomain,
  type ScasTrailRecommendation,
} from '@/lib/scas';

import {
  PDI_ALERT_GLOBAL_MULTIPLIER,
  PDI_DOMAIN_TARGET_MIN,
  PDI_TARGET_GLOBAL_MULTIPLIER,
} from './constants';
import type { PdiApoioEntry, PdiApoioType, PdiTrailState, PdiTrilhaEntry } from './types';

export interface TrailCatalogRow {
  id: string;
  title?: string | null;
  scas_domain?: ScasDomain | null;
  is_active?: boolean;
}

export interface TriageUrgencyHints {
  urgencies?: string[] | null;
  legal_status?: string | null;
}

export interface T0Scores {
  score_d1: number | null;
  score_d2: number | null;
  score_d3: number | null;
  score_d4: number | null;
  score_global: number | null;
}

export function mapRecommendationToPdiState(
  recommendation: ScasTrailRecommendation
): PdiTrailState {
  if (recommendation === 'obrigatoria') return 'OBRIGATORIA';
  if (recommendation === 'recomendada') return 'RECOMENDADA';
  return 'OPCIONAL';
}

export function computeTargetGlobal(scoreGlobal: number): number {
  return roundScore(scoreGlobal * PDI_TARGET_GLOBAL_MULTIPLIER);
}

export function computeAlertGlobal(scoreGlobal: number): number {
  return roundScore(scoreGlobal * PDI_ALERT_GLOBAL_MULTIPLIER);
}

export function computeTargetForDomain(domainScore: number | null): number | null {
  if (domainScore == null) return null;
  if (domainScore < PDI_DOMAIN_TARGET_MIN) return PDI_DOMAIN_TARGET_MIN;
  return roundScore(Math.min(5, domainScore + 0.5));
}

/** Gera trilhas AUTO a partir dos scores T0 e catálogo com `scas_domain`. */
export function generateAutoTrilhas(
  scores: T0Scores,
  trails: TrailCatalogRow[]
): PdiTrilhaEntry[] {
  const byDomain: Record<ScasDomain, ScasTrailRecommendation | null> = {
    D1:
      scores.score_d1 != null
        ? recommendTrail(scores.score_d1)
        : null,
    D2:
      scores.score_d2 != null
        ? recommendTrail(scores.score_d2)
        : null,
    D3:
      scores.score_d3 != null
        ? recommendTrail(scores.score_d3)
        : null,
    D4:
      scores.score_d4 != null
        ? recommendTrail(scores.score_d4)
        : null,
  };

  const result: PdiTrilhaEntry[] = [];
  for (const trail of trails) {
    if (!trail.scas_domain) continue;
    const domain = trail.scas_domain as ScasDomain;
    const recommendation = byDomain[domain];
    if (!recommendation) continue;
    result.push({
      trail_id: trail.id,
      recommended_state: mapRecommendationToPdiState(recommendation),
      origin: 'AUTO',
      scas_domain: domain,
      start_date: null,
      end_date: null,
      completion_status: 'NAO_INICIADA',
    });
  }
  return result;
}

/** Pré-marca apoios a partir de urgências da triagem. */
export function generateApoiosFromTriage(triage: TriageUrgencyHints): PdiApoioEntry[] {
  const urgencies = new Set((triage.urgencies ?? []).map((u) => u.toLowerCase()));
  const apoios: PdiApoioEntry[] = [];

  const legalTokens = ['legal_info', 'visa_info', 'juridico', 'legal'];
  if (urgencies.has('legal_info') || urgencies.has('visa_info') || legalTokens.some((t) => urgencies.has(t))) {
    apoios.push({
      type: 'JURIDICO',
      level: urgencies.has('visa_info') ? 'URGENTE' : 'NECESSARIO',
      options: [],
      notes: null,
    });
  }

  const basicOptions: string[] = [];
  if (urgencies.has('housing')) basicOptions.push('HABITACAO');
  if (urgencies.has('food')) basicOptions.push('ALIMENTACAO');
  if (urgencies.has('health')) basicOptions.push('SAUDE');
  if (basicOptions.length > 0) {
    apoios.push({ type: 'NECESSIDADES_BASICAS', level: 'NECESSARIO', options: basicOptions, notes: null });
  }

  if (urgencies.has('psychological') || urgencies.has('emotional_support')) {
    apoios.push({
      type: 'PSICOLOGICO',
      level: 'ACOMPANHAMENTO_REGULAR',
      options: [],
      notes: null,
    });
  }

  const socioOptions: string[] = [];
  if (urgencies.has('employment') || urgencies.has('job_support')) socioOptions.push('ORIENTACAO');
  if (socioOptions.length > 0) {
    apoios.push({ type: 'SOCIOPROFISSIONAL', level: 'NECESSARIO', options: socioOptions, notes: null });
  }

  return apoios;
}

export function bumpVersion(version: string, majorBump = false): string {
  const match = version.match(/^v?(\d+)\.(\d+)$/);
  if (!match) return '1.0';
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (majorBump) return `${major + 1}.0`;
  return `${major}.${minor + 1}`;
}

export function formatPdiVersion(major: number, minor: number): string {
  return `${major}.${minor}`;
}

/** Trilhas incluídas no plano (não NAO_INCLUIDA). */
export function includedTrilhas(trilhas: PdiTrilhaEntry[]): PdiTrilhaEntry[] {
  return trilhas.filter((t) => t.recommended_state !== 'NAO_INCLUIDA');
}

export function apoioTypeLabel(type: PdiApoioType): string {
  return `pdi.apoios.${type}`;
}

/** Lista completa do catálogo para edição CPC (trilhas sem entrada ficam NAO_INCLUIDA). */
export function buildEditableTrilhasList(
  catalog: TrailCatalogRow[],
  current: PdiTrilhaEntry[]
): PdiTrilhaEntry[] {
  const byId = new Map(current.map((t) => [t.trail_id, t]));
  return catalog
    .filter((t) => t.is_active !== false)
    .map((trail) => {
      const existing = byId.get(trail.id);
      if (existing) {
        return {
          ...existing,
          scas_domain: existing.scas_domain ?? trail.scas_domain ?? null,
        };
      }
      return {
        trail_id: trail.id,
        recommended_state: 'NAO_INCLUIDA',
        origin: 'MANUAL',
        scas_domain: trail.scas_domain ?? null,
        start_date: null,
        end_date: null,
        completion_status: 'NAO_INICIADA',
      };
    });
}

/** Atualiza trilhas persistidas: remove se NAO_INCLUIDA, adiciona ou altera caso contrário. */
export function setTrailStateInPdiTrilhas(
  current: PdiTrilhaEntry[],
  trailId: string,
  state: PdiTrailState,
  catalogTrail?: TrailCatalogRow | null
): PdiTrilhaEntry[] {
  if (state === 'NAO_INCLUIDA') {
    return current.filter((t) => t.trail_id !== trailId);
  }
  const existing = current.find((t) => t.trail_id === trailId);
  if (existing) {
    return current.map((t) =>
      t.trail_id === trailId ? { ...t, recommended_state: state, origin: 'MANUAL' } : t
    );
  }
  return [
    ...current,
    {
      trail_id: trailId,
      recommended_state: state,
      origin: 'MANUAL',
      scas_domain: catalogTrail?.scas_domain ?? null,
      start_date: null,
      end_date: null,
      completion_status: 'NAO_INICIADA',
    },
  ];
}

export function sortTrailCatalogRows<T extends TrailCatalogRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id, 'pt'));
}
