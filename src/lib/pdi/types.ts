import type { ScasDomain } from '@/lib/scas/constants';

export type PdiStatus =
  | 'DRAFT_GENERATED'
  | 'IN_REVIEW'
  | 'VALIDATED'
  | 'ACCEPTED'
  | 'SUPERSEDED';

export type PdiTrailState = 'OBRIGATORIA' | 'RECOMENDADA' | 'OPCIONAL' | 'NAO_INCLUIDA';

export type PdiTrailOrigin = 'AUTO' | 'MANUAL';

export type PdiTrailCompletion = 'NAO_INICIADA' | 'EM_CURSO' | 'CONCLUIDA';

export type PdiApoioType =
  | 'JURIDICO'
  | 'NECESSIDADES_BASICAS'
  | 'PSICOLOGICO'
  | 'SOCIOPROFISSIONAL'
  | 'OUTRO';

export type PdiReviewSection = 'trilhas' | 'apoios' | 'objetivos' | 'declaracao';

export interface PdiTrilhaEntry {
  trail_id: string;
  recommended_state: PdiTrailState;
  origin: PdiTrailOrigin;
  scas_domain?: ScasDomain | null;
  start_date?: string | null;
  end_date?: string | null;
  completion_status: PdiTrailCompletion;
}

export interface PdiApoioEntry {
  type: PdiApoioType;
  /** Nível/opção principal (ex.: NECESSARIO, URGENTE, ACOMPANHAMENTO_REGULAR). */
  level?: string | null;
  /** Opções multi (ex.: habitação, alimentação, saúde). */
  options?: string[];
  notes?: string | null;
}

export interface PdiDoc {
  id: string;
  participant_id: string;
  version: string;
  status: PdiStatus;
  perfil: 'A' | 'B' | null;
  source_t0_assessment_id: string;
  score_d1: number | null;
  score_d2: number | null;
  score_d3: number | null;
  score_d4: number | null;
  score_global: number | null;
  target_global: number | null;
  target_d1: number | null;
  target_d2: number | null;
  target_d3: number | null;
  target_d4: number | null;
  notes?: string | null;
  /** Secções percorridas pelo migrante (aceite). */
  review_sections_viewed?: PdiReviewSection[];
  created_by_user_id: string;
  validated_by_user_id?: string | null;
  created_at: string;
  validated_at?: string | null;
  sent_at?: string | null;
  accepted_at?: string | null;
  supersedes_pdi_id?: string | null;
  is_locked: boolean;
  trilhas: PdiTrilhaEntry[];
  apoios: PdiApoioEntry[];
  pdf_url?: string | null;
}

export interface PdiAcceptanceDoc {
  id: string;
  pdi_id: string;
  pdi_version: string;
  participant_id: string;
  accepted_at: string;
  ip?: string | null;
  user_agent?: string | null;
  pdf_snapshot_ref?: string | null;
}

export interface PdiVersionLogDoc {
  id: string;
  participant_id: string;
  pdi_id: string;
  version: string;
  reason: string;
  technician_user_id: string;
  created_at: string;
}

/** Estados editáveis pela equipa CPC. */
export const PDI_EDITABLE_STATUSES: PdiStatus[] = ['DRAFT_GENERATED', 'IN_REVIEW'];

/** Estados visíveis ao migrante. */
export const PDI_MIGRANT_VISIBLE_STATUSES: PdiStatus[] = ['VALIDATED', 'ACCEPTED'];

export const PDI_REVIEW_SECTIONS: PdiReviewSection[] = [
  'trilhas',
  'apoios',
  'objetivos',
  'declaracao',
];
