import { describe, expect, it } from 'vitest';

import {
  SCAS_DOMAIN_ITEMS,
  SCAS_ITEM_DOMAIN,
  SCAS_ITEM_IDS,
} from './constants';
import {
  computeDomainScore,
  computeGlobalScore,
  computeImprovement,
  computeMetaTargetGlobalScore,
  computeScores,
  isAssessmentComplete,
  isValidResponseValue,
  missingItemsForScope,
  recommendTrail,
  recommendTrailsByDomain,
  toResponseMap,
  type ScasResponseMap,
} from './scoring';

/** Helper: preenche todos os 21 itens com o mesmo valor. */
function uniformResponses(value: number): ScasResponseMap {
  const map: ScasResponseMap = {};
  for (const id of SCAS_ITEM_IDS) map[id] = value;
  return map;
}

describe('mapeamento de domínios', () => {
  it('cobre exatamente os 21 itens sem sobreposição', () => {
    const all = Object.values(SCAS_DOMAIN_ITEMS).flat().sort((a, b) => a - b);
    expect(all).toEqual(SCAS_ITEM_IDS);
    expect(new Set(all).size).toBe(21);
  });

  it('tem a contagem por domínio correta (9/4/4/4)', () => {
    expect(SCAS_DOMAIN_ITEMS.D1).toHaveLength(9);
    expect(SCAS_DOMAIN_ITEMS.D2).toHaveLength(4);
    expect(SCAS_DOMAIN_ITEMS.D3).toHaveLength(4);
    expect(SCAS_DOMAIN_ITEMS.D4).toHaveLength(4);
  });

  it('índice inverso item→domínio é coerente', () => {
    expect(SCAS_ITEM_DOMAIN[1]).toBe('D1');
    expect(SCAS_ITEM_DOMAIN[4]).toBe('D2');
    expect(SCAS_ITEM_DOMAIN[5]).toBe('D3');
    expect(SCAS_ITEM_DOMAIN[2]).toBe('D4');
  });
});

describe('validação de respostas', () => {
  it('aceita apenas inteiros entre 1 e 5', () => {
    expect(isValidResponseValue(1)).toBe(true);
    expect(isValidResponseValue(5)).toBe(true);
    expect(isValidResponseValue(0)).toBe(false);
    expect(isValidResponseValue(6)).toBe(false);
    expect(isValidResponseValue(3.5)).toBe(false);
    expect(isValidResponseValue('3')).toBe(false);
    expect(isValidResponseValue(undefined)).toBe(false);
  });
});

describe('cálculo de score por domínio e global', () => {
  it('média uniforme devolve o próprio valor', () => {
    const responses = uniformResponses(4);
    expect(computeDomainScore(responses, 'D1')).toBe(4);
    expect(computeGlobalScore(responses)).toBe(4);
  });

  it('calcula a média correta de um domínio (D2 = itens 4,8,14,18)', () => {
    const responses: ScasResponseMap = { 4: 1, 8: 2, 14: 3, 18: 4 };
    // (1+2+3+4)/4 = 2.5
    expect(computeDomainScore(responses, 'D2')).toBe(2.5);
  });

  it('guarda o global com 2 casas decimais', () => {
    const responses = uniformResponses(3);
    responses[1] = 4; // soma 63 -> 64; 64/21 = 3.0476...
    expect(computeGlobalScore(responses)).toBe(3.05);
  });

  it('devolve null quando falta algum item aplicável', () => {
    const responses = uniformResponses(3);
    delete responses[7];
    expect(computeGlobalScore(responses)).toBeNull();
    expect(computeDomainScore(responses, 'D4')).toBeNull();
    expect(computeDomainScore(responses, 'D1')).toBe(3);
  });

  it('computeScores no âmbito de um domínio só preenche esse domínio', () => {
    const responses: ScasResponseMap = { 5: 4, 9: 4, 15: 4, 19: 4 };
    const scores = computeScores(responses, 'D3');
    expect(scores.score_d3).toBe(4);
    expect(scores.score_d1).toBeNull();
    expect(scores.score_global).toBeNull();
  });

  it('computeScores completo preenche 4 domínios + global', () => {
    const scores = computeScores(uniformResponses(3), null);
    expect(scores).toEqual({
      score_d1: 3,
      score_d2: 3,
      score_d3: 3,
      score_d4: 3,
      score_global: 3,
    });
  });
});

