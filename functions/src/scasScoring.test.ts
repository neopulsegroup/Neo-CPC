import { describe, expect, it } from 'vitest';

import {
  computeScores,
  isAssessmentComplete,
  SCAS_DOMAIN_ITEMS,
  SCAS_ITEM_IDS,
  type ScasResponseMap,
} from './scasScoring';

function uniform(value: number): ScasResponseMap {
  const map: ScasResponseMap = {};
  for (const id of SCAS_ITEM_IDS) map[id] = value;
  return map;
}

describe('functions scasScoring (espelho de src/lib/scas)', () => {
  it('mapeia exatamente 21 itens em 4 domínios (9/4/4/4)', () => {
    const all = Object.values(SCAS_DOMAIN_ITEMS).flat().sort((a, b) => a - b);
    expect(all).toEqual(SCAS_ITEM_IDS);
    expect(SCAS_DOMAIN_ITEMS.D1).toHaveLength(9);
  });

  it('completo: 4 domínios + global', () => {
    expect(computeScores(uniform(3), null)).toEqual({
      score_d1: 3,
      score_d2: 3,
      score_d3: 3,
      score_d4: 3,
      score_global: 3,
    });
  });

  it('âmbito de domínio só preenche esse domínio', () => {
    const responses: ScasResponseMap = { 5: 4, 9: 4, 15: 4, 19: 4 };
    const scores = computeScores(responses, 'D3');
    expect(scores.score_d3).toBe(4);
    expect(scores.score_global).toBeNull();
  });

  it('global com 2 casas decimais', () => {
    const responses = uniform(3);
    responses[1] = 4; // 64/21 = 3.0476...
    expect(computeScores(responses, null).score_global).toBe(3.05);
  });

  it('completude por âmbito', () => {
    const partial: ScasResponseMap = { 5: 4, 9: 4, 15: 4, 19: 4 };
    expect(isAssessmentComplete(partial, 'D3')).toBe(true);
    expect(isAssessmentComplete(partial, null)).toBe(false);
  });
});
