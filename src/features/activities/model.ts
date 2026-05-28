export const ACTIVITY_TYPES = ['focus_group', 'workshop', 'networking'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_FORMATS = ['presencial', 'online', 'hibrido'] as const;
export type ActivityFormat = (typeof ACTIVITY_FORMATS)[number];

export const ACTIVITY_STATUSES = ['rascunho', 'agendada', 'concluida', 'cancelada'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export type ActivityDoc = {
  id: string;
  title: string;
  activityType: ActivityType;
  format: ActivityFormat;
  status: ActivityStatus;
  date: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  location: string;
  topics: string[];
  consultantIds: string[];
  consultantNames: string[];
  participantMigrantIds: string[];
  participantCompanyIds: string[];
  participantConsultantIds: string[];
  searchTokens: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: unknown;
  deletedBy?: string | null;
};

export type ActivityUpsertInput = {
  title: string;
  activityType: ActivityType | '';
  format: ActivityFormat | '';
  status: ActivityStatus | '';
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  topics: string[];
  consultantIds: string[];
  consultantNames: string[];
  participantMigrantIds: string[];
  participantCompanyIds: string[];
  participantConsultantIds: string[];
};

export function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function toActivityTypeLabel(type: ActivityType): string {
  if (type === 'focus_group') return 'Focus Group';
  if (type === 'workshop') return 'Workshop';
  return 'Networking';
}

export function toActivityFormatLabel(format: ActivityFormat): string {
  if (format === 'presencial') return 'Presencial';
  if (format === 'online') return 'Online';
  return 'Híbrido';
}

export function toActivityStatusLabel(status: ActivityStatus): string {
  if (status === 'rascunho') return 'Rascunho';
  if (status === 'agendada') return 'Publicado';
  if (status === 'concluida') return 'Concluída';
  return 'Cancelada';
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidTime24h(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function parseTimeToMinutes(value: string): number | null {
  if (!isValidTime24h(value)) return null;
  const [hh, mm] = value.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

export function computeDurationMinutes(startTime: string, endTime: string): number | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) return null;
  const diff = end - start;
  if (diff <= 0) return null;
  return diff;
}

export function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  return parts.length ? parts.join(' ') : '—';
}

/** Duração compacta para listagens (ex.: "30m", "1h30m"). */
export function formatActivityDurationShort(input: {
  durationMinutes?: number | null;
  startTime?: string;
  endTime?: string;
}): string | null {
  let mins: number | null =
    typeof input.durationMinutes === 'number' && Number.isFinite(input.durationMinutes) && input.durationMinutes > 0
      ? Math.round(input.durationMinutes)
      : null;
  if (mins == null && input.startTime && input.endTime) {
    const computed = computeDurationMinutes(input.startTime, input.endTime);
    if (computed != null && computed > 0) mins = computed;
  }
  if (mins == null || mins <= 0) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

export function formatActivityStatusListLabel(status: string | null | undefined): string {
  if (!status) return '—';
  if ((ACTIVITY_STATUSES as readonly string[]).includes(status)) {
    return toActivityStatusLabel(status as ActivityStatus);
  }
  return status;
}

export function toStartAt(date: string, time: string): string {
  return `${date}T${time}:00`;
}

export function buildSearchTokens(args: {
  title: string;
  location: string;
  topics: string[];
  consultantNames: string[];
}): string[] {
  const raw = [args.title, args.location, ...args.topics, ...args.consultantNames]
    .map((v) => normalizeText(v))
    .filter(Boolean)
    .join(' ');
  const tokens = raw
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return Array.from(new Set(tokens)).slice(0, 60);
}

export type ActivityValidationErrors = Partial<Record<keyof ActivityUpsertInput, string>> & { timeRange?: string };

export function validateActivity(input: ActivityUpsertInput, todayIsoCalendar: string): ActivityValidationErrors {
  const errors: ActivityValidationErrors = {};
  const title = input.title.trim();
  if (title.length < 3) errors.title = 'O nome deve ter pelo menos 3 caracteres.';
  if (title.length > 120) errors.title = 'O nome deve ter no máximo 120 caracteres.';

  if (!input.activityType) errors.activityType = 'Selecione um tipo.';
  if (!input.format) errors.format = 'Selecione um formato.';
  if (!input.status) errors.status = 'Selecione um estado.';

  if (!isValidIsoDate(input.date)) {
    errors.date = 'Selecione uma data válida.';
  } else {
    const allowPastDate = input.status === 'concluida' || input.status === 'cancelada';
    if (!allowPastDate && input.date < todayIsoCalendar) errors.date = 'Não é possível agendar em datas passadas.';
  }

  if (!isValidTime24h(input.startTime)) errors.startTime = 'Indique a hora de início (24h).';
  if (!isValidTime24h(input.endTime)) errors.endTime = 'Indique a hora de fim (24h).';
  const duration = computeDurationMinutes(input.startTime, input.endTime);
  if (duration === null) errors.timeRange = 'A hora de fim deve ser posterior à hora de início.';

  const location = input.location.trim();
  if (location.length < 3) errors.location = 'Indique um local/link com pelo menos 3 caracteres.';
  if (location.length > 160) errors.location = 'O local/link deve ter no máximo 160 caracteres.';

  if (input.consultantIds.length === 0) errors.consultantIds = 'Selecione pelo menos um consultor.';
  if (input.topics.length === 0) errors.topics = 'Adicione pelo menos uma temática.';

  const participantsCount =
    input.participantMigrantIds.length + input.participantCompanyIds.length + input.participantConsultantIds.length;
  if (participantsCount === 0) errors.participantMigrantIds = 'Selecione pelo menos um participante.';

  return errors;
}

