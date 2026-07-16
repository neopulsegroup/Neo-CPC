import type { MigrantProfileDoc, MigrantSession, MigrantTriageDoc, TrailInfo, TrailProgress } from '@/api/migrantProfile';
import { inferNeedsProfile, type NeedCategory } from '@/features/needs/inferNeedsProfile';

export type SessionRecordDocFields = {
  notes?: string | null;
  notes_urgent?: boolean | null;
  recommended_track?: string | null;
  immediate_next_step?: string | null;
  notes_updated_at?: string | null;
};

export type SessionRecordActivityItem = {
  date: string;
  title: string;
  status?: string;
  meta?: string;
};

export type SessionRecordScreening = {
  p1: string | null;
  primaryChallenge: string | null;
  p2: string | null;
  isEmpty: boolean;
};

export function personInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function shortMigrantId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return '—';
  return `#${trimmed.slice(-6).toUpperCase()}`;
}

export function readSessionRecordFields(doc: SessionRecordDocFields | null | undefined) {
  return {
    notes: typeof doc?.notes === 'string' ? doc.notes : '',
    notesUrgent: Boolean(doc?.notes_urgent),
    recommendedTrack: typeof doc?.recommended_track === 'string' ? doc.recommended_track : '',
    immediateNextStep: typeof doc?.immediate_next_step === 'string' ? doc.immediate_next_step : '',
    notesUpdatedAt: typeof doc?.notes_updated_at === 'string' ? doc.notes_updated_at : null,
  };
}

export function needCategoryBadgeClass(category: NeedCategory): string {
  if (category === 'legal' || category === 'language') return 'bg-blue-50 text-blue-700';
  if (category === 'employment' || category === 'psychological') return 'bg-violet-50 text-violet-700';
  if (category === 'housing') return 'bg-orange-50 text-orange-700';
  return 'bg-cyan-50 text-cyan-700';
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function buildSessionRecordScreening(
  triage: MigrantTriageDoc | null,
  profile: MigrantProfileDoc | null,
  t: TranslateFn,
  formatDate: (value: string) => string
): SessionRecordScreening {
  if (!triage?.completed) {
    return {
      p1: null,
      primaryChallenge: null,
      p2: null,
      isEmpty: true,
    };
  }

  const translateOption = (questionId: string, value: string) => {
    const key = `triage.options.${questionId}.${value}`;
    const label = t.get(key);
    return label === key ? value : label;
  };

  const partsP1: string[] = [];
  const completedAt = triage.completedAt?.trim();
  if (completedAt) {
    const dateLabel = /^\d{4}-\d{2}-\d{2}/.test(completedAt) ? formatDate(completedAt.slice(0, 10)) : completedAt;
    partsP1.push(t.get('cpc.agenda.sessionRecord.screening.completedOn', { date: dateLabel }));
  } else {
    partsP1.push(t.get('cpc.agenda.sessionRecord.screening.completed'));
  }

  const workStatus = triage.work_status?.trim();
  if (workStatus) {
    partsP1.push(t.get('cpc.agenda.sessionRecord.screening.workStatus', { status: translateOption('work_status', workStatus) }));
  }

  const professionalTitle = profile?.professionalTitle?.trim();
  if (professionalTitle) {
    partsP1.push(t.get('cpc.agenda.sessionRecord.screening.professionalTitle', { title: professionalTitle }));
  } else {
    const mainNeeds = profile?.mainNeeds?.trim();
    if (mainNeeds) {
      partsP1.push(mainNeeds);
    }
  }

  const needsProfile = inferNeedsProfile(triage);
  const topNeed = needsProfile.items[0];
  const primaryChallenge = topNeed?.reasons[0] ? t.get(topNeed.reasons[0]) : null;

  const partsP2: string[] = [];
  const housingStatus = triage.housing_status?.trim();
  if (housingStatus) {
    partsP2.push(t.get('cpc.agenda.sessionRecord.screening.housingStatus', { status: translateOption('housing_status', housingStatus) }));
  }
  const legalStatus = triage.legal_status?.trim();
  if (legalStatus) {
    partsP2.push(t.get('cpc.agenda.sessionRecord.screening.legalStatus', { status: translateOption('legal_status', legalStatus) }));
  }
  const languageLevel = triage.language_level?.trim();
  if (languageLevel) {
    partsP2.push(t.get('cpc.agenda.sessionRecord.screening.languageLevel', { level: translateOption('language_level', languageLevel) }));
  }

  return {
    p1: partsP1.join(' '),
    primaryChallenge,
    p2: partsP2.length > 0 ? partsP2.join(' ') : null,
    isEmpty: false,
  };
}

export function buildSessionRecordActivities(input: {
  sessions: MigrantSession[];
  currentSessionId: string;
  progress: TrailProgress[];
  trails: Record<string, TrailInfo | null>;
  formatDate: (iso: string) => string;
  sessionTitle: (session: MigrantSession) => string;
  sessionMeta?: (session: MigrantSession) => string | undefined;
  trailProgressLabel: (percent: number) => string;
}): SessionRecordActivityItem[] {
  const items: SessionRecordActivityItem[] = [];

  for (const session of input.sessions) {
    if (session.id === input.currentSessionId) continue;
    items.push({
      date: input.formatDate(session.scheduled_date),
      title: input.sessionTitle(session),
      meta: input.sessionMeta?.(session),
    });
    if (items.length >= 2) return items;
  }

  for (const row of input.progress) {
    const trail = input.trails[row.trail_id];
    const title = trail?.title?.trim() || row.trail_id;
    const percent = typeof row.progress_percent === 'number' ? Math.round(row.progress_percent) : null;
    items.push({
      date: '—',
      title,
      meta: percent !== null ? input.trailProgressLabel(percent) : undefined,
    });
    if (items.length >= 2) return items;
  }

  return items;
}
