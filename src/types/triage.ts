/**
 * Estrutura real das respostas da Situação Inicial (antiga Triagem).
 *
 * Fonte: campos denormalizados gravados em `triage/{uid}` por `saveTriage`
 * (ver src/pages/Triage.tsx). Valores em tokens em inglês (não traduzidos).
 *
 * Notas:
 * - legal_status / housing_status / work_status só são preenchidos quando
 *   o migrante respondeu is_in_portugal === 'yes' (ramo "em Portugal").
 * - language_level: no ramo "em PT" é a resposta direta; no ramo pré-chegada
 *   é mapeado de portuguese_level (fluent → native).
 * - urgencies: no ramo "em PT" vem de identified_needs; no pré-chegada vem de
 *   desired_support. Por isso o array pode conter tokens de qualquer um dos dois.
 */
export interface TriageResponses {
  /** 'regularized' | 'pending' | 'not_regularized' | 'refugee' */
  legal_status?: string | null;
  /** 'stable' | 'temporary' | 'precarious' | 'homeless' | 'searching' */
  housing_status?: string | null;
  /** 'employed' | 'unemployed_seeking' | 'student' | 'other' */
  work_status?: string | null;
  /** 'none' | 'basic' | 'intermediate' | 'advanced' | 'native' */
  language_level?: string | null;
  /**
   * Necessidades/apoios sinalizados pelo migrante.
   * Tokens possíveis (em PT): housing, food, health, employment, legal_info, psychological, other
   * Tokens possíveis (pré-chegada): visa_info, cost_of_living, regions_info, job_support,
   *   housing_suggestions, emotional_support, cultural_training, language_training
   */
  urgencies?: string[] | null;
  interests?: string[] | null;
}
