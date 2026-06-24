/**
 * SCAS — cálculo de scores, validação de completude, recomendação de
 * trilhas e cálculo de melhoria/metas. Camada pura e testável: não depende
 * de Firestore nem de React. O servidor é a fonte de verdade do score
 * (calculado na submissão); aqui ficam as regras reutilizáveis.
 */

import {
  SCAS_DOMAIN_ITEMS,
  SCAS_DOMAINS,
  SCAS_INTERNAL_ALERT_PERCENT,
  SCAS_ITEM_IDS,
  SCAS_MAX_VALUE,
  SCAS_META_TARGET_PERCENT,
  SCAS_MIN_VALUE,
  SCAS_RECOMMENDATION_MANDATORY_BELOW,
  SCAS_RECOMMENDATION_RECOMMENDED_MAX,
  SCAS_SCORE_DECIMALS,
  SCAS_TOTAL_ITEMS,
  type ScasDomain,
  type ScasTrailRecommendation,
} from './constants';

/** Respostas indexadas por id de item (1..21) → valor 1..5. */
export type ScasResponseMap = Record<number, number>;

/** Scores guardados numa sessão (nullable conforme o âmbito). */
export interface ScasScores {
  score_d1: number | null;
  score_d2: number | null;
  score_d3: number | null;
  score_d4: number | null;
  score_global: number | null;
}

/** Resultado do cálculo de melhoria T0 → momento posterior. */
export interface ScasImprovement {
  /** Variação percentual arredondada a 2 casas. */
  variationPercent: number;
  /** Variação ≥ 20%. */
  meta_atingida: boolean;
  /** Variação ≥ 15% e < 20% (margem de segurança da equipa). */
  alarme_interno: boolean;
}

const ROUND_FACTOR = 10 ** SCAS_SCORE_DECIMALS;

/** Arredonda um score a SCAS_SCORE_DECIMALS casas decimais. */
export function roundScore(value: number): number {
  return Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;
}

/** Valida que o valor de um item é inteiro dentro de [1, 5]. */
export function isValidResponseValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= SCAS_MIN_VALUE &&
    value <= SCAS_MAX_VALUE
  );
}

/** Constrói um ScasResponseMap a partir de uma lista (formato Firestore). */
export function toResponseMap(
  responses: Array<{ item_id: number; value: number }>
): ScasResponseMap {
  const map: ScasResponseMap = {};
  for (const response of responses) {
    map[response.item_id] = response.value;
  }
  return map;
}

/** Itens aplicáveis a um âmbito: domínio único (T_TRILHA) ou os 21 (T0/T_PDI). */
export function itemsForScope(domainScope: ScasDomain | null): number[] {
  return domainScope ? [...SCAS_DOMAIN_ITEMS[domainScope]] : [...SCAS_ITEM_IDS];
}

/** True se todos os itens aplicáveis ao âmbito têm resposta válida. */
export function isAssessmentComplete(
  responses: ScasResponseMap,
  domainScope: ScasDomain | null
): boolean {
  return itemsForScope(domainScope).every((itemId) =>
    isValidResponseValue(responses[itemId])
  );
}

/** Itens aplicáveis ao âmbito que ainda não têm resposta válida. */
export function missingItemsForScope(
  responses: ScasResponseMap,
  domainScope: ScasDomain | null
): number[] {
  return itemsForScope(domainScope).filter(
    (itemId) => !isValidResponseValue(responses[itemId])
  );
}

/**
 * Score por domínio = média das respostas dos itens do domínio.
 * Devolve null se algum item do domínio não estiver respondido.
 */
export function computeDomainScore(
  responses: ScasResponseMap,
  domain: ScasDomain
): number | null {
  const items = SCAS_DOMAIN_ITEMS[domain];
  let sum = 0;
  for (const itemId of items) {
    const value = responses[itemId];
    if (!isValidResponseValue(value)) return null;
    sum += value;
  }
  return roundScore(sum / items.length);
}

/**
 * Score global = média dos 21 itens. Devolve null se faltar algum dos 21.
 */
export function computeGlobalScore(responses: ScasResponseMap): number | null {
  let sum = 0;
  for (const itemId of SCAS_ITEM_IDS) {
    const value = responses[itemId];
    if (!isValidResponseValue(value)) return null;
    sum += value;
  }
  return roundScore(sum / SCAS_TOTAL_ITEMS);
}

/**
 * Calcula os scores a guardar numa sessão.
 * - Âmbito de domínio (T_TRILHA): só o score desse domínio; global = null.
 * - Âmbito completo (T0/T_PDI/T_ADICIONAL): 4 domínios + global.
 */
export function computeScores(
  responses: ScasResponseMap,
  domainScope: ScasDomain | null = null
): ScasScores {
  const empty: ScasScores = {
    score_d1: null,
    score_d2: null,
    score_d3: null,
    score_d4: null,
    score_global: null,
  };

  if (domainScope) {
    return {
      ...empty,
      [`score_${domainScope.toLowerCase()}` as keyof ScasScores]: computeDomainScore(
        responses,
        domainScope
      ),
    };
  }

  return {
    score_d1: computeDomainScore(responses, 'D1'),
    score_d2: computeDomainScore(responses, 'D2'),
    score_d3: computeDomainScore(responses, 'D3'),
    score_d4: computeDomainScore(responses, 'D4'),
    score_global: computeGlobalScore(responses),
  };
}

/** Recomendação de trilha a partir do score T0 do domínio (prompt 4.4). */
export function recommendTrail(domainScore: number): ScasTrailRecommendation {
  if (domainScore < SCAS_RECOMMENDATION_MANDATORY_BELOW) return 'obrigatoria';
  if (domainScore <= SCAS_RECOMMENDATION_RECOMMENDED_MAX) return 'recomendada';
  return 'opcional';
}

/** Recomendação por domínio a partir dos scores T0. */
export function recommendTrailsByDomain(
  scores: Pick<ScasScores, 'score_d1' | 'score_d2' | 'score_d3' | 'score_d4'>
): Record<ScasDomain, ScasTrailRecommendation | null> {
  const result = {} as Record<ScasDomain, ScasTrailRecommendation | null>;
  for (const domain of SCAS_DOMAINS) {
    const score = scores[`score_${domain.toLowerCase()}` as keyof typeof scores];
    result[domain] = typeof score === 'number' ? recommendTrail(score) : null;
  }
  return result;
}

/** Score global alvo para atingir a meta de 20% (apenas indicativo na UI). */
export function computeMetaTargetGlobalScore(t0Global: number): number {
  return roundScore(t0Global * (1 + SCAS_META_TARGET_PERCENT / 100));
}

/**
 * Variação percentual e flags de meta/alarme entre o T0 e um momento posterior.
 * As flags usam a variação não arredondada para evitar erros de fronteira.
 */
export function computeImprovement(
  t0Global: number,
  laterGlobal: number
): ScasImprovement {
  if (!Number.isFinite(t0Global) || t0Global <= 0) {
    return { variationPercent: 0, meta_atingida: false, alarme_interno: false };
  }
  // Arredonda antes de comparar para evitar erros de fronteira de vírgula
  // flutuante (ex.: 0,3/2 → 14,999…%) e manter o comportamento previsível.
  const variationPercent = roundScore(((laterGlobal - t0Global) / t0Global) * 100);
  return {
    variationPercent,
    meta_atingida: variationPercent >= SCAS_META_TARGET_PERCENT,
    alarme_interno:
      variationPercent >= SCAS_INTERNAL_ALERT_PERCENT &&
      variationPercent < SCAS_META_TARGET_PERCENT,
  };
}
