import {
  SCAS_META_TARGET_PERCENT,
  SCAS_INTERNAL_ALERT_PERCENT,
  SCAS_RECOMMENDATION_MANDATORY_BELOW,
  SCAS_RECOMMENDATION_RECOMMENDED_MAX,
} from '@/lib/scas/constants';

import type { PdiTrailState } from './types';

/** Multiplicador para meta global EMPIS (20%). */
export const PDI_TARGET_GLOBAL_MULTIPLIER = 1 + SCAS_META_TARGET_PERCENT / 100;

/** Multiplicador para alarme interno (15%). */
export const PDI_ALERT_GLOBAL_MULTIPLIER = 1 + SCAS_INTERNAL_ALERT_PERCENT / 100;

/** Score mínimo alvo por domínio quando T0 < 3,0. */
export const PDI_DOMAIN_TARGET_MIN = 3.0;

export const PDI_TRAIL_STATE_OPTIONS: PdiTrailState[] = [
  'OBRIGATORIA',
  'RECOMENDADA',
  'OPCIONAL',
  'NAO_INCLUIDA',
];

export { SCAS_RECOMMENDATION_MANDATORY_BELOW, SCAS_RECOMMENDATION_RECOMMENDED_MAX };
