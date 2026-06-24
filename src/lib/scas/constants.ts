/**
 * SCAS (Sociocultural Adaptation Scale) — constantes e regras fixas.
 *
 * Os valores 3,0 / 3,5 / 15% / 20% são contratualizados com a EMPIS e
 * NÃO devem ser alterados. Centralizados aqui para evitar números mágicos
 * dispersos pela UI/serviços (requisito do prompt, pontos 4 e 12).
 */

export type ScasDomain = 'D1' | 'D2' | 'D3' | 'D4';

export type ScasMomentType = 'T0' | 'T_TRILHA' | 'T_PDI' | 'T_ADICIONAL';

export type ScasMode = 'AUTONOMO' | 'ASSISTIDO';

export type ScasLanguage = 'pt' | 'en' | 'es' | 'fr';

export type ScasTrailRecommendation = 'obrigatoria' | 'recomendada' | 'opcional';

export type ScasAssessmentStatus = 'IN_PROGRESS' | 'SUBMITTED';

/** Escala de resposta por item (inclusive). */
export const SCAS_MIN_VALUE = 1;
export const SCAS_MAX_VALUE = 5;

/** Total de itens do instrumento completo. */
export const SCAS_TOTAL_ITEMS = 21;

export const SCAS_DOMAINS: ScasDomain[] = ['D1', 'D2', 'D3', 'D4'];

/** Mapeamento item → domínio (prompt 4.2). Soma 9 + 4 + 4 + 4 = 21 itens. */
export const SCAS_DOMAIN_ITEMS: Record<ScasDomain, number[]> = {
  D1: [1, 3, 6, 10, 11, 13, 16, 20, 21],
  D2: [4, 8, 14, 18],
  D3: [5, 9, 15, 19],
  D4: [2, 7, 12, 17],
};

/** Nomes dos domínios (chaves i18n associadas em `scas.domains.*`). */
export const SCAS_DOMAIN_I18N_KEY: Record<ScasDomain, string> = {
  D1: 'scas.domains.D1',
  D2: 'scas.domains.D2',
  D3: 'scas.domains.D3',
  D4: 'scas.domains.D4',
};

/** Lista ordenada de ids de item (1..21). */
export const SCAS_ITEM_IDS: number[] = Array.from(
  { length: SCAS_TOTAL_ITEMS },
  (_, index) => index + 1
);

/** Índice inverso item → domínio, derivado de SCAS_DOMAIN_ITEMS. */
export const SCAS_ITEM_DOMAIN: Record<number, ScasDomain> = (() => {
  const map: Record<number, ScasDomain> = {};
  for (const domain of SCAS_DOMAINS) {
    for (const itemId of SCAS_DOMAIN_ITEMS[domain]) {
      map[itemId] = domain;
    }
  }
  return map;
})();

/** Faixas de recomendação de trilha a partir do score T0 por domínio (prompt 4.4). */
export const SCAS_RECOMMENDATION_MANDATORY_BELOW = 3.0;
export const SCAS_RECOMMENDATION_RECOMMENDED_MAX = 3.5;

/** Metas de melhoria T0 → T-PDI (prompt 4.5). */
export const SCAS_META_TARGET_PERCENT = 20;
export const SCAS_INTERNAL_ALERT_PERCENT = 15;

/** Casas decimais mínimas a guardar nos scores. */
export const SCAS_SCORE_DECIMALS = 2;
