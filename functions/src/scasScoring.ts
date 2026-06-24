/**
 * SCAS — lógica de score no servidor (autoridade de cálculo).
 *
 * Espelha src/lib/scas/{constants,scoring}.ts. Mantido aqui porque o pacote
 * `functions` é compilado isoladamente (rootDir=src, CommonJS) e não importa
 * de `../src`. Qualquer alteração às regras de cálculo deve ser refletida em
 * ambos os locais. Os números 3,0/3,5/15%/20% são fixos (EMPIS).
 */

export type ScasDomain = 'D1' | 'D2' | 'D3' | 'D4';

export const SCAS_MIN_VALUE = 1;
export const SCAS_MAX_VALUE = 5;
export const SCAS_TOTAL_ITEMS = 21;
export const SCAS_SCORE_DECIMALS = 2;

export const SCAS_DOMAIN_ITEMS: Record<ScasDomain, number[]> = {
  D1: [1, 3, 6, 10, 11, 13, 16, 20, 21],
  D2: [4, 8, 14, 18],
  D3: [5, 9, 15, 19],
  D4: [2, 7, 12, 17],
};

export const SCAS_ITEM_IDS: number[] = Array.from(
  { length: SCAS_TOTAL_ITEMS },
  (_, index) => index + 1
);

export type ScasResponseMap = Record<number, number>;

export interface ScasScores {
  score_d1: number | null;
  score_d2: number | null;
  score_d3: number | null;
  score_d4: number | null;
  score_global: number | null;
}

const ROUND_FACTOR = 10 ** SCAS_SCORE_DECIMALS;

export function roundScore(value: number): number {
  return Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;
}

export function isValidResponseValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= SCAS_MIN_VALUE &&
    value <= SCAS_MAX_VALUE
  );
}

export function itemsForScope(domainScope: ScasDomain | null): number[] {
  return domainScope ? [...SCAS_DOMAIN_ITEMS[domainScope]] : [...SCAS_ITEM_IDS];
}

export function isAssessmentComplete(
  responses: ScasResponseMap,
  domainScope: ScasDomain | null
): boolean {
  return itemsForScope(domainScope).every((itemId) =>
    isValidResponseValue(responses[itemId])
  );
}

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

export function computeGlobalScore(responses: ScasResponseMap): number | null {
  let sum = 0;
  for (const itemId of SCAS_ITEM_IDS) {
    const value = responses[itemId];
    if (!isValidResponseValue(value)) return null;
    sum += value;
  }
  return roundScore(sum / SCAS_TOTAL_ITEMS);
}

export function computeScores(
  responses: ScasResponseMap,
  domainScope: ScasDomain | null
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
