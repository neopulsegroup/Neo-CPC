import type { TriageResponses } from '@/types/triage';

export type NeedPriority = 'high' | 'medium' | 'low' | 'none';

export type NeedCategory =
  | 'legal'
  | 'housing'
  | 'employment'
  | 'language'
  | 'psychological'
  | 'social';

export interface NeedItem {
  category: NeedCategory;
  priority: NeedPriority;
  reasons: string[];
}

export interface NeedsProfile {
  items: NeedItem[];
  generatedAt: string;
  hasUrgentNeeds: boolean;
}

// Tokens de `urgencies` que sinalizam cada categoria (ramo "em PT" + pré-chegada).
const URGENCY_TOKENS: Record<NeedCategory, string[]> = {
  legal: ['legal_info', 'visa_info'],
  housing: ['housing', 'housing_suggestions'],
  employment: ['employment', 'job_support'],
  language: ['language_training'],
  psychological: ['psychological', 'emotional_support'],
  social: ['food', 'health', 'cost_of_living'],
};

const PRIORITY_RANK: Record<NeedPriority, number> = { high: 3, medium: 2, low: 1, none: 0 };

function hasAnyUrgency(urgencies: string[] | null | undefined, tokens: string[]): boolean {
  if (!urgencies || urgencies.length === 0) return false;
  return urgencies.some((u) => tokens.includes(u));
}

export function inferNeedsProfile(triage: TriageResponses | null | undefined): NeedsProfile {
  const generatedAt = new Date().toISOString();

  if (!triage) {
    return { items: [], generatedAt, hasUrgentNeeds: false };
  }

  const items: NeedItem[] = [];
  const urgencies = triage.urgencies ?? [];

  // --- Jurídico ---
  {
    const reasons: string[] = [];
    let priority: NeedPriority = 'none';
    if (triage.legal_status === 'not_regularized') {
      priority = 'high';
      reasons.push('needs.reason.legal.unregularized');
    }
    if (hasAnyUrgency(urgencies, URGENCY_TOKENS.legal)) {
      priority = 'high';
      reasons.push('needs.reason.legal.urgent_marked');
    }
    if (priority === 'none' && triage.legal_status === 'pending') {
      priority = 'medium';
      reasons.push('needs.reason.legal.in_process');
    }
    if (priority !== 'none') items.push({ category: 'legal', priority, reasons });
  }

  // --- Habitação ---
  {
    const reasons: string[] = [];
    let priority: NeedPriority = 'none';
    if (triage.housing_status === 'homeless') {
      priority = 'high';
      reasons.push('needs.reason.housing.none');
    }
    if (hasAnyUrgency(urgencies, URGENCY_TOKENS.housing)) {
      priority = 'high';
      reasons.push('needs.reason.housing.urgent_marked');
    }
    if (priority === 'none' && (triage.housing_status === 'precarious' || triage.housing_status === 'temporary')) {
      priority = 'medium';
      reasons.push('needs.reason.housing.precarious');
    }
    if (priority !== 'none') items.push({ category: 'housing', priority, reasons });
  }

  // --- Emprego ---
  {
    const reasons: string[] = [];
    let priority: NeedPriority = 'none';
    if (triage.work_status === 'unemployed_seeking') {
      priority = 'high';
      reasons.push('needs.reason.employment.unemployed');
    }
    if (hasAnyUrgency(urgencies, URGENCY_TOKENS.employment)) {
      priority = 'high';
      reasons.push('needs.reason.employment.urgent_marked');
    }
    if (priority !== 'none') items.push({ category: 'employment', priority, reasons });
  }

  // --- Apoio Linguístico ---
  {
    const reasons: string[] = [];
    let priority: NeedPriority = 'none';
    if (triage.language_level === 'none') {
      priority = 'high';
      reasons.push('needs.reason.language.beginner');
    } else if (triage.language_level === 'basic') {
      priority = 'medium';
      reasons.push('needs.reason.language.basic');
    }
    if (priority !== 'high' && hasAnyUrgency(urgencies, URGENCY_TOKENS.language)) {
      priority = 'high';
      reasons.push('needs.reason.language.urgent_marked');
    }
    if (priority !== 'none') items.push({ category: 'language', priority, reasons });
  }

  // --- Apoio Psicológico ---
  if (hasAnyUrgency(urgencies, URGENCY_TOKENS.psychological)) {
    items.push({
      category: 'psychological',
      priority: 'high',
      reasons: ['needs.reason.psychological.urgent_marked'],
    });
  }

  // --- Apoio Social ---
  if (hasAnyUrgency(urgencies, URGENCY_TOKENS.social)) {
    items.push({
      category: 'social',
      priority: 'high',
      reasons: ['needs.reason.social.basic_needs'],
    });
  }

  items.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);

  return {
    items,
    generatedAt,
    hasUrgentNeeds: items.some((i) => i.priority === 'high'),
  };
}
