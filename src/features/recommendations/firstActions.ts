import type { TriageResponses } from '@/types/triage';
import type { ServiceAreaId } from '@/features/serviceAreas/serviceAreas';

export type ActionPriority = 'urgent' | 'recommended' | 'suggested';

export interface FirstAction {
  id: string;
  titleKey: string;
  descriptionKey: string;
  priority: ActionPriority;
  icon: string;
  /** Rota para navegar. Mutuamente exclusivo com opensBooking. */
  route?: string;
  /** Quando true, a ação abre o diálogo de agendamento (não navega). */
  opensBooking?: boolean;
  /** Área de serviço pré-selecionada ao abrir o agendamento. */
  area?: ServiceAreaId;
}

export interface UserState {
  triage: TriageResponses | null | undefined;
  hasCv: boolean;
  triageCompleted: boolean;
}

const LEGAL_TOKENS = ['legal_info', 'visa_info'];
const PSYCH_TOKENS = ['psychological', 'emotional_support'];
const SOCIAL_TOKENS = ['food', 'health', 'cost_of_living'];
const EMPLOYMENT_TOKENS = ['employment', 'job_support'];

function includesAny(list: string[] | null | undefined, tokens: string[]): boolean {
  if (!list || list.length === 0) return false;
  return list.some((v) => tokens.includes(v));
}

export function inferFirstActions(state: UserState): FirstAction[] {
  const { triage, hasCv, triageCompleted } = state;
  const actions: FirstAction[] = [];

  // Situação Inicial incompleta tem prioridade máxima e foca só nisto.
  if (!triageCompleted) {
    return [
      {
        id: 'complete-triage',
        titleKey: 'firstActions.completeTriage.title',
        descriptionKey: 'firstActions.completeTriage.description',
        route: '/triagem',
        priority: 'urgent',
        icon: 'ClipboardList',
      },
    ];
  }

  if (!triage) return actions;

  const urgencies = triage.urgencies ?? [];

  // --- Urgentes ---
  if (includesAny(urgencies, LEGAL_TOKENS) || triage.legal_status === 'not_regularized') {
    actions.push({
      id: 'book-legal',
      titleKey: 'firstActions.bookLegal.title',
      descriptionKey: 'firstActions.bookLegal.description',
      priority: 'urgent',
      icon: 'Scale',
      opensBooking: true,
      area: 'legal',
    });
  }

  if (includesAny(urgencies, PSYCH_TOKENS)) {
    actions.push({
      id: 'book-psychological',
      titleKey: 'firstActions.bookPsychological.title',
      descriptionKey: 'firstActions.bookPsychological.description',
      priority: 'urgent',
      icon: 'HeartHandshake',
      opensBooking: true,
      area: 'psychology',
    });
  }

  if (includesAny(urgencies, SOCIAL_TOKENS)) {
    actions.push({
      id: 'book-social',
      titleKey: 'firstActions.bookSocial.title',
      descriptionKey: 'firstActions.bookSocial.description',
      priority: 'urgent',
      icon: 'LifeBuoy',
      opensBooking: true,
      area: 'mediation',
    });
  }

  // --- Recomendadas ---
  if (triage.legal_status === 'pending' && !actions.some((a) => a.id === 'book-legal')) {
    actions.push({
      id: 'book-legal',
      titleKey: 'firstActions.bookLegal.title',
      descriptionKey: 'firstActions.bookLegal.descriptionInProcess',
      priority: 'recommended',
      icon: 'Scale',
      opensBooking: true,
      area: 'legal',
    });
  }

  if (triage.language_level === 'none' || triage.language_level === 'basic') {
    actions.push({
      id: 'trail-portuguese',
      titleKey: 'firstActions.trailPortuguese.title',
      descriptionKey: 'firstActions.trailPortuguese.description',
      route: '/dashboard/migrante/trilhas',
      priority: 'recommended',
      icon: 'Languages',
    });
  }

  if (!hasCv) {
    actions.push({
      id: 'complete-cv',
      titleKey: 'firstActions.completeCv.title',
      descriptionKey: 'firstActions.completeCv.description',
      route: '/dashboard/migrante/curriculo',
      priority: 'recommended',
      icon: 'FileText',
    });
  }

  // --- Sugeridas ---
  if (triage.work_status === 'unemployed_seeking' || includesAny(urgencies, EMPLOYMENT_TOKENS)) {
    actions.push({
      id: 'view-jobs',
      titleKey: 'firstActions.viewJobs.title',
      descriptionKey: 'firstActions.viewJobs.description',
      route: '/dashboard/migrante/emprego',
      priority: 'suggested',
      icon: 'Briefcase',
    });
  }

  return actions.slice(0, 5);
}
