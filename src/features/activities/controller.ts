import { addCalendarDaysIso, monthStartEndIsoInAppTimeZone, todayIsoAppCalendar } from '@/lib/appCalendar';
import type { ActivityDoc, ActivityStatus, ActivityType, ActivityUpsertInput } from './model';
import { normalizeText, validateActivity } from './model';
import {
  countActivities,
  createActivity,
  deleteActivity,
  getActivity,
  listActivitiesPage,
  listConsultants,
  listMigrants,
  updateActivity,
  type ActivitiesListFilters,
  type ConsultantOption,
  type MigrantOption,
} from './repository';

export type ActivitiesUiFilters = {
  search: string;
  type: ActivityType | 'all';
  status: ActivityStatus | 'all';
  format: 'presencial' | 'online' | 'hibrido' | 'all';
  consultantId: string | 'all';
  topic: string | 'all';
  datePreset: 'this_month' | 'next_30_days' | 'all';
};

export function toFiltersWithDatePreset(filters: ActivitiesUiFilters): ActivitiesListFilters {
  const now = new Date();
  const { monthStart, monthEnd } = monthStartEndIsoInAppTimeZone(now);

  let startAtMin: string | null = null;
  let startAtMax: string | null = null;
  if (filters.datePreset === 'this_month') {
    startAtMin = `${monthStart}T00:00:00`;
    startAtMax = `${monthEnd}T23:59:59`;
  } else if (filters.datePreset === 'next_30_days') {
    const start = todayIsoAppCalendar();
    const end = addCalendarDaysIso(start, 30);
    startAtMin = `${start}T00:00:00`;
    startAtMax = `${end}T23:59:59`;
  }

  const rawTokens = normalizeText(filters.search)
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 10);
  const searchTokensAny = rawTokens.length > 0 ? rawTokens : null;

  return {
    type: filters.type,
    status: filters.status,
    format: filters.format,
    consultantId: filters.consultantId,
    topic: filters.topic,
    startAtMin,
    startAtMax,
    searchTokensAny,
  };
}

export async function loadActivitiesSummary(args: { uiFilters: ActivitiesUiFilters }): Promise<{ total: number }> {
  const filters = toFiltersWithDatePreset(args.uiFilters);
  const total = await countActivities(filters);
  return { total };
}

export async function loadActivitiesPage(args: {
  uiFilters: ActivitiesUiFilters;
  limit: number;
  cursorStartAfterStartAt?: string | null;
}): Promise<{ rows: ActivityDoc[]; nextCursor: string | null }> {
  const filters = toFiltersWithDatePreset(args.uiFilters);
  return listActivitiesPage({ filters, limit: args.limit, cursorStartAfterStartAt: args.cursorStartAfterStartAt ?? null });
}

export async function loadActivitiesForExport(args: {
  uiFilters: ActivitiesUiFilters;
  maxRows?: number;
}): Promise<ActivityDoc[]> {
  const filters = toFiltersWithDatePreset(args.uiFilters);
  const maxRows = Math.max(1, Math.min(args.maxRows ?? 5000, 5000));
  const chunk = 500;

  const out: ActivityDoc[] = [];
  let cursorStartAfterStartAt: string | null = null;
  while (out.length < maxRows) {
    const { rows, nextCursor } = await listActivitiesPage({
      filters,
      limit: Math.min(chunk, maxRows - out.length),
      cursorStartAfterStartAt,
    });
    if (rows.length === 0) break;
    out.push(...rows);
    cursorStartAfterStartAt = nextCursor;
    if (!cursorStartAfterStartAt) break;
  }
  return out;
}

export async function loadActivityOptions(): Promise<{ consultants: ConsultantOption[]; migrants: MigrantOption[] }> {
  const [consultants, migrants] = await Promise.all([listConsultants(), listMigrants()]);
  return { consultants, migrants };
}

export async function loadActivityForEdit(activityId: string): Promise<ActivityDoc | null> {
  return getActivity(activityId);
}

export function validateActivityForUi(input: ActivityUpsertInput): { valid: boolean; errors: Record<string, string> } {
  const errors = validateActivity(input, todayIsoAppCalendar());
  const out: Record<string, string> = {};
  Object.entries(errors).forEach(([k, v]) => {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  });
  return { valid: Object.keys(out).length === 0, errors: out };
}

export async function saveActivity(args: {
  activityId?: string | null;
  input: ActivityUpsertInput;
  actorId: string;
}): Promise<{ id: string }> {
  const validation = validateActivityForUi(args.input);
  if (!validation.valid) throw new Error('Verifique os campos obrigatórios antes de guardar.');

  if (args.activityId) {
    await updateActivity({ activityId: args.activityId, input: args.input, actorId: args.actorId });
    return { id: args.activityId };
  }

  const id = await createActivity({ input: args.input, actorId: args.actorId });
  return { id };
}

export async function removeActivity(args: { activityId: string; actorId: string }): Promise<void> {
  await deleteActivity({ activityId: args.activityId, actorId: args.actorId });
}
