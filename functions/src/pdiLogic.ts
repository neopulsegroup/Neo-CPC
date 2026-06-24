/**
 * PDI — lógica de geração no servidor (espelho de src/lib/pdi/generation.ts).
 */

import { roundScore } from './scasScoring';

export type ScasDomain = 'D1' | 'D2' | 'D3' | 'D4';
export type ScasTrailRecommendation = 'obrigatoria' | 'recomendada' | 'opcional';

export type PdiTrailState = 'OBRIGATORIA' | 'RECOMENDADA' | 'OPCIONAL' | 'NAO_INCLUIDA';
export type PdiApoioType =
  | 'JURIDICO'
  | 'NECESSIDADES_BASICAS'
  | 'PSICOLOGICO'
  | 'SOCIOPROFISSIONAL'
  | 'OUTRO';

export const SCAS_RECOMMENDATION_MANDATORY_BELOW = 3.0;
export const SCAS_RECOMMENDATION_RECOMMENDED_MAX = 3.5;
export const SCAS_META_TARGET_PERCENT = 20;
export const PDI_DOMAIN_TARGET_MIN = 3.0;

export interface PdiTrilhaEntry {
  trail_id: string;
  recommended_state: PdiTrailState;
  origin: 'AUTO' | 'MANUAL';
  scas_domain?: ScasDomain | null;
  start_date?: string | null;
  end_date?: string | null;
  completion_status: 'NAO_INICIADA' | 'EM_CURSO' | 'CONCLUIDA';
}

export interface PdiApoioEntry {
  type: PdiApoioType;
  level?: string | null;
  options?: string[];
  notes?: string | null;
}

export function recommendTrail(domainScore: number): ScasTrailRecommendation {
  if (domainScore < SCAS_RECOMMENDATION_MANDATORY_BELOW) return 'obrigatoria';
  if (domainScore <= SCAS_RECOMMENDATION_RECOMMENDED_MAX) return 'recomendada';
  return 'opcional';
}

export function mapRecommendationToPdiState(recommendation: ScasTrailRecommendation): PdiTrailState {
  if (recommendation === 'obrigatoria') return 'OBRIGATORIA';
  if (recommendation === 'recomendada') return 'RECOMENDADA';
  return 'OPCIONAL';
}

export function computeTargetGlobal(scoreGlobal: number): number {
  return roundScore(scoreGlobal * (1 + SCAS_META_TARGET_PERCENT / 100));
}

export function computeTargetForDomain(domainScore: number | null): number | null {
  if (domainScore == null) return null;
  if (domainScore < PDI_DOMAIN_TARGET_MIN) return PDI_DOMAIN_TARGET_MIN;
  return roundScore(Math.min(5, domainScore + 0.5));
}

export function generateAutoTrilhas(
  scores: {
    score_d1: number | null;
    score_d2: number | null;
    score_d3: number | null;
    score_d4: number | null;
  },
  trails: Array<{ id: string; scas_domain?: ScasDomain | null }>
): PdiTrilhaEntry[] {
  const byDomain: Record<ScasDomain, ScasTrailRecommendation | null> = {
    D1: scores.score_d1 != null ? recommendTrail(scores.score_d1) : null,
    D2: scores.score_d2 != null ? recommendTrail(scores.score_d2) : null,
    D3: scores.score_d3 != null ? recommendTrail(scores.score_d3) : null,
    D4: scores.score_d4 != null ? recommendTrail(scores.score_d4) : null,
  };

  const result: PdiTrilhaEntry[] = [];
  for (const trail of trails) {
    if (!trail.scas_domain) continue;
    const domain = trail.scas_domain;
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

export function generateApoiosFromTriage(urgencies: string[] | null | undefined): PdiApoioEntry[] {
  const set = new Set((urgencies ?? []).map((u) => u.toLowerCase()));
  const apoios: PdiApoioEntry[] = [];

  if (set.has('legal_info') || set.has('visa_info')) {
    apoios.push({
      type: 'JURIDICO',
      level: set.has('visa_info') ? 'URGENTE' : 'NECESSARIO',
      options: [],
      notes: null,
    });
  }

  const basicOptions: string[] = [];
  if (set.has('housing')) basicOptions.push('HABITACAO');
  if (set.has('food')) basicOptions.push('ALIMENTACAO');
  if (set.has('health')) basicOptions.push('SAUDE');
  if (basicOptions.length > 0) {
    apoios.push({ type: 'NECESSIDADES_BASICAS', level: 'NECESSARIO', options: basicOptions, notes: null });
  }

  if (set.has('psychological') || set.has('emotional_support')) {
    apoios.push({ type: 'PSICOLOGICO', level: 'ACOMPANHAMENTO_REGULAR', options: [], notes: null });
  }

  if (set.has('employment') || set.has('job_support')) {
    apoios.push({ type: 'SOCIOPROFISSIONAL', level: 'NECESSARIO', options: ['ORIENTACAO'], notes: null });
  }

  return apoios;
}

export function bumpVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)$/);
  if (!match) return '1.0';
  return `${Number(match[1])}.${Number(match[2]) + 1}`;
}

export function includedTrilhas(trilhas: PdiTrilhaEntry[]): PdiTrilhaEntry[] {
  return trilhas.filter((t) => t.recommended_state !== 'NAO_INCLUIDA');
}

export const PDI_REVIEW_SECTIONS = ['trilhas', 'apoios', 'objetivos', 'declaracao'];

export function allReviewSectionsViewed(viewed: string[] | undefined): boolean {
  const set = new Set(viewed ?? []);
  return PDI_REVIEW_SECTIONS.every((s) => set.has(s));
}

export function validatePdiForSend(doc: {
  participant_id?: string;
  source_t0_assessment_id?: string;
  score_global?: number | null;
  target_global?: number | null;
  trilhas?: PdiTrilhaEntry[];
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!doc.participant_id) errors.push('participant');
  if (!doc.source_t0_assessment_id) errors.push('t0');
  if (doc.score_global == null) errors.push('scores');
  if (doc.target_global == null) errors.push('targets');
  if (includedTrilhas(doc.trilhas ?? []).length === 0) errors.push('trilhas');
  return { ok: errors.length === 0, errors };
}