describe('completude por âmbito', () => {
  it('T_TRILHA exige só os itens do domínio', () => {
    const responses: ScasResponseMap = { 5: 4, 9: 4, 15: 4, 19: 4 };
    expect(isAssessmentComplete(responses, 'D3')).toBe(true);
    expect(isAssessmentComplete(responses, null)).toBe(false);
    expect(missingItemsForScope(responses, 'D3')).toEqual([]);
  });

  it('T0/T_PDI exigem os 21 itens', () => {
    const responses = uniformResponses(2);
    delete responses[12];
    expect(isAssessmentComplete(responses, null)).toBe(false);
    expect(missingItemsForScope(responses, null)).toEqual([12]);
  });
});

describe('recomendação de trilhas (prompt 4.4)', () => {
  it('< 3,0 → obrigatória', () => {
    expect(recommendTrail(2.9)).toBe('obrigatoria');
    expect(recommendTrail(1.0)).toBe('obrigatoria');
  });

  it('3,0 a 3,5 → recomendada (fronteiras inclusive)', () => {
    expect(recommendTrail(3.0)).toBe('recomendada');
    expect(recommendTrail(3.2)).toBe('recomendada');
    expect(recommendTrail(3.5)).toBe('recomendada');
  });

  it('> 3,5 → opcional', () => {
    expect(recommendTrail(3.8)).toBe('opcional');
    expect(recommendTrail(5.0)).toBe('opcional');
  });

  it('recommendTrailsByDomain mapeia cada domínio', () => {
    const result = recommendTrailsByDomain({
      score_d1: 2.9,
      score_d2: 3.2,
      score_d3: 3.8,
      score_d4: null,
    });
    expect(result).toEqual({
      D1: 'obrigatoria',
      D2: 'recomendada',
      D3: 'opcional',
      D4: null,
    });
  });
});

describe('melhoria e metas (prompt 4.5 / 11)', () => {
  it('exemplo EMPIS: T0=2,53 → T-PDI=3,12 → 23,32% → meta atingida', () => {
    const result = computeImprovement(2.53, 3.12);
    expect(result.variationPercent).toBeCloseTo(23.32, 2);
    expect(result.meta_atingida).toBe(true);
    expect(result.alarme_interno).toBe(false);
  });

  it('score global alvo para a meta de 20% (T0=2,53 → 3,04)', () => {
    expect(computeMetaTargetGlobalScore(2.53)).toBe(3.04);
  });

  it('variação de 17% → alarme interno (15–20%)', () => {
    const result = computeImprovement(3.0, 3.51); // +17%
    expect(result.variationPercent).toBeCloseTo(17, 2);
    expect(result.alarme_interno).toBe(true);
    expect(result.meta_atingida).toBe(false);
  });

  it('variação de 21% → meta atingida', () => {
    const result = computeImprovement(3.0, 3.63); // +21%
    expect(result.variationPercent).toBeCloseTo(21, 2);
    expect(result.meta_atingida).toBe(true);
    expect(result.alarme_interno).toBe(false);
  });

  it('exatamente 15% → alarme; exatamente 20% → meta', () => {
    expect(computeImprovement(2.0, 2.3).alarme_interno).toBe(true); // +15%
    expect(computeImprovement(2.0, 2.4).meta_atingida).toBe(true); // +20%
  });

  it('T0 inválido (0) não rebenta', () => {
    const result = computeImprovement(0, 3);
    expect(result.meta_atingida).toBe(false);
    expect(result.variationPercent).toBe(0);
  });
});

describe('toResponseMap', () => {
  it('converte lista Firestore em mapa indexado', () => {
    const map = toResponseMap([
      { item_id: 1, value: 5 },
      { item_id: 2, value: 3 },
    ]);
    expect(map).toEqual({ 1: 5, 2: 3 });
  });
});
