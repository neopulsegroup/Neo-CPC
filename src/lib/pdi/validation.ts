import { PDI_REVIEW_SECTIONS, type PdiDoc, type PdiReviewSection } from './types';
import { includedTrilhas } from './generation';

export function canTransitionPdiStatus(from: PdiDoc['status'], to: PdiDoc['status']): boolean {
  if (from === 'DRAFT_GENERATED' && to === 'IN_REVIEW') return true;
  if (from === 'IN_REVIEW' && to === 'VALIDATED') return true;
  if (from === 'VALIDATED' && to === 'ACCEPTED') return true;
  if (to === 'SUPERSEDED') return from !== 'SUPERSEDED';
  return false;
}

export function isPdiEditable(doc: PdiDoc): boolean {
  return !doc.is_locked && (doc.status === 'DRAFT_GENERATED' || doc.status === 'IN_REVIEW');
}

export function isPdiLocked(doc: PdiDoc): boolean {
  return doc.is_locked || doc.status === 'ACCEPTED' || doc.status === 'SUPERSEDED';
}

export function hasActiveEditablePdi(docs: PdiDoc[]): PdiDoc | null {
  return (
    docs.find(
      (d) =>
        d.status === 'DRAFT_GENERATED' ||
        d.status === 'IN_REVIEW' ||
        d.status === 'VALIDATED'
    ) ?? null
  );
}

export function migrantVisiblePdi(docs: PdiDoc[]): PdiDoc | null {
  const visible = docs.filter((d) => d.status === 'VALIDATED' || d.status === 'ACCEPTED');
  return visible.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0] ?? null;
}

export function allReviewSectionsViewed(viewed: PdiReviewSection[] | undefined): boolean {
  const set = new Set(viewed ?? []);
  return PDI_REVIEW_SECTIONS.every((s) => set.has(s));
}

export function validatePdiForSend(doc: PdiDoc): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!doc.participant_id) errors.push('pdi.validation.participant');
  if (!doc.source_t0_assessment_id) errors.push('pdi.validation.t0');
  if (doc.score_global == null) errors.push('pdi.validation.scores');
  if (doc.target_global == null) errors.push('pdi.validation.targets');
  const included = includedTrilhas(doc.trilhas);
  if (included.length === 0) errors.push('pdi.validation.trilhas');
  return { ok: errors.length === 0, errors };
}

export function canAcceptPdi(doc: PdiDoc, viewedSections: PdiReviewSection[]): boolean {
  return doc.status === 'VALIDATED' && allReviewSectionsViewed(viewedSections);
}
